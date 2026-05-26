import { prisma } from "@/lib/store/prisma";

export async function createTask(sessionId: string, prompt: string, status: string) {
  return prisma.task.create({
    data: {
      sessionId,
      prompt,
      status
    }
  });
}

export async function updateTaskStatus(taskId: string, status: string, summary?: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      ...(summary ? { summary } : {})
    }
  });
}

export async function getTaskWithRelations(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: {
      toolCalls: {
        orderBy: { createdAt: "asc" }
      },
      approvals: {
        orderBy: { createdAt: "asc" }
      },
      events: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export async function listSessionTasks(sessionId: string) {
  return prisma.task.findMany({
    where: { sessionId },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getTaskById(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId }
  });
}
