import type { AgentRuntimeEvent } from "@/lib/agent/runtime";

export function serializeRuntimeEvent(event: AgentRuntimeEvent) {
  return JSON.stringify(event);
}

export function formatSseEvent(data: unknown, event?: string) {
  const lines = [];

  if (event) {
    lines.push(`event: ${event}`);
  }

  lines.push(`data: ${JSON.stringify(data)}`);

  return `${lines.join("\n")}\n\n`;
}

export function parseRuntimeEvent(payload: string): AgentRuntimeEvent | null {
  try {
    return JSON.parse(payload) as AgentRuntimeEvent;
  } catch {
    return null;
  }
}
