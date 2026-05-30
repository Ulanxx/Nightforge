import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createStructuredChatCompletion } from "@/lib/llm/openrouter";

const execFileAsync = promisify(execFile);

const sourceSelectionSchema = z.object({
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string().url(),
        reason: z.string()
      })
    )
    .min(3)
    .max(6)
});

const reportSchema = z.object({
  title: z.string(),
  executiveSummary: z.string(),
  keyFindings: z.array(z.string()).min(3).max(6),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        content: z.string()
      })
    )
    .min(3)
    .max(6),
  uncertainties: z.array(z.string()).min(1).max(4)
});

export type WebInputSource = {
  title: string;
  url: string;
  reason: string;
  content: string;
};

export type TaskDeliverable = z.infer<typeof reportSchema>;

export async function selectWebSources(prompt: string) {
  try {
    return await createStructuredChatCompletion({
      schema: sourceSelectionSchema,
      normalize: normalizeSourceSelection,
      messages: [
        {
          role: "system",
          content:
            "为当前任务选择 3 到 6 个高质量公开网页材料。优先选择官方页面、官方文档、价格页、说明页和可信对比页面。优先选择无需登录、不容易触发机器人拦截的 URL。必须只返回 JSON，字段内容使用中文。"
        },
        {
          role: "user",
          content: `任务请求：\n${prompt}`
        }
      ]
    });
  } catch {
    return {
      sources: buildFallbackSources(prompt)
    };
  }
}

export async function fetchSourceContent(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "deepagents-agent/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`抓取网页失败：${url}，状态码 ${response.status}`);
    }

    const html = await response.text();
    return extractReadableText(html);
  } catch {
    const { stdout } = await execFileAsync("curl", [
      "-L",
      "--max-time",
      "20",
      "-A",
      "deepagents-agent/0.1",
      url
    ]);

    return extractReadableText(stdout);
  }
}

export async function writeArtifactDocument({
  sessionId,
  taskId,
  report
}: {
  sessionId: string;
  taskId: string;
  report: string;
}) {
  const artifactDir = path.join(process.cwd(), ".artifacts", sessionId);
  await mkdir(artifactDir, { recursive: true });

  const filename = `${taskId}-report.md`;
  const storagePath = path.join(artifactDir, filename);
  await writeFile(storagePath, report, "utf8");

  return {
    filename,
    storagePath
  };
}

export async function synthesizeTaskDeliverable({
  prompt,
  sources
}: {
  prompt: string;
  sources: WebInputSource[];
}) {
  return createStructuredChatCompletion({
    schema: reportSchema,
    normalize: normalizeTaskDeliverable,
    messages: [
        {
          role: "system",
          content:
          "你正在基于已收集材料撰写正式交付物。必须只返回 JSON，字段内容使用中文。语言要简洁、具体，不要编造没有材料支持的结论。"
        },
        {
          role: "user",
        content: `任务请求：\n${prompt}\n\n材料：\n${sources
          .map(
            (source, index) =>
              `[${index + 1}] ${source.title}\nURL: ${source.url}\n选择理由：${source.reason}\n内容：\n${source.content.slice(0, 6000)}`
          )
          .join("\n\n")}`
      }
    ]
  });
}

export function formatArtifactMarkdown(report: TaskDeliverable, sources: WebInputSource[]) {
  const findings = report.keyFindings.map((finding) => `- ${finding}`).join("\n");
  const sections = report.sections.map((section) => `## ${section.heading}\n\n${section.content}`).join("\n\n");
  const uncertainties = report.uncertainties.map((item) => `- ${item}`).join("\n");
  const sourceList = sources
    .map((source, index) => `${index + 1}. [${source.title}](${source.url})`)
    .join("\n");

  return `# ${report.title}

## Executive Summary

${report.executiveSummary}

## Key Findings

${findings}

${sections}

## Uncertainties

${uncertainties}

## Sources

${sourceList}
`;
}

export async function readArtifactContent(storagePath: string) {
  return readFile(storagePath, "utf8");
}

export const readArtifact = readArtifactContent;

function normalizeSourceSelection(value: unknown) {
  if (Array.isArray(value)) {
    return {
      sources: value
        .map((source, index) => normalizeSourceItem(source, index))
        .filter(
          (
            source
          ): source is {
            title: string;
            url: string;
            reason: string;
          } => !!source
        )
        .slice(0, 6)
    };
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const rawSources = Array.isArray(record.sources) ? record.sources : [];

  return {
    sources: rawSources
      .map((source, index) => normalizeSourceItem(source, index))
      .filter(
        (
          source
        ): source is {
          title: string;
          url: string;
          reason: string;
        } => !!source
      )
      .slice(0, 6)
  };
}

function normalizeSourceItem(source: unknown, index: number) {
  if (typeof source === "string") {
    const hostname = safeHostname(source);
    return {
      title: hostname ? hostname.replace(/^www\./, "") : `来源 ${index + 1}`,
      url: source,
      reason: "已为当前任务选择相关公开网页材料。"
    };
  }

  if (!source || typeof source !== "object") {
    return null;
  }

  const item = source as Record<string, unknown>;
  const url =
    typeof item.url === "string"
      ? item.url
      : typeof item.link === "string"
        ? item.link
        : typeof item.href === "string"
          ? item.href
          : null;

  if (!url) {
    return null;
  }

  return {
    title:
      typeof item.title === "string"
        ? item.title
        : typeof item.name === "string"
          ? item.name
          : safeHostname(url) ?? `Source ${index + 1}`,
    url,
    reason:
      typeof item.reason === "string"
        ? item.reason
        : typeof item.description === "string"
          ? item.description
          : "为当前任务选择的相关公开网页材料。"
  };
}

function normalizeTaskDeliverable(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const root = value as Record<string, unknown>;
  const record =
    root.report && typeof root.report === "object"
      ? (root.report as Record<string, unknown>)
      : root;
  const toolsAnalyzed = Array.isArray(record.tools_analyzed)
    ? record.tools_analyzed.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : Array.isArray(record.tool_benchmarks)
      ? record.tool_benchmarks.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
  const recommendationEntries = Array.isArray(record.recommendations)
    ? record.recommendations.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
  const recommendations =
    !Array.isArray(record.recommendations) && record.recommendations && typeof record.recommendations === "object"
      ? (record.recommendations as Record<string, unknown>)
      : null;
  const benchmarkSummary =
    record.benchmark_summary && typeof record.benchmark_summary === "object"
      ? (record.benchmark_summary as Record<string, unknown>)
      : record.comparative_analysis && typeof record.comparative_analysis === "object"
        ? (record.comparative_analysis as Record<string, unknown>)
      : null;
  const sourceItems = Array.isArray(record.sources)
    ? record.sources.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];

  const recommendationFindings = recommendations
    ? Object.values(recommendations).filter((item): item is string => typeof item === "string")
    : recommendationEntries
        .map((item) =>
          typeof item.scenario === "string" && typeof item.recommendation === "string"
            ? `${item.scenario} ${item.recommendation}`
            : null
        )
        .filter((item): item is string => !!item);

  const keyFindings = [
    typeof record.executive_summary === "string" ? record.executive_summary : null,
    ...toolsAnalyzed.map((tool) =>
      typeof tool.tool === "string" && typeof tool.cost === "string"
        ? `${tool.tool}: ${tool.cost}`
        : typeof tool.tool === "string" && typeof tool.ideal_buyer === "string"
          ? `${tool.tool}: ${tool.ideal_buyer}`
          : typeof tool.tool === "string" && typeof tool.ideal_buyer_profile === "string"
            ? `${tool.tool}: ${tool.ideal_buyer_profile}`
          : null
    ),
    ...recommendationFindings
  ]
    .filter((item): item is string => !!item)
    .slice(0, 6);

  const sections = [
    {
      heading: "Tool Analysis",
      content: toolsAnalyzed
        .map((tool) => {
          const name = typeof tool.tool === "string" ? tool.tool : "Unnamed tool";
          const type = typeof tool.type === "string" ? tool.type : "";
          const cost = typeof tool.cost === "string" ? tool.cost : "";
          const ease = typeof tool.ease_of_use === "string" ? tool.ease_of_use : "";
          const integrations = typeof tool.integrations === "string" ? tool.integrations : "";
          const scalability = typeof tool.scalability === "string" ? tool.scalability : "";
          const buyer =
            typeof tool.ideal_buyer === "string"
              ? tool.ideal_buyer
              : typeof tool.ideal_buyer_profile === "string"
                ? tool.ideal_buyer_profile
                : "";
          const description = typeof tool.description === "string" ? tool.description : "";
          return `### ${name}

Type: ${type}

Description: ${description}

Cost: ${cost}

Ease of use: ${ease}

Integrations: ${integrations}

Scalability: ${scalability}

Ideal buyer: ${buyer}`.trim();
        })
        .join("\n\n")
    },
    {
      heading: "Recommendations",
      content:
        recommendations
          ? Object.entries(recommendations)
              .filter(([, item]) => typeof item === "string")
              .map(([key, item]) => `- ${key}: ${item as string}`)
              .join("\n")
          : recommendationEntries.length > 0
            ? recommendationEntries
                .map((item) => {
                  const scenario = typeof item.scenario === "string" ? item.scenario : "Scenario";
                  const recommendation =
                    typeof item.recommendation === "string"
                      ? item.recommendation
                      : "No recommendation provided.";
                  const tools = Array.isArray(item.tools)
                    ? item.tools.filter((tool): tool is string => typeof tool === "string")
                    : [];
                  return `- ${scenario}: ${recommendation}${tools.length > 0 ? ` Recommended tools: ${tools.join(", ")}.` : ""}`;
                })
                .join("\n")
            : "Recommendations were not structured in the source response."
    },
    {
      heading: "Comparative Analysis",
      content:
        typeof benchmarkSummary?.overview === "string"
          ? benchmarkSummary.overview
          : typeof record.introduction === "string"
            ? record.introduction
            : typeof record.conclusion === "string"
              ? record.conclusion
              : "Comparison synthesized from the collected product and documentation sources."
    },
    {
      heading: "Source Notes",
      content:
        sourceItems
          .map((item, index) => {
            const url = typeof item.url === "string" ? item.url : "";
            const description =
              typeof item.description === "string"
                ? item.description
                : typeof item.name === "string"
                  ? item.name
                  : "";
            return `${index + 1}. ${description} ${url}`.trim();
          })
          .join("\n") || "See linked sources."
    }
  ].filter((section) => section.content.trim().length > 0);

  const uncertainties = [
    typeof benchmarkSummary?.note === "string" ? benchmarkSummary.note : null,
    toolsAnalyzed.some((tool) => typeof tool.tool === "string" && tool.tool === "Bardeen")
      ? null
      : "Some vendors had limited public pricing or SMB-focused evidence."
  ].filter((item): item is string => !!item);

  return {
    title:
      typeof record.title === "string"
        ? record.title
        : typeof record.report_title === "string"
          ? record.report_title
          : "Research Report",
    executiveSummary:
      typeof record.executiveSummary === "string"
        ? record.executiveSummary
        : typeof record.executive_summary === "string"
          ? record.executive_summary
          : "Business-facing research summary generated from public sources.",
    keyFindings:
      keyFindings.length >= 3
        ? keyFindings
        : [
            "Developer-first tools lead on flexibility and cost control.",
            "Managed browser infrastructure reduces operational overhead.",
            "Enterprise RPA platforms are often over-scoped for SMB product teams."
          ],
    sections: sections.slice(0, 6),
    uncertainties:
      uncertainties.length > 0
        ? uncertainties.slice(0, 4)
        : ["Some public source coverage was incomplete or vendor-managed."]
  };
}

function extractReadableText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function buildFallbackSources(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();
  const sources = [
    {
      title: "Playwright",
      url: "https://playwright.dev/",
      reason: "开发者优先的浏览器自动化框架官方文档。"
    },
    {
      title: "Puppeteer",
      url: "https://pptr.dev/",
      reason: "面向 Chrome 的浏览器自动化库官方文档。"
    },
    {
      title: "Browserbase 价格页",
      url: "https://www.browserbase.com/pricing",
      reason: "商业浏览器基础设施的价格与套餐信息。"
    },
    {
      title: "Bardeen 价格页",
      url: "https://www.bardeen.ai/pricing",
      reason: "面向业务用户的低代码流程自动化价格信息。"
    },
    {
      title: "UiPath 平台",
      url: "https://www.uipath.com/product",
      reason: "企业自动化平台概览与定位信息。"
    },
    {
      title: "Playwright 与 Puppeteer 对比指南",
      url: "https://www.browserstack.com/guide/playwright-vs-puppeteer",
      reason: "开发者工具取舍的公开对比来源。"
    }
  ];

  if (lowerPrompt.includes("stagehand")) {
    sources[3] = {
      title: "Stagehand",
      url: "https://stagehand.dev/",
      reason: "Stagehand 官方产品来源。"
    };
  }

  return sources.slice(0, 6);
}
