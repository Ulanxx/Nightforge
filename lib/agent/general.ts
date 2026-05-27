import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { z } from "zod";
import { getOpenRouterEnv } from "@/lib/config/env";
import type { AgentRuntimeEvent } from "@/lib/agent/runtime";
import { fetchSourceContent, selectWebSources } from "@/lib/agent/web-input";
import type { Permission } from "@/lib/policy/policy-engine";
import { checkToolPolicy } from "@/lib/policy/policy-engine";
import { createApprovalRequest } from "@/lib/store/approvals";
import { createArtifact } from "@/lib/store/artifacts";

const execFileAsync = promisify(execFile);

type QueuedEvent =
  | { kind: "event"; event: AgentRuntimeEvent }
  | { kind: "done"; summary: string; artifacts: Array<{ id: string; name: string; mimeType: string | null }> }
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
  const { apiKey, model, baseUrl } = getOpenRouterEnv();

  return new ChatOpenAI({
    model,
    apiKey,
    temperature: 0.2,
    configuration: {
      baseURL: baseUrl
    }
  });
}

function summarizeToolValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length > 0) {
      try {
        return summarizeToolValue(JSON.parse(trimmed));
      } catch {
        return value.slice(0, 600);
      }
    }

    return value.slice(0, 600);
  }

  try {
    const parsed = value as Record<string, unknown>;
    const parts: string[] = [];

    if (typeof parsed.path === "string") {
      parts.push(`路径：${parsed.path}`);
    }

    if (typeof parsed.pattern === "string") {
      parts.push(`搜索：${parsed.pattern}`);
    }

    if (typeof parsed.command === "string") {
      parts.push(`命令：${parsed.command}`);
    }

    if (typeof parsed.url === "string") {
      parts.push(`网址：${parsed.url}`);
    }

    if (typeof parsed.name === "string") {
      parts.push(`名称：${parsed.name}`);
    }

    if (typeof parsed.content === "string") {
      parts.push(`内容：${parsed.content.slice(0, 160)}`);
    }

    if (typeof parsed.artifactId === "string") {
      parts.push(`产物编号：${parsed.artifactId}`);
    }

    if (typeof parsed.mimeType === "string") {
      parts.push(`类型：${parsed.mimeType}`);
    }

    if (Array.isArray(parsed.sources)) {
      parts.push(`来源数：${parsed.sources.length}`);
    }

    if (parts.length > 0) {
      return parts.join("，").slice(0, 600);
    }
  } catch {
    return "工具返回了无法展示的结构化结果。";
  }

  return JSON.stringify(value).slice(0, 600);
}

function extractFinalSummary(output: unknown) {
  if (!output || typeof output !== "object") {
    return "任务已完成。";
  }

  const messages = (output as { messages?: unknown }).messages;

  if (!Array.isArray(messages)) {
    return "任务已完成。";
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
    return content.trim() || "任务已完成。";
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

  return "任务已完成。";
}

function ensureChineseSummary(summary: string) {
  const trimmed = summary.trim();

  if (!trimmed) {
    return "任务已完成。";
  }

  if (/[\u4e00-\u9fff]/.test(trimmed)) {
    return trimmed;
  }

  return "任务已完成。已读取相关上下文并完成执行。详细过程请查看工具活动和事件记录。";
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

async function runSafeCommand(command: string) {
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
        "命令执行失败。",
        "stdout" in error && typeof error.stdout === "string" ? error.stdout : "",
        "stderr" in error && typeof error.stderr === "string" ? error.stderr : ""
      ]
        .filter(Boolean)
        .join("\n");

      return output.slice(0, 6000);
    }

    return "命令执行失败，原因未知。";
  }
}

type DeliveryMode = "reply" | "artifact" | "mixed";

function decideDeliveryMode(prompt: string): { mode: DeliveryMode; reason: string } {
  const normalized = prompt.toLowerCase();

  if (/(只回复|不要产物|无需产物|直接回答)/.test(prompt)) {
    return {
      mode: "reply",
      reason: "任务明确要求直接回复。"
    };
  }

  if (/(只生成|只要).*?(产物|文档|报告|markdown|文件)/i.test(prompt)) {
    return {
      mode: "artifact",
      reason: "任务明确要求只交付文件或产物。"
    };
  }

  if (
    /(产物|文档|报告|markdown|说明文|清单|表格|交付)/.test(prompt) ||
    /(artifact|document|report|markdown|checklist|table)/.test(normalized)
  ) {
    return {
      mode: "mixed",
      reason: "任务包含可复用交付物，适合同时返回摘要与产物。"
    };
  }

  return {
    mode: "reply",
    reason: "任务更适合直接在线程中回复。"
  };
}

function buildArtifactName(prompt: string) {
  const normalized = prompt
    .split(/\s+/)
    .join("-")
    .replace(/[^\p{L}\p{N}._-]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return normalized ? `${normalized}.md` : "task-deliverable.md";
}

async function createFallbackArtifact({
  sessionId,
  taskId,
  prompt,
  summary
}: {
  sessionId: string;
  taskId: string;
  prompt: string;
  summary: string;
}) {
  const content = `# 任务交付\n\n## 原始任务\n\n${prompt}\n\n## 执行结果\n\n${summary}\n`;
  const artifactFile = await writeArtifactFile(sessionId, taskId, buildArtifactName(prompt), content);
  const artifact = await createArtifact({
    sessionId,
    taskId,
    name: artifactFile.filename,
    mimeType: "text/markdown; charset=utf-8",
    storagePath: artifactFile.storagePath
  });

  return {
    id: artifact.id,
    name: artifact.name,
    mimeType: artifact.mimeType ?? null
  };
}

function summarizeWebMaterials(materials: Array<{ title: string; url: string; reason: string; content: string }>) {
  return JSON.stringify({
    sources: materials.map((material) => ({
      title: material.title,
      url: material.url,
      reason: material.reason,
      content: material.content.slice(0, 2200)
    }))
  });
}

async function collectWebMaterials(request: string) {
  const selection = await selectWebSources(request);
  const materials: Array<{ title: string; url: string; reason: string; content: string }> = [];

  for (const source of selection.sources) {
    try {
      const content = await fetchSourceContent(source.url);
      materials.push({
        ...source,
        content
      });
    } catch {
      continue;
    }
  }

  if (materials.length === 0) {
    throw new Error("没有成功获取可用网页材料。");
  }

  return summarizeWebMaterials(materials);
}

async function readWebPage(url: string) {
  const content = await fetchSourceContent(url);

  return JSON.stringify({
    url,
    content: content.slice(0, 4000)
  });
}

export async function* runGeneralAgentTask({
  sessionId,
  taskId,
  prompt,
  permissions = []
}: {
  sessionId: string;
  taskId: string;
  prompt: string;
  permissions?: Permission[];
}): AsyncIterable<AgentRuntimeEvent> {
  const deliveryDecision = decideDeliveryMode(prompt);

  yield {
    type: "task.status",
    taskId,
    status: "executing",
    summary: `通用智能体已启动，可读取文件、搜索、写入、执行安全命令并保存产物。本次交付策略：${deliveryDecision.reason}`
  };

  const queue = new AsyncEventQueue();
  const createdArtifacts: Array<{ id: string; name: string; mimeType: string | null }> = [];

  const backend = new FilesystemBackend({
    rootDir: process.cwd(),
    virtualMode: true,
    maxFileSizeMb: 5
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

      createdArtifacts.push({
        id: artifact.id,
        name: artifact.name,
        mimeType: artifact.mimeType ?? null
      });

      return JSON.stringify({
        artifactId: artifact.id,
        name: artifact.name,
        mimeType: artifact.mimeType
      });
    },
    {
      name: "create_artifact",
      description: "为当前任务保存一个面向用户的 Markdown 产物。产物内容必须使用中文。",
      schema: z.object({
        name: z.string().min(1),
        content: z.string().min(1)
      })
    }
  );

  const runCommandTool = tool(
    async ({ command }) => {
      const policy = checkToolPolicy({
        tool: "run_command",
        permissions,
        command
      });

      if (!policy.allowed && policy.requiresApproval) {
        const approval = await createApprovalRequest({
          taskId,
          reason: policy.reason ?? "当前命令需要用户确认。",
          risk: policy.risk
        });

        queue.push({
          kind: "event",
          event: {
            type: "approval.required",
            taskId,
            approvalId: approval.id,
            reason: policy.reason ?? "当前命令需要用户确认。"
          }
        });

        return `命令未执行：${policy.reason ?? "当前命令需要用户确认。"} 审批编号：${approval.id}`;
      }

      if (!policy.allowed) {
        return `命令未执行：${policy.reason ?? "当前命令不符合安全策略。"} `;
      }

      return runSafeCommand(command);
    },
    {
      name: "run_command",
      description:
        "运行短小、安全、仅限当前项目的 shell 命令。用于检查、测试、构建或简单验证。返回内容用中文概括。",
      schema: z.object({
        command: z.string().min(1)
      })
    }
  );

  const collectWebMaterialsTool = tool(
    async ({ request }) => collectWebMaterials(request),
    {
      name: "collect_web_materials",
      description:
        "为当前任务选择并抓取一组公开网页材料，返回来源、URL、选择理由和提炼后的正文片段。适合需要补充外部资料、对比信息或公开说明时使用。",
      schema: z.object({
        request: z.string().min(1)
      })
    }
  );

  const readWebPageTool = tool(
    async ({ url }) => readWebPage(url),
    {
      name: "read_web_page",
      description: "读取一个公开网页并返回正文片段。适合用户已经给出 URL，或你已经知道具体网页地址时使用。",
      schema: z.object({
        url: z.string().url()
      })
    }
  );

  const agent = createDeepAgent({
    model: createOpenRouterChatModel(),
    backend,
    tools: [createArtifactTool, runCommandTool, collectWebMaterialsTool, readWebPageTool],
    permissions: [
      { operations: ["read", "write"], paths: ["/**"] }
    ],
    systemPrompt:
      "你是一个通用项目智能体，形态类似 Manus 的执行型工作者。必须全程使用中文：计划、工具使用说明、产物内容、最终回复都用中文。可以使用内置文件系统工具检查目录、grep 搜索、读取、写入和编辑文件。需要补充公开网页资料时，优先使用 collect_web_materials；如果已经有明确 URL，再使用 read_web_page。run_command 只用于安全的当前项目命令。用户要求可持久交付物、报告、文档、总结文件或 artifact/产物时，必须先调用 create_artifact 保存清晰的 Markdown 产物，然后再给最终回复；不要只说“我将创建”或“让我创建”。最终回复保持简洁，说明重要变更、读取过的关键文件、使用过的网页材料或创建的产物。"
  });

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
      const summary = ensureChineseSummary(extractFinalSummary(output));
      let artifacts = [...createdArtifacts];

      if (deliveryDecision.mode !== "reply" && artifacts.length === 0) {
        const fallbackArtifact = await createFallbackArtifact({
          sessionId,
          taskId,
          prompt,
          summary
        });

        artifacts = [fallbackArtifact];
        queue.push({
          kind: "event",
          event: {
            type: "artifact.created",
            taskId,
            artifactId: fallbackArtifact.id,
            name: fallbackArtifact.name,
            mimeType: fallbackArtifact.mimeType
          }
        });
      }

      queue.push({ kind: "done", summary, artifacts });
    } catch (error) {
      queue.push({
        kind: "error",
        error: error instanceof Error ? error : new Error("未知通用智能体错误。")
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
      summary: "通用智能体任务已完成。"
    };

    const finalSummary =
      item.artifacts.length === 0
        ? item.summary
        : deliveryDecision.mode === "artifact"
          ? `已生成交付产物：${item.artifacts.map((artifact) => artifact.name).join("、")}`
          : `${item.summary}\n\n交付产物：${item.artifacts.map((artifact) => artifact.name).join("、")}`;

    yield {
      type: "task.finished",
      taskId,
      summary: finalSummary
    };

    return;
  }
}
