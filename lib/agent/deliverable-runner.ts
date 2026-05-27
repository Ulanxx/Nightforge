import {
  fetchSourceContent,
  formatArtifactMarkdown,
  selectWebSources,
  synthesizeTaskDeliverable,
  writeArtifactDocument
} from "@/lib/agent/web-input";
import type { AgentRuntimeEvent } from "@/lib/agent/runtime";
import { createArtifact } from "@/lib/store/artifacts";

export async function* runTaskDeliverableFlow({
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
    status: "executing",
    summary: "执行计划已确定，正在收集网页材料并提取可用内容。"
  };

  yield {
    type: "tool.started" as const,
    taskId,
    tool: "web.collect",
    summary: "选择一组与当前任务最相关的公开网页材料。"
  };

  const sourceSelection = await selectWebSources(prompt);

  yield {
    type: "tool.finished" as const,
    taskId,
    tool: "web.collect",
    summary: `已选定 ${sourceSelection.sources.length} 个网页输入材料。`
  };

  const sources = [];

  for (const source of sourceSelection.sources) {
    yield {
      type: "tool.started" as const,
      taskId,
      tool: "web.read",
      summary: `读取网页材料：${source.title}`
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
        summary: `已获取网页内容：${source.title}`
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知抓取错误。";

      yield {
        type: "tool.finished" as const,
        taskId,
        tool: "web.read",
        summary: `已跳过网页材料：${source.title}（${message}）`
      };
    }
  }

  if (sources.length === 0) {
    throw new Error("没有成功获取任何网页内容。");
  }

  yield {
    type: "tool.started" as const,
    taskId,
    tool: "artifact.compose",
    summary: "正在把已收集材料整理成正式 Markdown 交付物。"
  };

  const report = await synthesizeTaskDeliverable({
    prompt,
    sources
  });
  const markdown = formatArtifactMarkdown(report, sources);
  const artifactFile = await writeArtifactDocument({
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
    tool: "artifact.compose",
    summary: `交付产物已生成：${artifact.name}`
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
    summary: "正式交付物已生成并保存为产物。"
  };

  yield {
    type: "tool.finished" as const,
    taskId,
    tool: "task.complete",
    summary: `任务产出已完成：${artifact.name}。`
  };

  yield {
    type: "task.finished",
    taskId,
    summary: `${report.executiveSummary}\n\n交付产物：${artifact.name}`
  };
}
