import { dispatchApprovedTaskResume, resolveApprovalRoute } from "@/lib/api/approval-resolution";
import { createEvent } from "@/lib/store/events";
import { getApprovalRequestById, resolveApprovalRequest } from "@/lib/store/approvals";
import { getTaskById, updateTaskStatus } from "@/lib/store/tasks";

export async function POST(request: Request, context: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = await context.params;
  return resolveApprovalRoute(approvalId, "approved", {
    getApprovalRequestById,
    resolveApprovalRequest,
    createEvent,
    getTaskById,
    updateTaskStatus,
    resumeApprovedTask: ({ task, approval }) => dispatchApprovedTaskResume({ requestUrl: request.url, task, approval })
  });
}
