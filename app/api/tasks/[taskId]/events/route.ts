import { NextResponse } from "next/server";
import { formatSseEvent, parseRuntimeEvent } from "@/lib/agent/events";
import { listTaskEvents } from "@/lib/store/events";

function toClientEvent(event: Awaited<ReturnType<typeof listTaskEvents>>[number]) {
  return {
    id: event.id,
    type: event.type,
    createdAt: event.createdAt.toISOString(),
    payload: parseRuntimeEvent(event.payload)
  };
}

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const { searchParams } = new URL(request.url);

  if (searchParams.get("stream") === "1") {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const deliveredIds = new Set<string>();
        let intervalId: ReturnType<typeof setInterval> | null = null;
        let closed = false;

        const flushEvents = async () => {
          const events = await listTaskEvents(taskId);

          for (const event of events) {
            if (deliveredIds.has(event.id)) {
              continue;
            }

            deliveredIds.add(event.id);
            controller.enqueue(encoder.encode(formatSseEvent(toClientEvent(event), "task-event")));
          }
        };

        const close = () => {
          if (closed) {
            return;
          }

          closed = true;

          if (intervalId) {
            clearInterval(intervalId);
          }

          controller.close();
        };

        void flushEvents();
        intervalId = setInterval(() => {
          void flushEvents();
        }, 1000);
        request.signal.addEventListener("abort", close);
      }
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  }

  const events = await listTaskEvents(taskId);

  return NextResponse.json({
    events: events.map((event) => toClientEvent(event))
  });
}
