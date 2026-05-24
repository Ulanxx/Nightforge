export type Permission =
  | "network"
  | "file.write"
  | "dependency.install"
  | "command.longRunning"
  | "upload.read"
  | "artifact.export";

export type RiskLevel = "low" | "medium" | "high";

export interface PolicyCheck {
  allowed: boolean;
  requiresApproval: boolean;
  risk: RiskLevel;
  reason?: string;
}

export interface ToolPolicyInput {
  tool: string;
  permissions: Permission[];
  command?: string;
  estimatedSeconds?: number;
}

export function checkToolPolicy(input: ToolPolicyInput): PolicyCheck {
  if (input.tool === "shell.exec" && input.estimatedSeconds && input.estimatedSeconds > 120) {
    return {
      allowed: false,
      requiresApproval: true,
      risk: "high",
      reason: "Long-running shell commands require confirmation."
    };
  }

  if (input.tool.includes("install") && !input.permissions.includes("dependency.install")) {
    return {
      allowed: false,
      requiresApproval: true,
      risk: "medium",
      reason: "Dependency installation is outside the current task permissions."
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    risk: "low"
  };
}
