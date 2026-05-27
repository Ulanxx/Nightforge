import { NextResponse } from "next/server";
import { internalTaskReplyRequestSchema } from "@/lib/api/schemas";
import { continueTaskInBackground } from "@/lib/agent/executor";

export async function POST(request: Request) {
  const parsedBody = internalTaskReplyRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "请求体格式错误。" }, { status: 400 });
  }

  const { sessionId, taskId, originalPrompt, message } = parsedBody.data;

  await continueTaskInBackground({
    sessionId,
    taskId,
    originalPrompt,
    clarificationAnswer: message
  });

  return NextResponse.json({ ok: true });
}
