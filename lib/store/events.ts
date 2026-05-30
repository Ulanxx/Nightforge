import { prisma } from "@/lib/store/prisma";

export async function createEvent(taskId: string, type: string, payload: string) {
  return prisma.eventLog.create({
    data: {
      taskId,
      type,
      payload
    }
  });
}

export async function listTaskEvents(taskId: string) {
  return prisma.eventLog.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" }
  });
}
