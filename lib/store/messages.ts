import { prisma } from "@/lib/store/prisma";

export async function listSessionMessages(sessionId: string) {
  return prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" }
  });
}

export async function createMessage(sessionId: string, role: string, content: string) {
  return prisma.message.create({
    data: {
      sessionId,
      role,
      content
    }
  });
}
