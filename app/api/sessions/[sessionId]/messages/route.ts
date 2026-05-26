import { NextResponse } from "next/server";
import { listSessionMessages } from "@/lib/store/messages";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const messages = await listSessionMessages(sessionId);

  return NextResponse.json({ messages });
}
