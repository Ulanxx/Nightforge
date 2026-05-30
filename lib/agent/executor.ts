import { serializeRuntimeEvent } from "@/lib/agent/events";
import { createAgentRuntime, type ApprovedAction } from "@/lib/agent/runtime";
import { taskStatusSchema, type TaskStatus } from "@/lib/domain/task";
import type { Permission } from "@/lib/policy/policy-engine";
import { createEvent } from "@/lib/store/events";
import { createMessage } from "@/lib/store/messages";
import { updateTaskStatus } from "@/lib/store/tasks";

const agentRuntime = createAgentRuntime();

const defaultResumePermissions: Permission[] = ["network", "file.write", "artifact.export"];

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

function extractApprovedCommand(action: ApprovedAction) {
  if (action.tool !== "run_command" || !action.inputJson) {
    return null;
  }

  try {
    const input = JSON.parse(action.inputJson) as { command?: unknown };
    return typeof input.command === "string" ? input.command : null;
  } catch {
    return null;
  }
}

export function buildApprovalResumePrompt(originalPrompt: string, action: ApprovedAction) {
  const command = extractApprovedCommand(action);
  const approvedAction = command
    ? `已批准命令：\`${command}\``
    : `已批准工具动作：${action.tool ?? "未知工具"}，审批编号：${action.approvalId}`;

  return `${originalPrompt}\n\n系统续跑上下文：用户已经批准此前被拦截的受控动作。\n${approvedAction}\n请从这个已批准动作继续完成原任务。只有上述动作已获批准；如果后续需要其他受控动作，仍然必须再次请求确认。`;
}

async function runTaskAndPersist({
  sessionId,
  taskId,
  message,
  permissions,
  approvedActions = [],
  failureMessage
}: {
  sessionId: string;
  taskId: string;
  message: string;
  permissions: Permission[];
  approvedActions?: ApprovedAction[];
  failureMessage: string;
}) {
  try {
    let finalSummary = "";
    let finalStatus: TaskStatus = "completed";
    let approvalWaitSummary: string | null = null;

    for await (const event of agentRuntime.runTask({
      taskId,
      sessionId,
      message,
      permissions,
      approvedActions,
      mode: "full"
    })) {
      if (approvalWaitSummary && event.type === "task.status" && event.status === "completed") {
        continue;
      }

      if (approvalWaitSummary && event.type === "task.finished") {
        continue;
      }

      await createEvent(taskId, event.type, serializeRuntimeEvent(event));

      if (event.type === "approval.required") {
        approvalWaitSummary = `任务等待用户确认：${event.reason}`;
        finalStatus = "awaiting_input";
        finalSummary = approvalWaitSummary;
      }

      if (event.type === "task.status") {
        const nextStatus = taskStatusSchema.parse(event.status);

        if (!approvalWaitSummary || nextStatus === "failed") {
          finalStatus = nextStatus;
        }
      }

      if (event.type === "task.finished") {
        finalSummary = approvalWaitSummary ?? event.summary;
      }
    }

    await updateTaskStatus(taskId, finalStatus, finalSummary);
    await createMessage(sessionId, "assistant", finalSummary);
  } catch (error) {
    const message = error instanceof Error ? error.message : failureMessage;
    await persistTaskFailure(taskId, sessionId, message);
  }
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
  await runTaskAndPersist({
    sessionId,
    taskId,
    message,
    permissions,
    failureMessage: "未知任务执行错误。"
  });
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
  const resumedPrompt = `${originalPrompt}\n\n用户补充信息：\n${clarificationAnswer}`;

  await runTaskAndPersist({
    sessionId,
    taskId,
    message: resumedPrompt,
    permissions: defaultResumePermissions,
    failureMessage: "未知恢复任务错误。"
  });
}

export async function continueTaskAfterApprovalInBackground({
  sessionId,
  taskId,
  originalPrompt,
  approvedAction
}: {
  sessionId: string;
  taskId: string;
  originalPrompt: string;
  approvedAction: ApprovedAction;
}) {
  await runTaskAndPersist({
    sessionId,
    taskId,
    message: buildApprovalResumePrompt(originalPrompt, approvedAction),
    permissions: defaultResumePermissions,
    approvedActions: [approvedAction],
    failureMessage: "未知审批续跑错误。"
  });
}
