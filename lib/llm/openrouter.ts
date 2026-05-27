import { OpenRouter } from "@openrouter/sdk";
import { z } from "zod";
import { getOpenRouterEnv } from "@/lib/config/env";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function createOpenRouterClient() {
  const { apiKey, baseUrl } = getOpenRouterEnv();

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
  const { model } = getOpenRouterEnv();
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
    throw new Error("OpenRouter 返回了空响应。");
  }

  try {
    const parsed = parseJsonLikeContent(content);
    return schema.parse(normalize ? normalize(parsed) : parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`结构化解析失败。模型原始内容：${content}\n解析错误：${message}`);
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
      throw new Error(`模型没有返回有效 JSON 内容：${content}`);
    }

    return JSON.parse(objectMatch[0]);
  }
}

function stripCodeFence(content: string) {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}
