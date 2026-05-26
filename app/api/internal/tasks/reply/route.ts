import { NextResponse } from "next/server";
import { continueTaskInBackground } from "@/lib/agent/executor";

export async function POST(request: Request) {
  const body = await request.json();
  const sessionId = String(body.sessionId ?? "");
  const taskId = String(body.taskId ?? "");
  const originalPrompt = String(body.originalPrompt ?? "").trim();
  const clarificationAnswer = String(body.clarificationAnswer ?? "").trim();

  if (!sessionId || !taskId || !originalPrompt || !clarificationAnswer) {
    return NextResponse.json(
      { error: "sessionId, taskId, originalPrompt, and clarificationAnswer are required." },
      { status: 400 }
    );
  }

  await continueTaskInBackground({
    sessionId,
    taskId,
    originalPrompt,
    clarificationAnswer
  });

  return NextResponse.json({ ok: true });
}
