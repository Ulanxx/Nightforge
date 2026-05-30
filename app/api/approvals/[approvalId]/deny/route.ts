import { resolveApprovalRoute } from "@/lib/api/approval-resolution";

export async function POST(_: Request, context: { params: Promise<{ approvalId: string }> }) {
  const { approvalId } = await context.params;
  return resolveApprovalRoute(approvalId, "denied");
}
