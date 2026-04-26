"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

type AssistantResponsePayload = {
  answer: string;
  provider: string;
  model: string;
  usedFallback: boolean;
  snippets: Array<{ source: string; title: string }>;
};

type HelpAssistantProps = {
  roleLabel: string;
};

export function HelpAssistant({ roleLabel }: HelpAssistantProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: `Asistente Kateil listo. Puedo resolver dudas operativas y revisar estado del sistema según tu rol (${roleLabel}).`,
    },
  ]);
  const [metaText, setMetaText] = useState("Modo base local");

  const canSend = useMemo(
    () => draft.trim().length > 0 && !isSending,
    [draft, isSending],
  );

  async function sendMessage() {
    const question = draft.trim();

    if (!question || isSending) {
      return;
    }

    setIsSending(true);
    setDraft("");
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        role: "user",
        text: question,
      },
    ]);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: question,
          pathname,
        }),
      });

      if (!response.ok) {
        throw new Error("assistant_request_failed");
      }

      const payload = (await response.json()) as AssistantResponsePayload;
      const providerLabel = payload.provider === "none" ? "local" : payload.provider;

      setMetaText(`${providerLabel} · ${payload.model}${payload.usedFallback ? " · fallback" : ""}`);
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: payload.answer,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 2,
          role: "assistant",
          text: "No pude responder ahora mismo. Reintenta en unos segundos.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={`assistant-widget ${open ? "assistant-widget-open" : ""}`}>
      {open ? (
        <section className="assistant-panel" aria-label="Asistente Kateil">
          <header className="assistant-panel-header">
            <div>
              <p className="card-label">Asistente Kateil</p>
              <strong>{metaText}</strong>
            </div>
            <button
              type="button"
              className="button button-secondary assistant-close"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </header>

          <div className="assistant-messages">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`assistant-message assistant-message-${message.role}`}
              >
                <p>{message.text}</p>
              </article>
            ))}
          </div>

          <div className="assistant-composer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ej: ¿Cómo hago una devolución con cambio?"
              rows={3}
            />
            <button
              type="button"
              className={`button ${canSend ? "button-primary" : "button-secondary"}`}
              disabled={!canSend}
              onClick={sendMessage}
            >
              {isSending ? "Consultando..." : "Preguntar"}
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className="button button-primary assistant-launcher"
          onClick={() => setOpen(true)}
        >
          Ayuda IA
        </button>
      )}
    </div>
  );
}
