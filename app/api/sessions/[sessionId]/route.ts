import { NextResponse } from "next/server";
import { getSessionById } from "@/lib/store/sessions";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const session = await getSessionById(sessionId);

  if (!session) {
    return NextResponse.json({ error: "未找到会话。" }, { status: 404 });
  }

  return NextResponse.json({ session });
}
