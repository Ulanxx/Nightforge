import { parseRuntimeEvent } from "@/lib/agent/events";
import { Workspace } from "@/app/workspace";
import { listSessionArtifacts } from "@/lib/store/artifacts";
import { listSessionMessages } from "@/lib/store/messages";
import { listSessions } from "@/lib/store/sessions";
import { listSessionTasks } from "@/lib/store/tasks";
import { prisma } from "@/lib/store/prisma";

type HomeProps = {
  searchParams?: Promise<{
    sessionId?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sessions = await listSessions();
  const activeSessionId = resolvedSearchParams?.sessionId ?? sessions[0]?.id ?? null;

  const [messages, tasks, artifacts] = activeSessionId
    ? await Promise.all([
        listSessionMessages(activeSessionId),
        listSessionTasks(activeSessionId),
        listSessionArtifacts(activeSessionId)
      ])
    : [[], [], []];

  const latestTaskId = tasks[0]?.id;
  const rawEvents = latestTaskId
    ? await prisma.eventLog.findMany({
        where: { taskId: latestTaskId },
        orderBy: { createdAt: "asc" }
      })
    : [];

  return (
    <Workspace
      activeTaskId={latestTaskId ?? null}
      activeTaskStatus={tasks[0]?.status ?? null}
      activeSessionId={activeSessionId}
      artifacts={artifacts}
      events={rawEvents.map((event) => ({
        id: event.id,
        type: event.type,
        createdAt: event.createdAt.toISOString(),
        payload: parseRuntimeEvent(event.payload)
      }))}
      messages={messages.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString()
      }))}
      sessions={sessions.map((session) => ({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt.toISOString(),
        tasks: session.tasks.map((task) => ({
          status: task.status
        }))
      }))}
    />
  );
}
