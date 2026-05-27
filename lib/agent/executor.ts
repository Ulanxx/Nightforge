import { serializeRuntimeEvent } from "@/lib/agent/events";
import { createAgentRuntime } from "@/lib/agent/runtime";
import { taskStatusSchema, type TaskStatus } from "@/lib/domain/task";
import type { Permission } from "@/lib/policy/policy-engine";
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
      summary: `任务无法继续：${message}`
    }
  ];

  for (const event of failureEvents) {
    await createEvent(taskId, event.type, serializeRuntimeEvent(event));
  }

  await updateTaskStatus(taskId, "failed", `任务无法继续：${message}`);
  await createMessage(sessionId, "assistant", `任务无法继续：${message}`);
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
  permissions: Permission[];
}) {
  try {
    let finalSummary = "";
    let finalStatus: TaskStatus = "completed";

    for await (const rawEvent of agentRuntime.runTask({
      taskId,
      sessionId,
      message,
      permissions,
      mode: "full"
    })) {
      const event = rawEvent;

      await createEvent(taskId, event.type, serializeRuntimeEvent(event));

      if (event.type === "task.status") {
        finalStatus = taskStatusSchema.parse(event.status);
      }

      if (event.type === "task.finished") {
        finalSummary = event.summary;
      }
    }

    await updateTaskStatus(taskId, finalStatus, finalSummary);
    await createMessage(sessionId, "assistant", finalSummary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知任务执行错误。";
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
    let finalStatus: TaskStatus = "completed";
    const resumedPrompt = `${originalPrompt}\n\n用户补充信息：\n${clarificationAnswer}`;

    for await (const event of agentRuntime.runTask({
      taskId,
      sessionId,
      message: resumedPrompt,
      permissions: ["network", "file.write", "artifact.export"],
      mode: "full"
    })) {
      await createEvent(taskId, event.type, serializeRuntimeEvent(event));

      if (event.type === "task.status") {
        finalStatus = taskStatusSchema.parse(event.status);
      }

      if (event.type === "task.finished") {
        finalSummary = event.summary;
      }
    }

    await updateTaskStatus(taskId, finalStatus, finalSummary);
    await createMessage(sessionId, "assistant", finalSummary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知恢复任务错误。";
    await persistTaskFailure(taskId, sessionId, message);
  }
}
