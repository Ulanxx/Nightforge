const defaultOpenRouterBaseUrl = "https://openrouter.ai/api/v1";

function readRequiredEnv(name: "OPENROUTER_API_KEY" | "OPENROUTER_MODEL") {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`缺少 ${name}，请先在环境变量中完成配置。`);
  }

  return value;
}

export function getOpenRouterEnv() {
  return {
    apiKey: readRequiredEnv("OPENROUTER_API_KEY"),
    model: readRequiredEnv("OPENROUTER_MODEL"),
    baseUrl: process.env.OPENROUTER_BASE_URL?.trim() || defaultOpenRouterBaseUrl
  };
}
