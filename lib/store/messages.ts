import { prisma } from "@/lib/store/prisma";
import type { MessageRole } from "@/lib/domain/task";
import { touchSession } from "@/lib/store/sessions";

export async function listSessionMessages(sessionId: string) {
  return prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" }
  });
}

export async function createMessage(sessionId: string, role: MessageRole, content: string) {
  const message = await prisma.message.create({
    data: {
      sessionId,
      role,
      content
    }
  });

  await touchSession(sessionId);

  return message;
}
