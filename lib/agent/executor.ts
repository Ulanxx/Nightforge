import { serializeRuntimeEvent } from "@/lib/agent/events";
import { continueTaskWithClarification } from "@/lib/agent/resume";
import { createAgentRuntime } from "@/lib/agent/runtime";
import { createEvent } from "@/lib/store/events";
import { createMessage } from "@/lib/store/messages";
import { updateTaskStatus } from "@/lib/store/tasks";

const agentRuntime = createAgentRuntime();

async function persistTaskFailure(taskId: string, sessionId: string, message: string) {
  const failureEvents = [
    {
      type: "task.status" as const,
      taskId,
      status: "failed",
      summary: message
    },
    {
      type: "task.failed" as const,
      taskId,
      error: message
    },
    {
      type: "task.finished" as const,
      taskId,
      summary: `Task could not continue: ${message}`
    }
  ];

  for (const event of failureEvents) {
    await createEvent(taskId, event.type, serializeRuntimeEvent(event));
  }

  await updateTaskStatus(taskId, "failed", `Task could not continue: ${message}`);
  await createMessage(sessionId, "assistant", `Task could not continue: ${message}`);
}

export async function executeTaskInBackground({
  sessionId,
  taskId,
  message,
  permissions
}: {
  sessionId: string;
  taskId: string;
  message: string;
  permissions: string[];
}) {
  try {
    let finalSummary = "";
    let finalStatus = "completed";

    for await (const rawEvent of agentRuntime.runTask({
      sessionId,
      message,
      permissions,
      mode: "full"
    })) {
      const event = {
        ...rawEvent,
        taskId
      };

      await createEvent(taskId, event.type, serializeRuntimeEvent(event));

      if (event.type === "task.status") {
        finalStatus = event.status;
      }

      if (event.type === "task.finished") {
        finalSummary = event.summary;
      }
    }

    await updateTaskStatus(taskId, finalStatus, finalSummary);
    await createMessage(sessionId, "assistant", finalSummary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown task execution error.";
    await persistTaskFailure(taskId, sessionId, message);
  }
}

export async function continueTaskInBackground({
  sessionId,
  taskId,
  originalPrompt,
  clarificationAnswer
}: {
  sessionId: string;
  taskId: string;
  originalPrompt: string;
  clarificationAnswer: string;
}) {
  try {
    let finalSummary = "";
    let finalStatus = "planning";

    for await (const event of continueTaskWithClarification({
      sessionId,
      taskId,
      originalPrompt,
      clarificationAnswer
    })) {
      await createEvent(taskId, event.type, serializeRuntimeEvent(event));

      if (event.type === "task.status") {
        finalStatus = event.status;
      }

      if (event.type === "task.finished") {
        finalSummary = event.summary;
      }
    }

    await updateTaskStatus(taskId, finalStatus, finalSummary);
    await createMessage(sessionId, "assistant", finalSummary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown resume error.";
    await persistTaskFailure(taskId, sessionId, message);
  }
}
