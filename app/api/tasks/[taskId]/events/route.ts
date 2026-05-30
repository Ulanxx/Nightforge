import { NextResponse } from "next/server";
import { formatSseEvent } from "@/lib/agent/events";
import { collectUndeliveredTaskEvents, toClientEvent } from "@/lib/api/task-events";
import { listTaskEvents } from "@/lib/store/events";

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
          const events = await collectUndeliveredTaskEvents({
            taskId,
            deliveredIds
          });

          for (const event of events) {
            controller.enqueue(encoder.encode(formatSseEvent(event, "task-event")));
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
