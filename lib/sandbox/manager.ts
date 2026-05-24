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
        return existing;
      }

      const sandbox: ManagedSandbox = {
        sandboxId: `local-placeholder-${crypto.randomUUID()}`,
        sessionId,
        status: "ready",
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      inMemorySandboxes.set(sessionId, sandbox);
      return sandbox;
    },
    async reset(sessionId) {
      inMemorySandboxes.delete(sessionId);
      return this.getOrCreate(sessionId);
    }
  };
}
