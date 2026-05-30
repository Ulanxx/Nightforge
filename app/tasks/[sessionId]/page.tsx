import { notFound } from "next/navigation";
import { Workspace } from "@/app/workspace";
import { getSessionWorkspaceData } from "@/lib/workspace-view";
import { getSessionById } from "@/lib/store/sessions";

type TaskPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    taskId?: string;
  }>;
};

export default async function TaskPage({ params, searchParams }: TaskPageProps) {
  const { sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await getSessionById(sessionId);

  if (!session) {
    notFound();
  }

  const data = await getSessionWorkspaceData(sessionId, resolvedSearchParams?.taskId ?? null);

  return <Workspace key={`${sessionId}:${data.activeTaskId ?? "none"}`} {...data} />;
}
