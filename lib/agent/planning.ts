import { z } from "zod";
import { createStructuredChatCompletion } from "@/lib/llm/openrouter";

const clarificationDecisionSchema = z.object({
  needsClarification: z.boolean(),
  reason: z.string(),
  questions: z.array(z.string()).max(3)
});

const executionPlanSchema = z.object({
  objective: z.string(),
  researchAngles: z.array(z.string()).min(1).max(8),
  reportSections: z.array(z.string()).min(1).max(8),
  sourceStrategy: z.string()
});

export type ClarificationDecision = z.infer<typeof clarificationDecisionSchema>;
export type ExecutionPlan = z.infer<typeof executionPlanSchema>;

export async function decideClarification(message: string) {
  if (looksExecutionReady(message)) {
    return {
      needsClarification: false,
      reason: "任务信息足够，可以立即开始执行。",
      questions: []
    };
  }

  const result = await createStructuredChatCompletion({
    schema: clarificationDecisionSchema,
    normalize: normalizeClarificationDecision,
    messages: [
      {
        role: "system",
        content:
          "你是通用项目智能体的任务入口规划器，可以访问当前工作区。判断用户任务是否足够明确、能否立即开始执行。最多提出 3 个必要澄清问题。必须只返回 JSON，字段为 needsClarification、reason、questions；reason 和 questions 必须使用中文。"
      },
      {
        role: "user",
        content: `任务请求：\n${message}`
      }
    ]
  });

  return result;
}

export async function generateExecutionPlan(message: string) {
  return createStructuredChatCompletion({
    schema: executionPlanSchema,
    normalize: normalizeExecutionPlan,
    messages: [
      {
        role: "system",
        content:
          "你是面向通用知识工作者的任务规划智能体，请为当前任务生成简洁、具体、可执行的执行计划。可以结合网页材料收集、文件处理和交付物生成来组织计划。必须只返回 JSON，字段内容使用中文。"
      },
      {
        role: "user",
        content: `任务请求：\n${message}`
      }
    ]
  });
}

export function buildExecutionPlanSteps(plan: ExecutionPlan) {
  const objective = compactPlanText(plan.objective, 100);
  const sourceStrategy = compactPlanText(plan.sourceStrategy, 120);
  const actionFocus = compactPlanList(plan.researchAngles, 2);
  const deliveryShape = compactPlanList(plan.reportSections, 3);

  return [
    `明确目标：${objective}`,
    `准备材料：${sourceStrategy}`,
    `执行重点：${actionFocus}`,
    `交付结果：${deliveryShape}`
  ];
}

function normalizeClarificationDecision(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const needsClarification = record.needsClarification;
  const needsClarificationSnake = record.needs_clarification;
  const isSpecificEnough = record.is_specific_enough;
  const specificEnough = record.specific_enough;
  const readyToStart = record.ready_to_start;
  const decision = record.decision;
  const clarificationQuestions = record.clarification_questions;
  const derivedSpecificity =
    typeof isSpecificEnough === "boolean"
      ? isSpecificEnough
      : typeof specificEnough === "boolean"
        ? specificEnough
        : typeof readyToStart === "boolean"
          ? readyToStart
        : typeof decision === "boolean"
          ? decision
        : undefined;

  return {
    needsClarification:
      typeof needsClarification === "boolean"
        ? needsClarification
        : typeof needsClarificationSnake === "boolean"
          ? needsClarificationSnake
        : typeof derivedSpecificity === "boolean"
          ? !derivedSpecificity
          : false,
    reason:
      typeof record.reason === "string"
        ? record.reason
        : typeof record.rationale === "string"
          ? record.rationale
          : typeof derivedSpecificity === "boolean"
            ? derivedSpecificity
              ? "任务信息足够，可以开始规划。"
              : "任务需要先澄清。"
            : typeof needsClarificationSnake === "boolean"
              ? needsClarificationSnake
                ? "任务需要先澄清。"
                : "任务信息足够，可以开始执行。"
              : "任务信息足够，可以开始执行。",
    questions: Array.isArray(record.questions)
      ? record.questions
      : Array.isArray(clarificationQuestions)
        ? clarificationQuestions
        : []
  };
}

function normalizeExecutionPlan(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const topLevelRecord = value as Record<string, unknown>;
  const nestedPlan =
    topLevelRecord.plan && typeof topLevelRecord.plan === "object"
      ? (topLevelRecord.plan as Record<string, unknown>)
      : null;
  const reportStructure =
    topLevelRecord.report_structure && typeof topLevelRecord.report_structure === "object"
      ? (topLevelRecord.report_structure as Record<string, unknown>)
      : null;
  const record = nestedPlan ?? topLevelRecord;
  const rawSteps = Array.isArray(record.steps)
    ? record.steps
    : Array.isArray(record.research_plan)
      ? record.research_plan
      : record.research_plan && typeof record.research_plan === "object"
        ? Object.values(record.research_plan)
        : record.execution_plan && typeof record.execution_plan === "object"
          ? Object.values(record.execution_plan)
          : []
  ;
  const nestedPhaseTasks = Object.values(record)
    .filter((value): value is Record<string, unknown> => !!value && typeof value === "object")
    .flatMap((value) =>
      Array.isArray(value.tasks)
        ? value.tasks.filter((task): task is Record<string, unknown> => !!task && typeof task === "object")
        : []
    );
  const rawStepList = Array.isArray(rawSteps) ? rawSteps : [];
  const stepObjects = [...rawStepList, ...nestedPhaseTasks].filter(
    (step): step is Record<string, unknown> => !!step && typeof step === "object"
  );
  const stringifyList = (items: unknown[]) =>
    items.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  const unique = (items: string[]) => [...new Set(items)];
  const pickStrings = (record: Record<string, unknown>, keys: string[]) =>
    stringifyList(keys.map((key) => record[key]));
  const pickStringArrays = (record: Record<string, unknown>, keys: string[]) =>
    unique(
      keys.flatMap((key) =>
        Array.isArray(record[key]) ? stringifyList(record[key] as unknown[]) : []
      )
    );
  const derivedAngles = stepObjects
    .flatMap((step) => {
      const values = pickStrings(step, ["purpose", "action", "description", "output", "task", "expected_output"]);

      const actionSections =
        Array.isArray(step.actions)
          ? step.actions
              .filter((action): action is Record<string, unknown> => !!action && typeof action === "object")
              .map((action) => action.query ?? action.type)
              .filter((value): value is string => typeof value === "string")
          : [];
      const searchQueries = pickStringArrays(step, ["search_queries", "queries"]);

      return [...values, ...actionSections, ...searchQueries];
    })
    .filter((value): value is string => typeof value === "string")
    .filter((value) => value.length > 8)
    .slice(0, 5);
  const derivedSections = stepObjects
    .flatMap((step) => {
      const action = typeof step.action === "string" ? [`章节：${step.action}`] : [];
      const description = typeof step.description === "string" ? [`章节：${step.description}`] : [];
      const output = typeof step.output === "string" ? [`章节：${step.output}`] : [];
      const task = typeof step.task === "string" ? [`章节：${step.task}`] : [];
      const expectedOutput =
        typeof step.expected_output === "string" ? [`章节：${step.expected_output}`] : [];
      const sections = Array.isArray(step.sections)
        ? step.sections.filter((value): value is string => typeof value === "string")
        : [];
      const searchQuerySections = Array.isArray(step.search_queries)
        ? step.search_queries
            .filter((value): value is string => typeof value === "string")
            .map((value) => `章节：${value}`)
        : [];
      const actionSections =
        Array.isArray(step.actions)
          ? step.actions
              .filter((action): action is Record<string, unknown> => !!action && typeof action === "object")
              .flatMap((action) => {
                const sectionList = Array.isArray(action.sections)
                  ? action.sections.filter((value): value is string => typeof value === "string")
                  : [];
                return sectionList;
              })
          : [];
      return [...action, ...description, ...output, ...task, ...expectedOutput, ...sections, ...searchQuerySections, ...actionSections];
    })
    .filter((value): value is string => typeof value === "string")
    .slice(0, 6);
  const fallbackStrings = unique(
    stepObjects.flatMap((step) => [
      ...pickStrings(step, ["task", "description", "action", "output", "expected_output"]),
      ...pickStringArrays(step, ["search_queries", "queries"])
    ])
  );
  const derivedSourceStrategy =
    stepObjects
      .flatMap((step) => {
        const query = typeof step.query === "string" ? [step.query] : [];
        const queries = Array.isArray(step.queries)
          ? step.queries.filter((value): value is string => typeof value === "string")
          : [];
        const searchQueries = Array.isArray(step.search_queries)
          ? step.search_queries.filter((value): value is string => typeof value === "string")
          : [];
        const actionQueries =
          Array.isArray(step.actions)
            ? step.actions
                .filter((action): action is Record<string, unknown> => !!action && typeof action === "object")
                .flatMap((action) => {
                  const single = typeof action.query === "string" ? [action.query] : [];
                  const listed = Array.isArray(action.queries)
                    ? action.queries.filter((value): value is string => typeof value === "string")
                    : [];
                  const sources = Array.isArray(action.sources)
                    ? action.sources.filter((value): value is string => typeof value === "string")
                    : [];
                  return [...single, ...listed, ...sources];
                })
            : [];
        return [...query, ...queries, ...searchQueries, ...actionQueries];
      })
      .slice(0, 3)
      .join(" | ") || "如需补充外部信息，优先选择高质量的公开网页、官方材料或说明文档。";

  const reportOutline =
    record.report_outline && typeof record.report_outline === "object"
      ? (record.report_outline as Record<string, unknown>)
      : null;

  const objective =
    typeof record.objective === "string"
      ? record.objective
      : typeof record.goal === "string"
        ? record.goal
        : typeof record.research_objective === "string"
          ? record.research_objective
          : typeof record.research_title === "string"
            ? record.research_title
            : typeof stepObjects[0]?.action === "string"
              ? stepObjects[0].action
              : typeof stepObjects[0]?.description === "string"
                ? stepObjects[0].description
                : typeof stepObjects[0]?.task === "string"
                  ? stepObjects[0].task
              : "";

  const normalizedResearchAngles = unique(
    stringifyList(
      Array.isArray(record.researchAngles)
        ? record.researchAngles
        : Array.isArray(record.research_angles)
          ? record.research_angles
          : Array.isArray(record.research_questions)
            ? record.research_questions
          : Array.isArray(record.dimensions)
            ? record.dimensions
            : Array.isArray(record.key_dimensions)
              ? record.key_dimensions
              : Array.isArray(record.research_areas)
                ? record.research_areas
                : Array.isArray(record.target_tools)
                  ? record.target_tools
                : derivedAngles
    )
  );

  const normalizedReportSections = unique(
    stringifyList(
      Array.isArray(record.reportSections)
        ? record.reportSections
        : Array.isArray(record.report_sections)
          ? record.report_sections
          : Array.isArray(record.sections)
            ? record.sections
            : Array.isArray(reportOutline?.sections)
              ? reportOutline.sections
              : Array.isArray(reportStructure?.sections)
                ? reportStructure.sections
              : record.deliverable && typeof record.deliverable === "object"
                ? Object.values(record.deliverable)
                : record.report_structure && typeof record.report_structure === "object"
                  ? Object.values(record.report_structure)
                : Array.isArray(record.execution_steps)
                  ? record.execution_steps
                  : derivedSections
    )
  );

  const researchAngles =
    normalizedResearchAngles.length >= 2
      ? normalizedResearchAngles.slice(0, 5)
      : normalizedResearchAngles.length === 1
        ? unique([...normalizedResearchAngles, ...fallbackStrings]).slice(0, 5)
        : fallbackStrings.slice(0, 5);

  const reportSections =
    normalizedReportSections.length >= 3
      ? normalizedReportSections.slice(0, 6)
      : normalizedReportSections.length > 0
        ? unique([
            ...normalizedReportSections,
            ...fallbackStrings.map((value) => `章节：${value}`)
          ]).slice(0, 6)
        : fallbackStrings.map((value) => `章节：${value}`).slice(0, 6);

  const sourceStrategy =
    typeof record.sourceStrategy === "string"
      ? record.sourceStrategy
      : typeof record.source_strategy === "string"
        ? record.source_strategy
        : typeof record.sources === "string"
          ? record.sources
          : derivedSourceStrategy;

  return {
    objective: objective || "基于已澄清的请求完成任务并交付可用结果。",
    researchAngles:
      researchAngles.length > 0
        ? researchAngles
        : ["竞争格局", "价格与产品适配度"],
    reportSections:
      reportSections.length > 0
        ? reportSections
        : ["目标与背景", "执行结果", "补充材料"],
    sourceStrategy
  };
}

function looksExecutionReady(message: string) {
  const normalized = message.toLowerCase();
  const hasProjectAgentIntent =
    normalized.includes("inspect") ||
    normalized.includes("project") ||
    normalized.includes("file") ||
    normalized.includes("grep") ||
    normalized.includes("read") ||
    normalized.includes("write") ||
    normalized.includes("edit") ||
    normalized.includes("artifact") ||
    normalized.includes("architecture") ||
    normalized.includes("run") ||
    normalized.includes("test") ||
    normalized.includes("fix") ||
    normalized.includes("implement") ||
    normalized.includes("检查") ||
    normalized.includes("项目") ||
    normalized.includes("文件") ||
    normalized.includes("搜索") ||
    normalized.includes("读取") ||
    normalized.includes("写入") ||
    normalized.includes("编辑") ||
    normalized.includes("产物") ||
    normalized.includes("架构") ||
    normalized.includes("运行") ||
    normalized.includes("测试") ||
    normalized.includes("修复") ||
    normalized.includes("实现");
  const hasResearchIntent =
    normalized.includes("research") ||
    normalized.includes("report") ||
    normalized.includes("benchmark") ||
    normalized.includes("formal") ||
    normalized.includes("调研") ||
    normalized.includes("报告") ||
    normalized.includes("基准") ||
    normalized.includes("正式");
  const hasBusinessTarget =
    normalized.includes("smb") ||
    normalized.includes("saas") ||
    normalized.includes("product team") ||
    normalized.includes("engineering") ||
    normalized.includes("business") ||
    normalized.includes("中小企业") ||
    normalized.includes("产品团队") ||
    normalized.includes("工程") ||
    normalized.includes("业务");
  const hasEvaluationCriteria =
    normalized.includes("cost") ||
    normalized.includes("ease of use") ||
    normalized.includes("integrations") ||
    normalized.includes("scalability") ||
    normalized.includes("buyer") ||
    normalized.includes("成本") ||
    normalized.includes("易用") ||
    normalized.includes("集成") ||
    normalized.includes("扩展") ||
    normalized.includes("买方");

  return hasProjectAgentIntent || (hasResearchIntent && hasBusinessTarget && hasEvaluationCriteria);
}

function compactPlanText(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit).trim()}...` : normalized;
}

function compactPlanList(items: string[], take: number) {
  const values = items
    .map((item) => compactPlanText(item, 36))
    .filter(Boolean)
    .slice(0, take);

  return values.length > 0 ? values.join("；") : "按当前上下文完成任务。";
}
