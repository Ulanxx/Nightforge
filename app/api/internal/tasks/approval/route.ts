import { NextResponse } from "next/server";
import { internalTaskApprovalRequestSchema } from "@/lib/api/schemas";
import { continueTaskAfterApprovalInBackground } from "@/lib/agent/executor";

export async function POST(request: Request) {
  const parsedBody = internalTaskApprovalRequestSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "请求体格式错误。" }, { status: 400 });
  }

  const { sessionId, taskId, originalPrompt, approvalId, tool, inputJson } = parsedBody.data;

  await continueTaskAfterApprovalInBackground({
    sessionId,
    taskId,
    originalPrompt,
    approvedAction: {
      approvalId,
      tool,
      inputJson
    }
  });

  return NextResponse.json({ ok: true });
}
