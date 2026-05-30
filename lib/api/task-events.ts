import { parseRuntimeEvent } from "@/lib/agent/events";
import { listTaskEvents } from "@/lib/store/events";

export function toClientEvent(event: Awaited<ReturnType<typeof listTaskEvents>>[number]) {
  return {
    id: event.id,
    type: event.type,
    createdAt: event.createdAt.toISOString(),
    payload: parseRuntimeEvent(event.payload)
  };
}

export async function collectUndeliveredTaskEvents({
  taskId,
  deliveredIds,
  loadEvents = listTaskEvents
}: {
  taskId: string;
  deliveredIds: Set<string>;
  loadEvents?: typeof listTaskEvents;
}) {
  const events = await loadEvents(taskId);

  return events
    .filter((event) => !deliveredIds.has(event.id))
    .map((event) => {
      deliveredIds.add(event.id);
      return toClientEvent(event);
    });
}
