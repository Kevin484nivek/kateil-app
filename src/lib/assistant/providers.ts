import type { AssistantProvider, AssistantRuntimeConfig } from "./types";

type GenerateWithProviderInput = {
  config: AssistantRuntimeConfig;
  systemPrompt: string;
  userPrompt: string;
};

function parseNumber(input: string | undefined, fallback: number) {
  const value = Number(input);

  return Number.isFinite(value) ? value : fallback;
}

export function getAssistantRuntimeConfig(): AssistantRuntimeConfig {
  const provider = (process.env.ASSISTANT_AI_PROVIDER ?? "none").trim().toLowerCase();
  const normalizedProvider: AssistantProvider =
    provider === "openai" || provider === "groq" || provider === "anthropic"
      ? provider
      : "none";

  return {
    provider: normalizedProvider,
    model: (process.env.ASSISTANT_AI_MODEL ?? "gpt-4o-mini").trim(),
    apiKey: (process.env.ASSISTANT_AI_API_KEY ?? "").trim() || null,
    baseUrl: (process.env.ASSISTANT_AI_BASE_URL ?? "").trim() || null,
    temperature: parseNumber(process.env.ASSISTANT_AI_TEMPERATURE, 0.2),
    maxOutputTokens: parseNumber(process.env.ASSISTANT_AI_MAX_OUTPUT_TOKENS, 700),
    timeoutMs: parseNumber(process.env.ASSISTANT_AI_TIMEOUT_MS, 15000),
  };
}

function buildRequestHeaders(apiKey: string) {
  return {
    "content-type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

async function callOpenAiCompatible(input: GenerateWithProviderInput, defaultBaseUrl: string) {
  const baseUrl = input.config.baseUrl ?? defaultBaseUrl;
  const apiKey = input.config.apiKey;

  if (!apiKey) {
    throw new Error("Assistant API key is missing.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: buildRequestHeaders(apiKey),
      body: JSON.stringify({
        model: input.config.model,
        temperature: input.config.temperature,
        max_tokens: input.config.maxOutputTokens,
        messages: [
          {
            role: "system",
            content: input.systemPrompt,
          },
          {
            role: "user",
            content: input.userPrompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Assistant provider error (${response.status})`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("Assistant provider returned empty response.");
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(input: GenerateWithProviderInput) {
  const baseUrl = input.config.baseUrl ?? "https://api.anthropic.com/v1";
  const apiKey = input.config.apiKey;

  if (!apiKey) {
    throw new Error("Assistant API key is missing.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.config.model,
        max_tokens: input.config.maxOutputTokens,
        temperature: input.config.temperature,
        system: input.systemPrompt,
        messages: [
          {
            role: "user",
            content: input.userPrompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Assistant provider error (${response.status})`);
    }

    const payload = (await response.json()) as {
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    };

    const text = payload.content
      ?.filter((entry) => entry.type === "text")
      .map((entry) => entry.text?.trim() ?? "")
      .join("\n")
      .trim();

    if (!text) {
      throw new Error("Assistant provider returned empty response.");
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateWithProvider(input: GenerateWithProviderInput) {
  if (input.config.provider === "openai") {
    return callOpenAiCompatible(input, "https://api.openai.com/v1");
  }

  if (input.config.provider === "groq") {
    return callOpenAiCompatible(input, "https://api.groq.com/openai/v1");
  }

  if (input.config.provider === "anthropic") {
    return callAnthropic(input);
  }

  throw new Error("Assistant provider is disabled.");
}

