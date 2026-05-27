import { prisma } from "@/lib/store/prisma";

export async function createApprovalRequest({
  taskId,
  reason,
  risk
}: {
  taskId: string;
  reason: string;
  risk: string;
}) {
  return prisma.approvalRequest.create({
    data: {
      taskId,
      status: "pending",
      reason,
      risk
    }
  });
}
