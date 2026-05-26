import { runDeepAgentsResearchTask } from "@/lib/agent/deepagents";
import type { AgentRuntimeEvent } from "@/lib/agent/runtime";

export async function* continueTaskWithClarification({
  sessionId,
  taskId,
  originalPrompt,
  clarificationAnswer
}: {
  sessionId: string;
  taskId: string;
  originalPrompt: string;
  clarificationAnswer: string;
}): AsyncIterable<AgentRuntimeEvent> {
  const combinedPrompt = `${originalPrompt}\n\nClarification from user:\n${clarificationAnswer}`;

  yield {
    type: "task.status",
    taskId,
    status: "planning",
    summary: "Clarification received. Generating research plan."
  };

  for await (const event of runDeepAgentsResearchTask({
    sessionId,
    taskId,
    prompt: combinedPrompt
  })) {
    yield event;
  }
}
