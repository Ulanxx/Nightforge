import { z } from "zod";
import { decideClarification } from "@/lib/agent/planning";
import { runGeneralAgentTask } from "@/lib/agent/general";

export const agentTaskInputSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1),
  permissions: z.array(z.string()).default([]),
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
      const taskId = crypto.randomUUID();

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
          summary: "Check whether the task needs clarification before research begins."
        };

        const clarification = await decideClarification(parsed.message);

        yield {
          type: "tool.finished",
          taskId,
          tool: "llm.clarification",
          summary: clarification.needsClarification
            ? "Task needs clarification before planning."
            : "Task is specific enough to start planning."
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
            summary: `Before I start research, I need to clarify:\n${clarification.questions
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

        if (parsed.mode === "full") {
          for await (const event of runGeneralAgentTask({
            sessionId: parsed.sessionId,
            taskId,
            prompt: parsed.message
          })) {
            yield event;
          }

          return;
        }

        yield {
          type: "task.finished",
          taskId,
          summary: "Task is specific enough to continue planning."
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown runtime error.";

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
          summary: `Task could not continue: ${message}`
        };
      }
    }
  };
}
