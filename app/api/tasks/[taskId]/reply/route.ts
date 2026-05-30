import { NextResponse } from "next/server";
import { dispatchBackgroundRun } from "@/lib/agent/dispatcher";
import { continueTaskInBackground } from "@/lib/agent/executor";
import { taskReplyRequestSchema } from "@/lib/api/schemas";
import { createMessage } from "@/lib/store/messages";
import { getTaskById, updateTaskStatus } from "@/lib/store/tasks";

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const parsedBody = taskReplyRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "请求体格式错误。" }, { status: 400 });
  }

  const { message } = parsedBody.data;

  const task = await getTaskById(taskId);

  if (!task) {
    return NextResponse.json({ error: "未找到任务。" }, { status: 404 });
  }

  await createMessage(task.sessionId, "user", message);
  await updateTaskStatus(taskId, "planning", "已收到补充信息，正在重新评估任务并继续执行。");
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
      message
    });
  }

  return NextResponse.json({
    taskId
  }, { status: 202 });
}
