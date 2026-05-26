import { prisma } from "@/lib/store/prisma";

export async function listSessions(limit = 20) {
  return prisma.session.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      tasks: {
        orderBy: { updatedAt: "desc" },
        take: 1
      },
      _count: {
        select: {
          messages: true,
          tasks: true
        }
      }
    }
  });
}

export async function getSessionById(sessionId: string) {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      tasks: {
        orderBy: { updatedAt: "desc" }
      },
      sandbox: true,
      _count: {
        select: {
          messages: true,
          tasks: true
        }
      }
    }
  });
}

export async function getOrCreateSession(sessionId: string, title: string) {
  return prisma.session.upsert({
    where: { id: sessionId },
    update: {
      title,
      updatedAt: new Date()
    },
    create: {
      id: sessionId,
      title
    }
  });
}
