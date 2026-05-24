import { z } from "zod";

export const agentTaskInputSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1),
  permissions: z.array(z.string()).default([])
});

export type AgentTaskInput = z.infer<typeof agentTaskInputSchema>;

export type AgentRuntimeEvent =
  | { type: "task.started"; taskId: string; message: string }
  | { type: "plan.updated"; taskId: string; steps: string[] }
  | { type: "tool.started"; taskId: string; tool: string; summary: string }
  | { type: "tool.finished"; taskId: string; tool: string; summary: string }
  | { type: "approval.required"; taskId: string; approvalId: string; reason: string }
  | { type: "task.finished"; taskId: string; summary: string };

export interface AgentRuntime {
  runTask(input: AgentTaskInput): AsyncIterable<AgentRuntimeEvent>;
}

export function createAgentRuntime(): AgentRuntime {
  return {
    async *runTask(input) {
      const parsed = agentTaskInputSchema.parse(input);
      const taskId = crypto.randomUUID();

      yield {
        type: "task.started",
        taskId,
        message: parsed.message
      };

      yield {
        type: "plan.updated",
        taskId,
        steps: ["Check permissions", "Prepare sandbox workspace", "Execute tools", "Collect artifacts"]
      };

      yield {
        type: "task.finished",
        taskId,
        summary: "Runtime scaffold is ready. DeepAgents tool loop will be wired in the next milestone."
      };
    }
  };
}
