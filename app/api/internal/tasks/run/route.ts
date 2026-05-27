import { NextResponse } from "next/server";
import { internalTaskRunRequestSchema } from "@/lib/api/schemas";
import { executeTaskInBackground } from "@/lib/agent/executor";

export async function POST(request: Request) {
  const parsedBody = internalTaskRunRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "请求体格式错误。" }, { status: 400 });
  }

  const { sessionId, taskId, message, permissions } = parsedBody.data;

  await executeTaskInBackground({
    sessionId,
    taskId,
    message,
    permissions
  });

  return NextResponse.json({ ok: true });
}
