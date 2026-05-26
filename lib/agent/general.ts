import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent, LocalShellBackend } from "deepagents";
import { z } from "zod";
import type { AgentRuntimeEvent } from "@/lib/agent/runtime";
import { createArtifact } from "@/lib/store/artifacts";

const execFileAsync = promisify(execFile);

type QueuedEvent =
  | { kind: "event"; event: AgentRuntimeEvent }
  | { kind: "done"; summary: string }
  | { kind: "error"; error: Error };

class AsyncEventQueue {
  private items: QueuedEvent[] = [];
  private resolvers: Array<(value: QueuedEvent) => void> = [];

  push(item: QueuedEvent) {
    const resolver = this.resolvers.shift();

    if (resolver) {
      resolver(item);
      return;
    }

    this.items.push(item);
  }

  next() {
    const item = this.items.shift();

    if (item) {
      return Promise.resolve(item);
    }

    return new Promise<QueuedEvent>((resolve) => {
      this.resolvers.push(resolve);
    });
  }
}

function createOpenRouterChatModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  const baseURL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  if (!model) {
    throw new Error("OPENROUTER_MODEL is not configured.");
  }

  return new ChatOpenAI({
    model,
    apiKey,
    temperature: 0.2,
    configuration: {
      baseURL
    }
  });
}

function summarizeToolValue(value: unknown) {
  if (typeof value === "string") {
    return value.slice(0, 600);
  }

  return JSON.stringify(value).slice(0, 600);
}

function extractFinalSummary(output: unknown) {
  if (!output || typeof output !== "object") {
    return "Task completed.";
  }

  const messages = (output as { messages?: unknown }).messages;

  if (!Array.isArray(messages)) {
    return "Task completed.";
  }

  const lastMessage = [...messages].reverse().find((message) => {
    if (!message || typeof message !== "object") {
      return false;
    }

    const type = (message as { _getType?: () => string })._getType?.();
    return type === "ai" || "content" in message;
  });

  const content = lastMessage && typeof lastMessage === "object" ? (lastMessage as { content?: unknown }).content : null;

  if (typeof content === "string") {
    return content.trim() || "Task completed.";
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "Task completed.";
}

async function writeArtifactFile(sessionId: string, taskId: string, name: string, content: string) {
  const artifactDir = path.join(process.cwd(), ".artifacts", sessionId);
  await mkdir(artifactDir, { recursive: true });

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+/, "") || `${taskId}-artifact.md`;
  const filename = safeName.includes(".") ? safeName : `${safeName}.md`;
  const storagePath = path.join(artifactDir, filename);
  await writeFile(storagePath, content, "utf8");

  return {
    filename,
    storagePath
  };
}

function isDangerousCommand(command: string) {
  return /\b(rm\s+-rf|sudo|su\b|chmod\s+777|chown\b|mkfs|diskutil|shutdown|reboot|:(){|dd\s+if=|git\s+reset\s+--hard|git\s+clean\s+-fd|DROP\s+TABLE)\b/i.test(
    command
  );
}

async function runSafeCommand(command: string) {
  if (isDangerousCommand(command)) {
    return "Command refused because it matches a dangerous operation policy.";
  }

  try {
    const { stdout, stderr } = await execFileAsync("zsh", ["-lc", command], {
      cwd: process.cwd(),
      timeout: 20_000,
      maxBuffer: 200_000,
      env: {
        ...process.env,
        CI: "1"
      }
    });

    return [stdout, stderr ? `[stderr]\n${stderr}` : ""].filter(Boolean).join("\n").slice(0, 6000);
  } catch (error) {
    if (error && typeof error === "object") {
      const output = [
        "Command failed.",
        "stdout" in error && typeof error.stdout === "string" ? error.stdout : "",
        "stderr" in error && typeof error.stderr === "string" ? error.stderr : ""
      ]
        .filter(Boolean)
        .join("\n");

      return output.slice(0, 6000);
    }

    return "Command failed with an unknown error.";
  }
}

export async function* runGeneralAgentTask({
  sessionId,
  taskId,
  prompt
}: {
  sessionId: string;
  taskId: string;
  prompt: string;
}): AsyncIterable<AgentRuntimeEvent> {
  yield {
    type: "task.status",
    taskId,
    status: "working",
    summary: "General agent started. It can inspect files, search, write, run safe commands, and create artifacts."
  };

  const backend = await LocalShellBackend.create({
    rootDir: process.cwd(),
    virtualMode: true,
    timeout: 20,
    maxOutputBytes: 80_000,
    inheritEnv: true
  });

  const createArtifactTool = tool(
    async ({ name, content }) => {
      const artifactFile = await writeArtifactFile(sessionId, taskId, name, content);
      const artifact = await createArtifact({
        sessionId,
        taskId,
        name: artifactFile.filename,
        mimeType: "text/markdown; charset=utf-8",
        storagePath: artifactFile.storagePath
      });

      return JSON.stringify({
        artifactId: artifact.id,
        name: artifact.name,
        mimeType: artifact.mimeType
      });
    },
    {
      name: "create_artifact",
      description: "Persist a final user-facing markdown artifact for this task.",
      schema: z.object({
        name: z.string().min(1),
        content: z.string().min(1)
      })
    }
  );

  const runCommandTool = tool(
    async ({ command }) => runSafeCommand(command),
    {
      name: "run_command",
      description:
        "Run a short, safe project-local shell command. Use for inspection, tests, builds, and simple generated-output checks.",
      schema: z.object({
        command: z.string().min(1)
      })
    }
  );

  const agent = createDeepAgent({
    model: createOpenRouterChatModel(),
    backend,
    tools: [createArtifactTool, runCommandTool],
    permissions: [
      { operations: ["read", "write"], paths: ["/**"] }
    ],
    systemPrompt:
      "You are a general-purpose project agent, similar to a Manus-style worker. Use the built-in filesystem tools to inspect, grep, read, write, and edit files. Use run_command only for safe, project-local commands. When the user asks for a durable deliverable, call create_artifact with a clear markdown result. Keep the final answer concise and mention important files changed or artifacts created."
  });

  const queue = new AsyncEventQueue();

  void (async () => {
    try {
      const run = await agent.streamEvents(
        {
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        },
        {
          version: "v3",
          recursionLimit: 80
        }
      );

      void (async () => {
        for await (const call of run.toolCalls as AsyncIterable<{
          name: string;
          input: unknown;
          output: Promise<unknown>;
          status?: Promise<unknown> | unknown;
        }>) {
          const input = await Promise.resolve(call.input);

          queue.push({
            kind: "event",
            event: {
              type: "tool.started",
              taskId,
              tool: call.name,
              summary: summarizeToolValue(input)
            }
          });

          const output = await call.output;

          queue.push({
            kind: "event",
            event: {
              type: "tool.finished",
              taskId,
              tool: call.name,
              summary: summarizeToolValue(output)
            }
          });

          if (call.name === "create_artifact") {
            try {
              const parsed = typeof output === "string" ? JSON.parse(output) : output;

              if (parsed && typeof parsed === "object") {
                const artifact = parsed as { artifactId?: unknown; name?: unknown; mimeType?: unknown };

                if (typeof artifact.artifactId === "string" && typeof artifact.name === "string") {
                  queue.push({
                    kind: "event",
                    event: {
                      type: "artifact.created",
                      taskId,
                      artifactId: artifact.artifactId,
                      name: artifact.name,
                      mimeType: typeof artifact.mimeType === "string" ? artifact.mimeType : null
                    }
                  });
                }
              }
            } catch {
              // The tool output is still shown in tool.finished.
            }
          }
        }
      })();

      const output = await run.output;
      const summary = extractFinalSummary(output);
      queue.push({ kind: "done", summary });
    } catch (error) {
      queue.push({
        kind: "error",
        error: error instanceof Error ? error : new Error("Unknown general agent error.")
      });
    }
  })();

  while (true) {
    const item = await queue.next();

    if (item.kind === "event") {
      yield item.event;
      continue;
    }

    if (item.kind === "error") {
      throw item.error;
    }

    yield {
      type: "task.status",
      taskId,
      status: "completed",
      summary: "General agent task completed."
    };

    yield {
      type: "task.finished",
      taskId,
      summary: item.summary
    };

    await backend.close();
    return;
  }
}
