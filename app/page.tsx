import { redirect } from "next/navigation";
import { HomeShell } from "@/app/home-shell";
import { listSessionSummaries } from "@/lib/workspace-view";

type HomeProps = {
  searchParams?: Promise<{
    sessionId?: string;
    taskId?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (resolvedSearchParams?.sessionId) {
    const taskQuery = resolvedSearchParams.taskId ? `?taskId=${resolvedSearchParams.taskId}` : "";
    redirect(`/tasks/${resolvedSearchParams.sessionId}${taskQuery}`);
  }

  const sessions = await listSessionSummaries();

  return <HomeShell sessions={sessions} />;
}
