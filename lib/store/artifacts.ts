import { prisma } from "@/lib/store/prisma";

export async function listSessionArtifacts(sessionId: string) {
  return prisma.artifact.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" }
  });
}

export async function createArtifact({
  sessionId,
  taskId,
  name,
  mimeType,
  storagePath
}: {
  sessionId: string;
  taskId: string;
  name: string;
  mimeType: string;
  storagePath: string;
}) {
  return prisma.artifact.create({
    data: {
      sessionId,
      taskId,
      name,
      mimeType,
      storagePath
    }
  });
}
