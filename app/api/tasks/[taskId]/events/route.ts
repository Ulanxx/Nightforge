import { NextResponse } from "next/server";
import { parseRuntimeEvent } from "@/lib/agent/events";
import { listTaskEvents } from "@/lib/store/events";

export async function GET(_: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const events = await listTaskEvents(taskId);

  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
      payload: parseRuntimeEvent(event.payload)
    }))
  });
}
