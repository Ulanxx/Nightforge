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
  const existing = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true }
  });

  if (existing) {
    return prisma.session.update({
      where: { id: sessionId },
      data: {
        updatedAt: new Date()
      }
    });
  }

  return prisma.session.create({
    data: {
      id: sessionId,
      title
    }
  });
}

export async function touchSession(sessionId: string) {
  return prisma.session.update({
    where: { id: sessionId },
    data: {
      updatedAt: new Date()
    }
  });
}
