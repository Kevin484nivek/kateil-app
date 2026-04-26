import { NextResponse } from "next/server";

import { getUserSession } from "@/lib/auth/session";
import { answerAssistantQuestion } from "@/lib/assistant/service";

type ChatRequestBody = {
  message?: string;
  pathname?: string | null;
};

function sanitizeMessage(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  const session = await getUserSession();

  if (!session) {
    return NextResponse.json(
      {
        error: "No autorizado",
      },
      { status: 401 },
    );
  }

  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const message = sanitizeMessage(body.message);

  if (!message) {
    return NextResponse.json({ error: "La pregunta está vacía" }, { status: 400 });
  }

  if (message.length > 1200) {
    return NextResponse.json({ error: "La pregunta es demasiado larga" }, { status: 400 });
  }

  const result = await answerAssistantQuestion({
    message,
    pathname: body.pathname,
    userId: session.userId,
    userRole: session.role,
    userEmail: session.email,
  });

  return NextResponse.json({
    answer: result.answer,
    provider: result.provider,
    model: result.model,
    usedFallback: result.usedFallback,
    snippets: result.snippets,
  });
}

