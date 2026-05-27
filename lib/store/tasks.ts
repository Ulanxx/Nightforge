import type { TaskStatus } from "@/lib/domain/task";
import { prisma } from "@/lib/store/prisma";
import { touchSession } from "@/lib/store/sessions";

export async function createTask(sessionId: string, prompt: string, status: TaskStatus) {
  const task = await prisma.task.create({
    data: {
      sessionId,
      prompt,
      status
    }
  });

  await touchSession(sessionId);

  return task;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, summary?: string) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      ...(summary ? { summary } : {})
    }
  });

  await touchSession(task.sessionId);

  return task;
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
