import { z } from "zod";
import { buildExecutionPlanSteps, decideClarification, generateExecutionPlan } from "@/lib/agent/planning";
import { runGeneralAgentTask } from "@/lib/agent/general";
import type { Permission } from "@/lib/policy/policy-engine";

const permissionSchema = z.custom<Permission>((value) => typeof value === "string");

export const agentTaskInputSchema = z.object({
  taskId: z.string().optional(),
  sessionId: z.string(),
  message: z.string().min(1),
  permissions: z.array(permissionSchema).default([]),
  mode: z.enum(["full", "plan-only"]).default("full")
});

export type AgentTaskInput = z.infer<typeof agentTaskInputSchema>;

export type AgentRuntimeEvent =
  | { type: "task.started"; taskId: string; message: string }
  | { type: "task.status"; taskId: string; status: string; summary: string }
  | { type: "clarification.requested"; taskId: string; reason: string; questions: string[] }
  | { type: "plan.updated"; taskId: string; steps: string[] }
  | { type: "artifact.created"; taskId: string; artifactId: string; name: string; mimeType: string | null }
  | { type: "tool.started"; taskId: string; tool: string; summary: string }
  | { type: "tool.finished"; taskId: string; tool: string; summary: string }
  | { type: "task.failed"; taskId: string; error: string }
  | { type: "approval.required"; taskId: string; approvalId: string; reason: string }
  | { type: "task.finished"; taskId: string; summary: string };

export interface AgentRuntime {
  runTask(input: AgentTaskInput): AsyncIterable<AgentRuntimeEvent>;
}

export function createAgentRuntime(): AgentRuntime {
  return {
    async *runTask(input) {
      const parsed = agentTaskInputSchema.parse(input);
      const taskId = parsed.taskId ?? crypto.randomUUID();

      try {
        yield {
          type: "task.started",
          taskId,
          message: parsed.message
        };

        yield {
          type: "tool.started",
          taskId,
          tool: "llm.clarification",
          summary: "判断任务是否需要先澄清。"
        };

        const clarification = await decideClarification(parsed.message);

        yield {
          type: "tool.finished",
          taskId,
          tool: "llm.clarification",
          summary: clarification.needsClarification
            ? "任务需要先澄清。"
            : "任务信息足够，可以开始规划。"
        };

        if (clarification.needsClarification && clarification.questions.length > 0) {
          yield {
            type: "task.status",
            taskId,
            status: "clarifying",
            summary: clarification.reason
          };

          yield {
            type: "clarification.requested",
            taskId,
            reason: clarification.reason,
            questions: clarification.questions
          };

          yield {
            type: "task.finished",
            taskId,
            summary: `开始执行前，我需要先澄清：\n${clarification.questions
              .map((question, index) => `${index + 1}. ${question}`)
              .join("\n")}`
          };

          return;
        }

        yield {
          type: "task.status",
          taskId,
          status: "planning",
          summary: clarification.reason
        };

        const plan = await generateExecutionPlan(parsed.message);
        yield {
          type: "plan.updated",
          taskId,
          steps: buildExecutionPlanSteps(plan)
        };

        if (parsed.mode === "full") {
          for await (const event of runGeneralAgentTask({
            sessionId: parsed.sessionId,
            taskId,
            prompt: parsed.message,
            permissions: parsed.permissions
          })) {
            yield event;
          }

          return;
        }

        yield {
          type: "task.finished",
          taskId,
          summary: "任务信息足够，可以继续执行。"
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知运行时错误。";

        yield {
          type: "task.status",
          taskId,
          status: "failed",
          summary: message
        };

        yield {
          type: "task.failed",
          taskId,
          error: message
        };

        yield {
          type: "task.finished",
          taskId,
          summary: `任务无法继续：${message}`
        };
      }
    }
  };
}
