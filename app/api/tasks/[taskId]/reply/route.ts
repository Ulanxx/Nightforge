import { NextResponse } from "next/server";
import { dispatchBackgroundRun } from "@/lib/agent/dispatcher";
import { continueTaskInBackground } from "@/lib/agent/executor";
import { createMessage } from "@/lib/store/messages";
import { getTaskById, updateTaskStatus } from "@/lib/store/tasks";

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const body = await request.json();
  const message = String(body.message ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "Reply message is required." }, { status: 400 });
  }

  const task = await getTaskById(taskId);

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  await createMessage(task.sessionId, "user", message);
  await updateTaskStatus(taskId, "planning", "Clarification received. Task resumed in background.");
  const replyUrl = new URL("/api/internal/tasks/reply", request.url).toString();

  if (process.env.NODE_ENV === "production") {
    void continueTaskInBackground({
      sessionId: task.sessionId,
      taskId,
      originalPrompt: task.prompt,
      clarificationAnswer: message
    });
  } else {
    dispatchBackgroundRun(replyUrl, {
      sessionId: task.sessionId,
      taskId,
      originalPrompt: task.prompt,
      clarificationAnswer: message
    });
  }

  return NextResponse.json({
    taskId
  }, { status: 202 });
}
