import type { AgentRuntimeEvent } from "@/lib/agent/runtime";

export function serializeRuntimeEvent(event: AgentRuntimeEvent) {
  return JSON.stringify(event);
}

export function parseRuntimeEvent(payload: string): AgentRuntimeEvent | null {
  try {
    return JSON.parse(payload) as AgentRuntimeEvent;
  } catch {
    return null;
  }
}
