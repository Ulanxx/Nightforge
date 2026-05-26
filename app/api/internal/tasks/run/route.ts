import { NextResponse } from "next/server";
import { executeTaskInBackground } from "@/lib/agent/executor";

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = String(body.sessionId ?? "");
  const taskId = String(body.taskId ?? "");
  const message = String(body.message ?? "").trim();
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];

  if (!sessionId || !taskId || !message) {
    return NextResponse.json({ error: "sessionId, taskId, and message are required." }, { status: 400 });
  }

  await executeTaskInBackground({
    sessionId,
    taskId,
    message,
    permissions
  });

  return NextResponse.json({ ok: true });
}
