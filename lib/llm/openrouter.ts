import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  if (!model) {
    throw new Error("OPENROUTER_MODEL is not configured.");
  }

  return {
    apiKey,
    model,
    baseUrl
  };
}

function createOpenRouterClient() {
  const { apiKey, baseUrl } = getOpenRouterConfig();

  return new OpenRouter({
    apiKey,
    serverURL: baseUrl,
    httpReferer: "http://localhost:3000",
    appTitle: "deepagents-agent"
  });
}

export async function createStructuredChatCompletion<T>({
  schema,
  messages,
  normalize
}: {
  schema: z.ZodSchema<T>;
  messages: ChatMessage[];
  normalize?: (value: unknown) => unknown;
}) {
  const { model } = getOpenRouterConfig();
  const client = createOpenRouterClient();

  const response = await client.chat.send({
    chatRequest: {
      model,
      messages,
      temperature: 0.2
    }
  });
  const rawContent = response.choices[0]?.message?.content;
  const content = extractContent(rawContent);

  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

  try {
    const parsed = parseJsonLikeContent(content);
    return schema.parse(normalize ? normalize(parsed) : parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Structured parse failed. Raw model content: ${content}\nParser error: ${message}`);
  }
}

function extractContent(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function parseJsonLikeContent(content: string) {
  const normalized = stripCodeFence(content);

  try {
    return JSON.parse(normalized);
  } catch {
    const objectMatch = normalized.match(/\{[\s\S]*\}/);

    if (!objectMatch) {
      throw new Error(`Model did not return valid JSON content: ${content}`);
    }

    return JSON.parse(objectMatch[0]);
  }
}

function stripCodeFence(content: string) {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}
