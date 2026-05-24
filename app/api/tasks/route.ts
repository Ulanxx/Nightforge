import { NextResponse } from "next/server";
import { createAgentRuntime } from "@/lib/agent/runtime";
import { createSandboxManager } from "@/lib/sandbox/manager";

const agentRuntime = createAgentRuntime();
const sandboxManager = createSandboxManager();

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = String(body.sessionId ?? crypto.randomUUID());
  const message = String(body.message ?? "");

  await sandboxManager.getOrCreate(sessionId);

  const events = [];
  for await (const event of agentRuntime.runTask({
    sessionId,
    message,
    permissions: Array.isArray(body.permissions) ? body.permissions : []
  })) {
    events.push(event);
  }

  return NextResponse.json({
    sessionId,
    events
  });
}
