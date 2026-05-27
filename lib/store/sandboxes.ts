import type { SandboxStatus } from "@/lib/sandbox/manager";
import { prisma } from "@/lib/store/prisma";
import { touchSession } from "@/lib/store/sessions";

export async function getSandboxBySessionId(sessionId: string) {
  return prisma.sandbox.findUnique({
    where: { sessionId }
  });
}

export async function upsertSandbox({
  sessionId,
  sandboxId,
  status,
  expiresAt
}: {
  sessionId: string;
  sandboxId: string;
  status: SandboxStatus;
  expiresAt?: Date;
}) {
  const sandbox = await prisma.sandbox.upsert({
    where: { sessionId },
    update: {
      sandboxId,
      status,
      lastUsedAt: new Date(),
      ...(expiresAt ? { expiresAt } : {})
    },
    create: {
      sessionId,
      sandboxId,
      status,
      ...(expiresAt ? { expiresAt } : {})
    }
  });

  await touchSession(sessionId);

  return sandbox;
}

export async function touchSandbox(sessionId: string) {
  const sandbox = await prisma.sandbox.update({
    where: { sessionId },
    data: {
      lastUsedAt: new Date()
    }
  });

  await touchSession(sessionId);

  return sandbox;
}
