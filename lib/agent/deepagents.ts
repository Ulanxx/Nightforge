import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import { z } from "zod";
import { getOpenRouterEnv } from "@/lib/config/env";
import { generateExecutionPlan, type ExecutionPlan } from "@/lib/agent/planning";
import { runTaskDeliverableFlow } from "@/lib/agent/deliverable-runner";
import type { AgentRuntimeEvent } from "@/lib/agent/runtime";

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

export async function generatePlanWithDeepAgents(prompt: string) {
  const model = await createOpenRouterChatModel();

  const planningTool = tool(
    async ({ request }) => {
      const plan = await generateExecutionPlan(request);
      return JSON.stringify(plan);
    },
    {
      name: "generate_execution_plan",
      description:
        "生成包含目标、执行角度、交付结构和材料策略的具体执行计划。字段内容使用中文。",
      schema: z.object({
        request: z.string().min(1)
      })
    }
  );

  const agent = createDeepAgent({
    model,
    tools: [planningTool],
    systemPrompt:
      "你是任务执行计划编排器。使用提供的工具生成具体执行计划。必须只返回简洁 JSON，字段内容使用中文。"
  });

  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: `为以下请求创建具体执行计划：\n\n${prompt}`
      }
    ]
  });

  const message = result.messages.at(-1);
  const content = Array.isArray(message?.content)
    ? message.content
        .map((part) => (typeof part === "string" ? part : "text" in part && typeof part.text === "string" ? part.text : ""))
        .join("")
    : typeof message?.content === "string"
      ? message.content
      : "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as ExecutionPlan;
  }

  return parsePlanFromNarrative(content);
}

function parsePlanFromNarrative(content: string): ExecutionPlan {
  const normalized = content.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    throw new Error("DeepAgents 返回了空的计划响应。");
  }

  const objective = extractSection(normalized, ["Objective"]);
  const researchAngles = extractBulletList(extractSection(normalized, ["Research Angles"]));
  const reportSections = extractBulletList(extractSection(normalized, ["Report Structure", "Report Sections"]));
  const sourceStrategy = extractSection(normalized, ["Source Strategy", "Sources"]);

  if (objective && researchAngles.length > 0 && reportSections.length > 0 && sourceStrategy) {
    return {
      objective,
      researchAngles,
      reportSections,
      sourceStrategy
    };
  }

  throw new Error(`DeepAgents 返回了无法解析的计划。原始输出：${content}`);
}

function extractSection(content: string, headings: string[]) {
  for (const heading of headings) {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(?:^|\\n)#{0,6}\\s*${escapedHeading}\\s*:?\\s*\\n?([\\s\\S]*?)(?=\\n#{1,6}\\s|\\n[A-Z][^\\n]{0,80}:\\s*(?:\\n|$)|$)`,
      "i"
    );
    const match = content.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractBulletList(section: string) {
  if (!section) {
    return [];
  }

  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const items = lines
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^\|/.test(line))
    .filter((line) => !/^[-|:\s]+$/.test(line));

  const uniqueItems = [...new Set(items)];

  if (uniqueItems.length > 0) {
    return uniqueItems;
  }

  return section
    .split(/(?<=\.)\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);
}

export async function* runDeepAgentsTask({
  sessionId,
  taskId,
  prompt
}: {
  sessionId: string;
  taskId: string;
  prompt: string;
}): AsyncIterable<AgentRuntimeEvent> {
  yield {
    type: "tool.started",
    taskId,
    tool: "llm.plan",
    summary: "使用 DeepAgents 生成具体执行计划。"
  };

  const plan = await generatePlanWithDeepAgents(prompt);

  yield {
    type: "tool.finished",
    taskId,
    tool: "llm.plan",
    summary: "执行计划已生成。"
  };

  yield {
    type: "plan.updated",
    taskId,
    steps: [
      `目标：${plan.objective}`,
      ...plan.researchAngles.map((angle) => `执行角度：${angle}`),
      ...plan.reportSections.map((section) => `交付结构：${section}`),
      `材料策略：${plan.sourceStrategy}`
    ]
  };

  yield {
    type: "task.status",
    taskId,
    status: "planning",
    summary: "执行计划已成功生成。"
  };

  for await (const event of runTaskDeliverableFlow({
    sessionId,
    taskId,
    prompt
  })) {
    yield event;
  }
}
