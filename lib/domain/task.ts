import { z } from "zod";

export const taskStatusValues = [
  "planning",
  "clarifying",
  "executing",
  "awaiting_input",
  "completed",
  "failed"
] as const;

export const terminalTaskStatuses = ["completed", "failed"] as const;
export const nonRunningTaskStatuses = [...terminalTaskStatuses, "clarifying", "awaiting_input"] as const;

export const taskStatusSchema = z.enum(taskStatusValues);
export const messageRoleSchema = z.enum(["user", "assistant", "system"]);

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const statusLabels: Record<TaskStatus | "idle", string> = {
  idle: "空闲",
  planning: "规划中",
  executing: "执行中",
  clarifying: "待补充",
  awaiting_input: "待补充",
  completed: "已完成",
  failed: "失败"
};

export function displayTaskStatus(status: string | null | undefined) {
  if (!status) {
    return statusLabels.idle;
  }

  return statusLabels[status as TaskStatus] ?? status;
}
