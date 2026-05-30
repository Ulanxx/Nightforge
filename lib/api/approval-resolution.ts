import { NextResponse } from "next/server";
import { dispatchBackgroundRun } from "@/lib/agent/dispatcher";
import { continueTaskAfterApprovalInBackground } from "@/lib/agent/executor";
import { serializeRuntimeEvent } from "@/lib/agent/events";
import { createEvent } from "@/lib/store/events";
import { getApprovalRequestById, resolveApprovalRequest } from "@/lib/store/approvals";
import { getTaskById, updateTaskStatus } from "@/lib/store/tasks";

type ApprovalRouteTask = Awaited<ReturnType<typeof getTaskById>>;
type ApprovalRouteRequest = NonNullable<Awaited<ReturnType<typeof getApprovalRequestById>>>;
type ResumeApprovedTask = (input: {
  task: NonNullable<ApprovalRouteTask>;
  approval: ApprovalRouteRequest;
}) => Promise<void> | void;

export async function dispatchApprovedTaskResume({
  requestUrl,
  task,
  approval
}: {
  requestUrl: string;
  task: NonNullable<ApprovalRouteTask>;
  approval: ApprovalRouteRequest;
}) {
  if (process.env.NODE_ENV === "production") {
    void continueTaskAfterApprovalInBackground({
      sessionId: task.sessionId,
      taskId: task.id,
      originalPrompt: task.prompt,
      approvedAction: {
        approvalId: approval.id,
        tool: approval.tool,
        inputJson: approval.inputJson
      }
    });
    return;
  }

  const approvalRunUrl = new URL("/api/internal/tasks/approval", requestUrl).toString();

  dispatchBackgroundRun(approvalRunUrl, {
    sessionId: task.sessionId,
    taskId: task.id,
    originalPrompt: task.prompt,
    approvalId: approval.id,
    tool: approval.tool,
    inputJson: approval.inputJson
  });
}

export async function resolveApprovalRoute(
  approvalId: string,
  status: "approved" | "denied",
  deps: {
    getApprovalRequestById: typeof getApprovalRequestById;
    resolveApprovalRequest: typeof resolveApprovalRequest;
    createEvent: typeof createEvent;
    getTaskById: typeof getTaskById;
    updateTaskStatus: typeof updateTaskStatus;
    resumeApprovedTask?: ResumeApprovedTask;
  } = {
    getApprovalRequestById,
    resolveApprovalRequest,
    createEvent,
    getTaskById,
    updateTaskStatus
  }
) {
  const approval = await deps.getApprovalRequestById(approvalId);

  if (!approval) {
    return NextResponse.json({ error: "未找到审批请求。" }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json({ error: "该审批请求已处理。" }, { status: 409 });
  }

  await deps.resolveApprovalRequest({ approvalId, status });

  const task = await deps.getTaskById(approval.taskId);

  await deps.createEvent(
    approval.taskId,
    "approval.resolved",
    serializeRuntimeEvent({
      type: "approval.resolved",
      taskId: approval.taskId,
      approvalId,
      status,
      reason: `${status === "approved" ? "已批准" : "已拒绝"}：${approval.reason}`
    })
  );

  if (task) {
    const summary =
      status === "approved"
        ? `已批准受控操作，正在继续执行：${approval.reason}`
        : `已拒绝受控操作，任务等待新的补充指令：${approval.reason}`;

    await deps.updateTaskStatus(task.id, status === "approved" ? "planning" : "awaiting_input", summary);

    if (status === "approved" && deps.resumeApprovedTask) {
      await deps.resumeApprovedTask({ task, approval });
    }
  }

  return NextResponse.json({ ok: true });
}
