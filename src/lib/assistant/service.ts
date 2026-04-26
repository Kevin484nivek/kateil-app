import { getRoleLabel } from "@/lib/auth/roles";

import { buildAssistantContext } from "./context";
import { searchKnowledgeSnippets } from "./knowledge";
import { getAssistantRolePolicy } from "./permissions";
import { generateWithProvider, getAssistantRuntimeConfig } from "./providers";
import type { AssistantAnswer, AssistantMessageInput } from "./types";

function buildSystemPrompt(input: {
  roleLabel: string;
  contextText: string;
  snippetsText: string;
  allowedDomains: string;
}) {
  return `
Eres el asistente interno de Kateil Platform.
Tu idioma de respuesta es español.
Reglas de seguridad:
- No inventes datos.
- Solo usa los datos del contexto y snippets.
- Si falta información, dilo claramente.
- Respeta el alcance por rol del usuario.
- No ofrezcas ejecutar acciones destructivas.
- No expongas datos fuera de dominios permitidos.
- No inventes pantallas, botones ni menús que no existan.
- No uses markdown (sin **negritas**, sin tablas, sin bloques).

Hechos de interfaz obligatorios (no contradigas esto):
- No existe un módulo independiente llamado "Devoluciones".
- Las devoluciones/cambios se hacen dentro de "Nueva venta" (/sales/new).
- Flujo real de devolución: activar modo "Devolución / cambio", seleccionar ticket original, añadir líneas devueltas, añadir líneas nuevas si aplica y confirmar.

Rol del usuario: ${input.roleLabel}
Dominios permitidos: ${input.allowedDomains}

Contexto del sistema:
${input.contextText}

Conocimiento documental:
${input.snippetsText}
`.trim();
}

function buildDeterministicFlowAnswer(message: string): string | null {
  const normalized = message.toLowerCase();

  if (normalized.includes("devolu")) {
    return [
      "La devolución se hace en Nueva venta, no en un módulo separado.",
      "",
      "Pasos:",
      "1. Ve a Nueva venta (/sales/new).",
      "2. Cambia el modo a Devolución / cambio.",
      "3. Busca y selecciona el ticket original.",
      "4. Añade las líneas devueltas (el sistema limita cantidades disponibles).",
      "5. Si la clienta se lleva otro producto, añádelo en el mismo ticket.",
      "6. Revisa el saldo neto y confirma.",
    ].join("\n");
  }

  return null;
}

function buildUserPrompt(message: string, pathname?: string | null) {
  return `
Pregunta del usuario:
${message}

Ruta en la que está trabajando:
${pathname ?? "(sin ruta)"}

Formato esperado:
- Respuesta corta y accionable.
- Si procede, pasos numerados.
- Si hay limitación por rol o falta de datos, indícalo.
`.trim();
}

function buildFallbackAnswer(input: {
  message: string;
  contextText: string;
  snippets: Awaited<ReturnType<typeof searchKnowledgeSnippets>>;
  matchedProducts: Array<{
    code: string;
    name: string;
    stockCurrent: number;
    basePrice: string;
    supplierName: string;
  }>;
}): string {
  const normalized = input.message.toLowerCase();
  const lines: string[] = [];

  if (input.matchedProducts.length > 0) {
    lines.push("Estado de productos relacionados:");

    for (const product of input.matchedProducts.slice(0, 5)) {
      lines.push(
        `- ${product.code} · ${product.name}: stock ${product.stockCurrent}, PVP ${product.basePrice}, proveedor ${product.supplierName}.`,
      );
    }
  }

  if (input.snippets.length > 0) {
    lines.push("Guía recomendada:");
    lines.push(input.snippets[0].excerpt);
  }

  if (normalized.includes("sistema") || normalized.includes("estado")) {
    lines.push("Resumen operativo actual:");
    lines.push(input.contextText);
  }

  if (lines.length === 0) {
    lines.push(
      "Asistente en modo base: no hay proveedor IA configurado todavía. Te recomiendo activar proveedor API para respuestas más completas.",
    );
  } else {
    lines.push(
      "Nota: respuesta generada en modo base local (sin proveedor IA externo configurado).",
    );
  }

  return lines.join("\n\n");
}

export async function answerAssistantQuestion(input: AssistantMessageInput): Promise<AssistantAnswer> {
  const rolePolicy = getAssistantRolePolicy(input.userRole);
  const deterministicAnswer = buildDeterministicFlowAnswer(input.message);
  const snippets = await searchKnowledgeSnippets(input.message, 4);
  const context = await buildAssistantContext({
    message: input.message,
    pathname: input.pathname,
    rolePolicy,
  });
  const runtime = getAssistantRuntimeConfig();
  const snippetsText =
    snippets.length === 0
      ? "Sin snippets relevantes."
      : snippets
          .map((snippet) => `[${snippet.title}] (${snippet.source}) ${snippet.excerpt}`)
          .join("\n\n");
  const roleLabel = getRoleLabel(input.userRole);

  if (deterministicAnswer) {
    return {
      answer: deterministicAnswer,
      provider: runtime.provider,
      model: runtime.model,
      usedFallback: true,
      snippets: snippets.map((snippet) => ({ source: snippet.source, title: snippet.title })),
    };
  }

  if (runtime.provider === "none" || !runtime.apiKey) {
    return {
      answer: buildFallbackAnswer({
        message: input.message,
        contextText: context.contextText,
        snippets,
        matchedProducts: context.matchedProducts,
      }),
      provider: "none",
      model: runtime.model,
      usedFallback: true,
      snippets: snippets.map((snippet) => ({ source: snippet.source, title: snippet.title })),
    };
  }

  try {
    const answer = await generateWithProvider({
      config: runtime,
      systemPrompt: buildSystemPrompt({
        roleLabel,
        contextText: context.contextText,
        snippetsText,
        allowedDomains: rolePolicy.allowedDomains.join(", "),
      }),
      userPrompt: buildUserPrompt(input.message, input.pathname),
    });

    return {
      answer,
      provider: runtime.provider,
      model: runtime.model,
      usedFallback: false,
      snippets: snippets.map((snippet) => ({ source: snippet.source, title: snippet.title })),
    };
  } catch {
    return {
      answer: buildFallbackAnswer({
        message: input.message,
        contextText: context.contextText,
        snippets,
        matchedProducts: context.matchedProducts,
      }),
      provider: runtime.provider,
      model: runtime.model,
      usedFallback: true,
      snippets: snippets.map((snippet) => ({ source: snippet.source, title: snippet.title })),
    };
  }
}
