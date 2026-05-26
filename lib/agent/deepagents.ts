import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import { z } from "zod";
import { generateResearchPlan, type ResearchPlan } from "@/lib/agent/planning";
import { runResearchReportTask } from "@/lib/agent/report-runner";
import type { AgentRuntimeEvent } from "@/lib/agent/runtime";

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

export async function generatePlanWithDeepAgents(prompt: string) {
  const model = await createOpenRouterChatModel();

  const planningTool = tool(
    async ({ request }) => {
      const plan = await generateResearchPlan(request);
      return JSON.stringify(plan);
    },
    {
      name: "generate_research_plan",
      description:
        "Generate a concrete research plan with objective, research angles, report sections, and source strategy.",
      schema: z.object({
        request: z.string().min(1)
      })
    }
  );

  const agent = createDeepAgent({
    model,
    tools: [planningTool],
    systemPrompt:
      "You are a research planning orchestrator. Use the provided tool to produce a concrete research plan. Return a concise JSON object only."
  });

  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: `Create a concrete research plan for this request:\n\n${prompt}`
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
    return JSON.parse(jsonMatch[0]) as ResearchPlan;
  }

  return parsePlanFromNarrative(content);
}

function parsePlanFromNarrative(content: string): ResearchPlan {
  const normalized = content.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    throw new Error("DeepAgents returned an empty planning response.");
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

  throw new Error(`DeepAgents returned an unparseable plan. Raw output: ${content}`);
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

export async function* runDeepAgentsResearchTask({
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
    summary: "Generate a concrete research plan with DeepAgents."
  };

  const plan = await generatePlanWithDeepAgents(prompt);

  yield {
    type: "tool.finished",
    taskId,
    tool: "llm.plan",
    summary: "Research plan is ready."
  };

  yield {
    type: "plan.updated",
    taskId,
    steps: [
      `Objective: ${plan.objective}`,
      ...plan.researchAngles.map((angle) => `Research angle: ${angle}`),
      ...plan.reportSections.map((section) => `Report section: ${section}`),
      `Source strategy: ${plan.sourceStrategy}`
    ]
  };

  yield {
    type: "task.status",
    taskId,
    status: "planning",
    summary: "Research plan generated successfully."
  };

  for await (const event of runResearchReportTask({
    sessionId,
    taskId,
    prompt
  })) {
    yield event;
  }
}
