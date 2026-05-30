import { NextResponse } from "next/server";
import { dispatchBackgroundRun } from "@/lib/agent/dispatcher";
import { executeTaskInBackground } from "@/lib/agent/executor";
import { createTaskRequestSchema } from "@/lib/api/schemas";
import { createSandboxManager } from "@/lib/sandbox/manager";
import { createMessage } from "@/lib/store/messages";
import { getOrCreateSession } from "@/lib/store/sessions";
import { createTask } from "@/lib/store/tasks";

const sandboxManager = createSandboxManager();

export async function POST(request: Request) {
  const parsedBody = createTaskRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "请求体格式错误。" }, { status: 400 });
  }

  const sessionId = parsedBody.data.sessionId ?? crypto.randomUUID();
  const { message, permissions } = parsedBody.data;

  const title = message.slice(0, 72);

  await getOrCreateSession(sessionId, title);
  await createMessage(sessionId, "user", message);

  await sandboxManager.getOrCreate(sessionId);

  const task = await createTask(sessionId, message, "planning");
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
