import { prisma } from "@/lib/store/prisma";

export async function createApprovalRequest({
  taskId,
  reason,
  risk,
  tool,
  inputJson
}: {
  taskId: string;
  reason: string;
  risk: string;
  tool?: string;
  inputJson?: string;
}) {
  return prisma.approvalRequest.create({
    data: {
      taskId,
      status: "pending",
      reason,
      risk,
      tool,
      inputJson
    }
  });
}

export async function getApprovalRequestById(approvalId: string) {
  return prisma.approvalRequest.findUnique({
    where: { id: approvalId }
  });
}

export async function listTaskApprovalRequests(taskId: string) {
  return prisma.approvalRequest.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" }
  });
}

export async function resolveApprovalRequest({
  approvalId,
  status
}: {
  approvalId: string;
  status: "approved" | "denied";
}) {
  return prisma.approvalRequest.update({
    where: { id: approvalId },
    data: {
      status,
      resolvedAt: new Date()
    }
  });
}
