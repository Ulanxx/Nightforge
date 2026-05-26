import { NextResponse } from "next/server";
import { dispatchBackgroundRun } from "@/lib/agent/dispatcher";
import { executeTaskInBackground } from "@/lib/agent/executor";
import { createSandboxManager } from "@/lib/sandbox/manager";
import { createMessage } from "@/lib/store/messages";
import { getOrCreateSession } from "@/lib/store/sessions";
import { createTask } from "@/lib/store/tasks";

const sandboxManager = createSandboxManager();

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = String(body.sessionId ?? crypto.randomUUID());
  const message = String(body.message ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const title = message.slice(0, 72);

  await getOrCreateSession(sessionId, title);
  await createMessage(sessionId, "user", message);

  await sandboxManager.getOrCreate(sessionId);

  const task = await createTask(sessionId, message, "planning");
  const permissions = Array.isArray(body.permissions) ? body.permissions : [];
  const runUrl = new URL("/api/internal/tasks/run", request.url).toString();

  if (process.env.NODE_ENV === "production") {
    void executeTaskInBackground({
      sessionId,
      taskId: task.id,
      message,
      permissions
    });
  } else {
    dispatchBackgroundRun(runUrl, {
      sessionId,
      taskId: task.id,
      message,
      permissions
    });
  }

  return NextResponse.json({
    sessionId,
    taskId: task.id
  }, { status: 202 });
}
