import { getSandboxBySessionId, touchSandbox, upsertSandbox } from "@/lib/store/sandboxes";

export type SandboxStatus = "creating" | "ready" | "expired" | "error";

export interface ManagedSandbox {
  sandboxId: string;
  sessionId: string;
  status: SandboxStatus;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt?: Date;
}

export interface SandboxManager {
  getOrCreate(sessionId: string): Promise<ManagedSandbox>;
  reset(sessionId: string): Promise<ManagedSandbox>;
}

const inMemorySandboxes = new Map<string, ManagedSandbox>();

export function createSandboxManager(): SandboxManager {
  return {
    async getOrCreate(sessionId) {
      const existing = inMemorySandboxes.get(sessionId);

      if (existing?.status === "ready") {
        existing.lastUsedAt = new Date();
        await touchSandbox(sessionId).catch(() => undefined);
        return existing;
      }

      const persisted = await getSandboxBySessionId(sessionId);

      if (persisted?.status === "ready") {
        const sandbox: ManagedSandbox = {
          sandboxId: persisted.sandboxId,
          sessionId,
          status: persisted.status as SandboxStatus,
          createdAt: persisted.createdAt,
          lastUsedAt: new Date(),
          expiresAt: persisted.expiresAt ?? undefined
        };

        inMemorySandboxes.set(sessionId, sandbox);
        await touchSandbox(sessionId);
        return sandbox;
      }

      const sandbox: ManagedSandbox = {
        sandboxId: `local-placeholder-${crypto.randomUUID()}`,
        sessionId,
        status: "ready",
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      inMemorySandboxes.set(sessionId, sandbox);
      await upsertSandbox({
        sessionId,
        sandboxId: sandbox.sandboxId,
        status: sandbox.status,
        expiresAt: sandbox.expiresAt
      });
      return sandbox;
    },
    async reset(sessionId) {
      inMemorySandboxes.delete(sessionId);
      const sandbox: ManagedSandbox = {
        sandboxId: `local-placeholder-${crypto.randomUUID()}`,
        sessionId,
        status: "ready",
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      inMemorySandboxes.set(sessionId, sandbox);
      await upsertSandbox({
        sessionId,
        sandboxId: sandbox.sandboxId,
        status: sandbox.status,
        expiresAt: sandbox.expiresAt
      });
      return sandbox;
    }
  };
}
