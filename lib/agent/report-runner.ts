import {
  fetchSourceContent,
  formatReportMarkdown,
  selectResearchSources,
  synthesizeResearchReport,
  writeReportArtifact
} from "@/lib/agent/research";
import type { AgentRuntimeEvent } from "@/lib/agent/runtime";
import { createArtifact } from "@/lib/store/artifacts";

export async function* runResearchReportTask({
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
    status: "researching",
    summary: "Research plan is locked. Selecting sources and gathering evidence."
  };

  yield {
    type: "tool.started" as const,
    taskId,
    tool: "research.sources",
    summary: "Select a focused set of public web sources."
  };

  const sourceSelection = await selectResearchSources(prompt);

  yield {
    type: "tool.finished" as const,
    taskId,
    tool: "research.sources",
    summary: `Selected ${sourceSelection.sources.length} research sources.`
  };

  const sources = [];

  for (const source of sourceSelection.sources) {
    yield {
      type: "tool.started" as const,
      taskId,
      tool: "web.read",
      summary: `Fetch source: ${source.title}`
    };

    try {
      const content = await fetchSourceContent(source.url);
      sources.push({
        ...source,
        content
      });

      yield {
        type: "tool.finished" as const,
        taskId,
        tool: "web.read",
        summary: `Captured source: ${source.title}`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch error.";

      yield {
        type: "tool.finished" as const,
        taskId,
        tool: "web.read",
        summary: `Skipped source: ${source.title} (${message})`
      };
    }
  }

  if (sources.length === 0) {
    throw new Error("No source content could be fetched.");
  }

  yield {
    type: "tool.started" as const,
    taskId,
    tool: "report.synthesize",
    summary: "Synthesize a formal markdown research report."
  };

  const report = await synthesizeResearchReport({
    prompt,
    sources
  });
  const markdown = formatReportMarkdown(report, sources);
  const artifactFile = await writeReportArtifact({
    sessionId,
    taskId,
    report: markdown
  });

  const artifact = await createArtifact({
    sessionId,
    taskId,
    name: artifactFile.filename,
    mimeType: "text/markdown; charset=utf-8",
    storagePath: artifactFile.storagePath
  });

  yield {
    type: "tool.finished" as const,
    taskId,
    tool: "report.synthesize",
    summary: `Report artifact ready: ${artifact.name}`
  };

  yield {
    type: "artifact.created",
    taskId,
    artifactId: artifact.id,
    name: artifact.name,
    mimeType: artifact.mimeType ?? null
  };

  yield {
    type: "task.status",
    taskId,
    status: "completed",
    summary: "Formal research report generated and saved as an artifact."
  };

  yield {
    type: "tool.finished" as const,
    taskId,
    tool: "task.complete",
    summary: `Completed report workflow for ${artifact.name}.`
  };

  yield {
    type: "task.finished",
    taskId,
    summary: `${report.executiveSummary}\n\nReport artifact: ${artifact.name}`
  };
}
