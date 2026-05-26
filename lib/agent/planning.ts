import { z } from "zod";
import { createStructuredChatCompletion } from "@/lib/llm/openrouter";

const clarificationDecisionSchema = z.object({
  needsClarification: z.boolean(),
  reason: z.string(),
  questions: z.array(z.string()).max(3)
});

const researchPlanSchema = z.object({
  objective: z.string(),
  researchAngles: z.array(z.string()).min(1).max(8),
  reportSections: z.array(z.string()).min(1).max(8),
  sourceStrategy: z.string()
});

export type ClarificationDecision = z.infer<typeof clarificationDecisionSchema>;
export type ResearchPlan = z.infer<typeof researchPlanSchema>;

export async function decideClarification(message: string) {
  if (looksExecutionReady(message)) {
    return {
      needsClarification: false,
      reason: "The request is specific enough to begin planning and research immediately.",
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
          "You are planning the first step of a business-facing research agent. Decide whether the user's task is specific enough to start research immediately. Ask at most 3 necessary clarification questions. Return only JSON."
      },
      {
        role: "user",
        content: `Research request:\n${message}`
      }
    ]
  });

  return result;
}

export async function generateResearchPlan(message: string) {
  return createStructuredChatCompletion({
    schema: researchPlanSchema,
    normalize: normalizeResearchPlan,
    messages: [
      {
        role: "system",
        content:
          "You are generating a concise research plan for a public-web research agent serving business users. Return only JSON. Keep the plan concrete and execution-ready."
      },
      {
        role: "user",
        content: `Research request:\n${message}`
      }
    ]
  });
}

function normalizeClarificationDecision(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
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
      typeof record.needsClarification === "boolean"
        ? record.needsClarification
        : typeof derivedSpecificity === "boolean"
          ? !derivedSpecificity
          : record.needsClarification,
    reason:
      typeof record.reason === "string"
        ? record.reason
        : typeof record.rationale === "string"
          ? record.rationale
          : typeof derivedSpecificity === "boolean"
            ? derivedSpecificity
              ? "The request is specific enough to begin planning."
              : "The request needs clarification before planning."
            : record.reason,
    questions: Array.isArray(record.questions)
      ? record.questions
      : Array.isArray(clarificationQuestions)
        ? clarificationQuestions
        : []
  };
}

function normalizeResearchPlan(value: unknown) {
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
      const action = typeof step.action === "string" ? [`Section: ${step.action}`] : [];
      const description = typeof step.description === "string" ? [`Section: ${step.description}`] : [];
      const output = typeof step.output === "string" ? [`Section: ${step.output}`] : [];
      const task = typeof step.task === "string" ? [`Section: ${step.task}`] : [];
      const expectedOutput =
        typeof step.expected_output === "string" ? [`Section: ${step.expected_output}`] : [];
      const sections = Array.isArray(step.sections)
        ? step.sections.filter((value): value is string => typeof value === "string")
        : [];
      const searchQuerySections = Array.isArray(step.search_queries)
        ? step.search_queries
            .filter((value): value is string => typeof value === "string")
            .map((value) => `Section: ${value}`)
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
      .join(" | ") || "Use public web sources and prioritize high-quality official or product-facing materials.";

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
            ...fallbackStrings.map((value) => `Section: ${value}`)
          ]).slice(0, 6)
        : fallbackStrings.map((value) => `Section: ${value}`).slice(0, 6);

  const sourceStrategy =
    typeof record.sourceStrategy === "string"
      ? record.sourceStrategy
      : typeof record.source_strategy === "string"
        ? record.source_strategy
        : typeof record.sources === "string"
          ? record.sources
          : derivedSourceStrategy;

  return {
    objective: objective || "Produce a business-facing research report from the clarified request.",
    researchAngles:
      researchAngles.length > 0
        ? researchAngles
        : ["Competitive landscape", "Pricing and product fit"],
    reportSections:
      reportSections.length > 0
        ? reportSections
        : ["Executive Summary", "Analysis", "Sources"],
    sourceStrategy
  };
}

function looksExecutionReady(message: string) {
  const normalized = message.toLowerCase();
  const hasResearchIntent =
    normalized.includes("research") ||
    normalized.includes("report") ||
    normalized.includes("benchmark") ||
    normalized.includes("formal");
  const hasBusinessTarget =
    normalized.includes("smb") ||
    normalized.includes("saas") ||
    normalized.includes("product team") ||
    normalized.includes("engineering") ||
    normalized.includes("business");
  const hasEvaluationCriteria =
    normalized.includes("cost") ||
    normalized.includes("ease of use") ||
    normalized.includes("integrations") ||
    normalized.includes("scalability") ||
    normalized.includes("buyer");

  return hasResearchIntent && hasBusinessTarget && hasEvaluationCriteria;
}
