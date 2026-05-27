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
  if (isCommandTool(input.tool) && input.command) {
    if (isDangerousCommand(input.command)) {
      return {
        allowed: false,
        requiresApproval: false,
        risk: "high",
        reason: "命令已被策略拒绝：包含危险或破坏性操作。"
      };
    }

    if (isExternalSideEffectCommand(input.command)) {
      return {
        allowed: false,
        requiresApproval: true,
        risk: "high",
        reason: "该命令可能产生外部副作用，需要用户确认。"
      };
    }

    if (isDependencyInstallCommand(input.command)) {
      return {
        allowed: false,
        requiresApproval: true,
        risk: "medium",
        reason: input.permissions.includes("dependency.install")
          ? "依赖安装属于受控操作，需要用户确认。"
          : "当前任务权限不包含依赖安装，需要用户确认。"
      };
    }

    if (isLongRunningCommand(input.command) || (input.estimatedSeconds && input.estimatedSeconds > 120)) {
      return {
        allowed: false,
        requiresApproval: true,
        risk: "high",
        reason: "长时间运行的命令需要用户确认。"
      };
    }
  }

  if (input.tool === "shell.exec" && input.estimatedSeconds && input.estimatedSeconds > 120) {
    return {
      allowed: false,
      requiresApproval: true,
      risk: "high",
      reason: "长时间运行的 shell 命令需要用户确认。"
    };
  }

  if (input.tool.includes("install") && !input.permissions.includes("dependency.install")) {
    return {
      allowed: false,
      requiresApproval: true,
      risk: "medium",
      reason: "当前任务权限不包含依赖安装。"
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    risk: "low"
  };
}

function isCommandTool(tool: string) {
  return tool === "run_command" || tool === "shell.exec";
}

function isDangerousCommand(command: string) {
  return /\b(rm\s+-rf|sudo|su\b|chmod\s+777|chown\b|mkfs|diskutil|shutdown|reboot|:(){|dd\s+if=|git\s+reset\s+--hard|git\s+clean\s+-fd|drop\s+table)\b/i.test(
    command
  );
}

function isDependencyInstallCommand(command: string) {
  return /\b(npm\s+(install|i)\b|pnpm\s+(install|add)\b|yarn\s+(install|add)\b|bun\s+(install|add)\b|pip(?:3)?\s+install\b|uv\s+pip\s+install\b|brew\s+install\b|apt(?:-get)?\s+install\b)\b/i.test(
    command
  );
}

function isLongRunningCommand(command: string) {
  return /\b(npm\s+run\s+dev\b|next\s+dev\b|vite\b|webpack\s+--watch\b|tail\s+-f\b|sleep\s+\d{2,}\b|while\s+true\b|watch\b)\b/i.test(
    command
  );
}

function isExternalSideEffectCommand(command: string) {
  return /\b(git\s+push\b|npm\s+publish\b|pnpm\s+publish\b|yarn\s+publish\b|vercel\b|netlify\b|flyctl\b|ssh\b|scp\b|rsync\b|curl\b.*\s(-X\s+(POST|PUT|PATCH|DELETE)|--request\s+(POST|PUT|PATCH|DELETE))|gh\s+pr\s+create\b)\b/i.test(
    command
  );
}
