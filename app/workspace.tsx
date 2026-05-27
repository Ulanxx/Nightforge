"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Clock3,
  FileText,
  FolderTree,
  Globe2,
  Hammer,
  ListTree,
  MessageSquareQuote,
  PanelLeft,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Wrench
} from "lucide-react";
import { displayTaskStatus, nonRunningTaskStatuses, terminalTaskStatuses } from "@/lib/domain/task";
import type { ArtifactItem, EventItem, MessageItem, SandboxItem, SessionSummary, TaskSummary } from "@/lib/workspace-view";

type WorkspaceProps = {
  activeSessionId: string | null;
  sessions: SessionSummary[];
  tasks: TaskSummary[];
  messages: MessageItem[];
  events: EventItem[];
  artifacts: ArtifactItem[];
  sandbox: SandboxItem | null;
  activeTaskId: string | null;
  activeTaskStatus: string | null;
  activeTaskPrompt: string | null;
  activeTaskSummary: string | null;
};

const eventIconMap = {
  "task.started": CircleDot,
  "task.status": CircleDot,
  "clarification.requested": ShieldCheck,
  "plan.updated": Hammer,
  "artifact.created": Archive,
  "tool.started": TerminalSquare,
  "tool.finished": CheckCircle2,
  "task.failed": CircleAlert,
  "approval.required": ShieldCheck,
  "task.finished": FileText
} as const;

const toolLabels: Record<string, string> = {
  read_file: "读取文件",
  write_file: "写入文件",
  edit_file: "编辑文件",
  grep: "全文搜索",
  glob: "匹配文件",
  ls: "列目录",
  run_command: "执行命令",
  collect_web_materials: "收集网页材料",
  read_web_page: "读取网页",
  create_artifact: "保存产物",
  write_todos: "任务计划",
  task: "子任务",
  "llm.clarification": "澄清判断"
};

const eventLabels: Record<string, string> = {
  "task.started": "任务开始",
  "task.status": "状态更新",
  "clarification.requested": "需要澄清",
  "plan.updated": "计划更新",
  "artifact.created": "产物已创建",
  "tool.started": "工具开始",
  "tool.finished": "工具完成",
  "task.failed": "任务失败",
  "approval.required": "需要确认",
  "task.finished": "任务结束"
};

const mimeTypeLabels: Record<string, string> = {
  "text/markdown; charset=utf-8": "Markdown 文档",
  "text/plain; charset=utf-8": "文本文件",
  "application/json": "JSON 数据"
};

const capabilityItems = [
  { label: "沙箱执行", state: "ready" },
  { label: "读取文件", state: "ready" },
  { label: "写入文件", state: "ready" },
  { label: "网页读取", state: "ready" },
  { label: "全文搜索", state: "ready" },
  { label: "安全命令", state: "ready" },
  { label: "保存产物", state: "ready" },
  { label: "安装依赖", state: "approval" }
] as const;

function formatSessionTime(timestamp: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

function translateKnownSummary(value: string) {
  const dictionary: Record<string, string> = {
    "Check whether the task needs clarification before execution begins.": "判断任务是否需要先澄清。",
    "Check whether the task needs clarification before research begins.": "判断任务是否需要先澄清。",
    "Task needs clarification before planning.": "任务需要先澄清。",
    "Task is specific enough to start planning.": "任务信息足够，可以开始规划。",
    "The request is specific enough to begin planning and execution immediately.": "任务信息足够，可以立即开始执行。",
    "The request is specific enough to begin planning and research immediately.": "任务信息足够，可以立即开始执行。",
    "已收到补充信息，任务正在后台继续执行。": "已收到补充信息，任务正在后台继续执行。",
    "已收到补充信息，正在重新评估任务并继续执行。": "已收到补充信息，正在重新评估任务并继续执行。",
    "General agent started. It can inspect files, search, write, run safe commands, and create artifacts.":
      "通用智能体已启动，可读取文件、搜索、写入、执行安全命令并保存产物。",
    "General agent task completed.": "通用智能体任务已完成。",
    "Task completed.": "任务已完成。",
    "Now I have a thorough understanding of the project. Let me create the comprehensive architecture document":
      "我已经了解项目结构，正在准备架构文档。",
    "The task is specific enough to begin execution immediately.": "任务信息足够，可以立即开始执行。",
    "The task is specific enough to continue execution.": "任务信息足够，可以继续执行。"
  };

  return dictionary[value] ?? value;
}

function describeMimeType(mimeType: string | null) {
  if (!mimeType) {
    return "产物";
  }

  return mimeTypeLabels[mimeType] ?? mimeType;
}

function compactText(value: string, limit = 220) {
  return value.length > limit ? `${value.slice(0, limit).trim()}...` : value;
}

function compactSingleLine(value: string, limit = 100) {
  return compactText(value.replace(/\s+/g, " "), limit);
}

function formatToolSummary(summary: string) {
  const translated = translateKnownSummary(summary);

  try {
    const parsed = JSON.parse(translated) as Record<string, unknown>;
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
      parts.push(`内容：${compactText(parsed.content, 120)}`);
    }

    if (typeof parsed.artifactId === "string") {
      parts.push(`产物编号：${parsed.artifactId}`);
    }

    if (typeof parsed.mimeType === "string") {
      parts.push(`类型：${describeMimeType(parsed.mimeType)}`);
    }

    if (Array.isArray(parsed.sources)) {
      parts.push(`来源数：${parsed.sources.length}`);
    }

    return parts.length > 0 ? parts.join("，") : translated;
  } catch {
    return translated;
  }
}

function summarizeEvent(event: EventItem) {
  if (!event.payload) {
    return event.type;
  }

  switch (event.payload.type) {
    case "task.started":
      return event.payload.message;
    case "task.status":
      return translateKnownSummary(event.payload.summary);
    case "clarification.requested":
      return event.payload.questions.join(" ");
    case "task.failed":
      return translateKnownSummary(event.payload.error);
    case "plan.updated":
      return `计划已生成，共 ${event.payload.steps.length} 步。`;
    case "artifact.created":
      return `产物已生成：${event.payload.name}`;
    case "tool.started":
    case "tool.finished":
      return formatToolSummary(event.payload.summary);
    case "approval.required":
      return event.payload.reason;
    case "task.finished":
      return translateKnownSummary(event.payload.summary);
    default:
      return event.type;
  }
}

function sessionStatus(session: SessionSummary) {
  return displayTaskStatus(session.tasks[0]?.status ?? "idle");
}

function isTaskRunning(status: string | null) {
  return Boolean(status && !nonRunningTaskStatuses.includes(status as (typeof nonRunningTaskStatuses)[number]));
}

function isTaskTerminal(status: string | null) {
  return Boolean(status && terminalTaskStatuses.includes(status as (typeof terminalTaskStatuses)[number]));
}

function toolDisplayName(tool: string) {
  return toolLabels[tool] ?? tool;
}

function statusTone(status: string | null) {
  switch (status) {
    case "completed":
      return "border-[rgba(31,143,99,0.26)] bg-[rgba(31,143,99,0.08)] text-[#166534]";
    case "awaiting_input":
    case "clarifying":
      return "border-[rgba(199,104,40,0.28)] bg-[rgba(199,104,40,0.10)] text-[#9a4e1f]";
    case "failed":
      return "border-[rgba(182,59,59,0.28)] bg-[rgba(182,59,59,0.08)] text-[#8f2b2b]";
    default:
      return "border-[rgba(15,118,110,0.24)] bg-[rgba(15,118,110,0.08)] text-[var(--accent-strong)]";
  }
}

function emptyStateCopy(status: string | null) {
  if (status === "awaiting_input") {
    return "任务正在等待你补充必要信息。补充后，Agent 会在当前会话里继续执行。";
  }

  if (status === "clarifying") {
    return "任务已经提出澄清问题。补充上下文后，智能体会在当前会话里继续执行。";
  }

  if (isTaskRunning(status)) {
    return "当前任务正在后台执行。事件、工具和产物会持续更新到这个工作台。";
  }

  if (status === "completed") {
    return "这次任务已经完成。你可以继续追问、打开产物，或者基于当前上下文发起下一步。";
  }

  if (status === "failed") {
    return "任务已中断。建议补充更明确的目标或约束，然后继续在当前会话里追问。";
  }

  return "当前会话还没有可展示的执行消息。你可以直接继续补充需求。";
}

export function Workspace({
  activeSessionId,
  sessions,
  tasks,
  messages,
  events,
  artifacts,
  sandbox,
  activeTaskId,
  activeTaskStatus,
  activeTaskPrompt,
  activeTaskSummary
}: WorkspaceProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [clarificationReply, setClarificationReply] = useState("");
  const [liveEvents, setLiveEvents] = useState(events);
  const [liveTaskStatus, setLiveTaskStatus] = useState(activeTaskStatus);
  const [liveTaskSummary, setLiveTaskSummary] = useState(activeTaskSummary);
  const [isPending, startTransition] = useTransition();
  const refreshTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeTaskId || !isTaskRunning(liveTaskStatus)) {
      return;
    }

    const eventSource = new EventSource(`/api/tasks/${activeTaskId}/events?stream=1`);

    eventSource.addEventListener("task-event", (messageEvent) => {
      const nextEvent = JSON.parse(messageEvent.data) as EventItem;

      setLiveEvents((current) => {
        if (current.some((event) => event.id === nextEvent.id)) {
          return current;
        }

        return [...current, nextEvent];
      });

      if (nextEvent.payload?.type === "task.status") {
        setLiveTaskStatus(nextEvent.payload.status);
        setLiveTaskSummary(nextEvent.payload.summary);
      }

      if (nextEvent.payload?.type === "task.finished") {
        setLiveTaskStatus("completed");
        setLiveTaskSummary(nextEvent.payload.summary);
      }

      if (
        nextEvent.payload?.type === "clarification.requested" ||
        nextEvent.payload?.type === "artifact.created" ||
        nextEvent.payload?.type === "approval.required" ||
        nextEvent.payload?.type === "task.finished" ||
        nextEvent.payload?.type === "task.failed"
      ) {
        if (refreshTimeoutRef.current) {
          window.clearTimeout(refreshTimeoutRef.current);
        }

        refreshTimeoutRef.current = window.setTimeout(() => {
          router.refresh();
        }, 150);
      }
    });

    return () => {
      eventSource.close();

      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [activeTaskId, liveTaskStatus, router]);

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = message.trim();
    if (!trimmed || !activeSessionId) {
      return;
    }

    setMessage("");

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: activeSessionId,
        message: trimmed,
        permissions: ["network", "file.write", "artifact.export"]
      })
    });

    const result = (await response.json()) as { sessionId: string; taskId: string };

    startTransition(() => {
      router.push(`/tasks/${result.sessionId}?taskId=${result.taskId}`);
      router.refresh();
    });
  }

  async function submitClarification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = clarificationReply.trim();
    if (!trimmed || !activeTaskId) {
      return;
    }

    setClarificationReply("");

    await fetch(`/api/tasks/${activeTaskId}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: trimmed
      })
    });

    startTransition(() => {
      if (activeSessionId && activeTaskId) {
        router.push(`/tasks/${activeSessionId}?taskId=${activeTaskId}`);
      }
      router.refresh();
    });
  }

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const latestPlan = [...liveEvents].reverse().find((event) => event.payload?.type === "plan.updated");
  const latestClarification = [...liveEvents]
    .reverse()
    .find((event) => event.payload?.type === "clarification.requested");
  const latestAssistantMessage = [...messages].reverse().find((item) => item.role === "assistant") ?? null;
  const currentTaskArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.taskId === activeTaskId),
    [activeTaskId, artifacts]
  );
  const toolEvents = useMemo(
    () =>
      liveEvents.filter(
        (event) => event.payload?.type === "tool.started" || event.payload?.type === "tool.finished"
      ),
    [liveEvents]
  );
  const fileToolEvents = useMemo(
    () =>
      toolEvents.filter(
        (event) =>
          event.payload?.type === "tool.started" &&
          ["read_file", "write_file", "edit_file", "grep", "glob", "ls", "run_command", "read_web_page"].includes(
            event.payload.tool
          )
      ),
    [toolEvents]
  );
  const running = isTaskRunning(liveTaskStatus);
  const statusText = displayTaskStatus(liveTaskStatus);
  const eventCountLabel = `${liveEvents.length} 条事件`;
  const taskCountLabel = `${tasks.length} 次任务`;
  const artifactCountLabel = `${currentTaskArtifacts.length} 个当前产物`;
  const currentSummary = liveTaskSummary ?? latestAssistantMessage?.content ?? emptyStateCopy(liveTaskStatus);

  return (
    <main className="min-h-screen bg-[var(--background)] px-3 py-3 text-[var(--foreground)] md:px-4 md:py-4">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1680px] grid-cols-1 gap-3 xl:grid-cols-[288px_minmax(0,1fr)_360px]">
        <aside className="order-2 flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--sidebar)] shadow-[var(--shadow-soft)] xl:order-1 xl:min-h-[720px]">
          <div className="border-b border-[var(--line)] px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--foreground)] text-white">
                <Bot size={18} />
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">DeepAgents</p>
                <h1 className="text-lg font-semibold">任务控制台</h1>
              </div>
            </div>
            <button
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white text-sm font-semibold transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={() => {
                startTransition(() => {
                  router.push("/");
                });
              }}
              type="button"
            >
              <ArrowLeft size={15} />
              新任务 / 返回首页
            </button>
          </div>

          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <span className="text-sm font-semibold">历史会话</span>
            <span className="font-mono text-xs text-[var(--muted)]">{sessions.length}</span>
          </div>

          <nav className="min-h-0 flex-1 space-y-2 overflow-auto px-4 pb-4">
            {sessions.map((session) => {
              const active = session.id === activeSessionId;

              return (
                <a
                  className={
                    active
                      ? "block rounded-[var(--radius-md)] border border-[var(--accent)] bg-white px-4 py-4 shadow-sm"
                      : "block rounded-[var(--radius-md)] border border-[var(--line)] bg-white/72 px-4 py-4 transition hover:border-[var(--accent)] hover:bg-white"
                  }
                  href={`/tasks/${session.id}`}
                  key={session.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-6">{session.title}</p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        {session.messageCount} 条消息 · {session.taskCount} 次任务
                      </p>
                    </div>
                    <span
                      className={
                        active
                          ? "mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]"
                          : "mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--line)]"
                      }
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                    <span className="truncate">{sessionStatus(session)}</span>
                    <span className="shrink-0">{formatSessionTime(session.updatedAt)}</span>
                  </div>
                </a>
              );
            })}
          </nav>
        </aside>

        <section className="order-1 flex min-h-[720px] min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-soft)] xl:order-2">
          <header className="border-b border-[var(--line)] bg-white/84 px-5 py-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">当前会话</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight">
                    {activeSession?.title ?? "任务执行中"}
                  </h2>
                  <p className="mt-2 max-w-[840px] text-sm leading-6 text-[var(--muted)]">
                    这里持续展示任务澄清、执行动作、沙箱活动和最终交付。你可以在同一上下文里继续追加目标。
                  </p>
                </div>

                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${statusTone(liveTaskStatus)}`}
                >
                  {running ? <Clock3 size={15} /> : <CircleDot size={15} />}
                  {running ? `正在执行 · ${statusText}` : `当前状态 · ${statusText}`}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className={`rounded-[var(--radius-md)] border px-4 py-4 ${statusTone(liveTaskStatus)}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <Sparkles size={14} />
                    任务状态带
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                    {translateKnownSummary(currentSummary)}
                  </p>
                  <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
                    命令执行、文件改写和批量处理默认优先在隔离沙箱中完成。
                  </p>
                  {activeTaskPrompt ? (
                    <div className="mt-3 rounded-[var(--radius-md)] border border-black/8 bg-white/70 px-3 py-3 text-sm leading-6 text-[var(--foreground)]">
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">当前任务</p>
                      <p className="mt-2 whitespace-pre-wrap">{activeTaskPrompt}</p>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs md:min-w-[280px]">
                  <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-3">
                    <p className="font-mono uppercase tracking-[0.12em] text-[var(--muted)]">任务</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{taskCountLabel}</p>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-3">
                    <p className="font-mono uppercase tracking-[0.12em] text-[var(--muted)]">事件</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{eventCountLabel}</p>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-3">
                    <p className="font-mono uppercase tracking-[0.12em] text-[var(--muted)]">产物</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{artifactCountLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto px-5 py-5">
            <div className="space-y-5">
              {messages.length === 0 ? (
                <article className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] bg-white/70 p-5 text-sm leading-7 text-[var(--muted)]">
                  {emptyStateCopy(liveTaskStatus)}
                </article>
              ) : null}

              {messages.map((item) => (
                <article
                  className={
                    item.role === "assistant"
                      ? "ml-auto max-w-[860px] rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel-strong)] p-4"
                      : "max-w-[820px] rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4"
                  }
                  key={item.id}
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    {item.role === "assistant" ? "智能体" : "用户"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{item.content}</p>
                </article>
              ))}

              {latestPlan?.payload?.type === "plan.updated" ? (
                <article className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                  <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    <Hammer size={14} />
                    当前计划
                  </p>
                  <ol className="mt-3 space-y-2 text-sm leading-7">
                    {latestPlan.payload.steps.map((step: string, index: number) => (
                      <li key={`${index}-${step}`}>{`${index + 1}. ${step}`}</li>
                    ))}
                  </ol>
                </article>
              ) : null}

              {latestClarification?.payload?.type === "clarification.requested" ? (
                <article className="rounded-[var(--radius-md)] border border-[var(--warning)] bg-[#fff7f0] p-4">
                  <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    <MessageSquareQuote size={14} />
                    待澄清
                  </p>
                  <p className="mt-3 text-sm leading-7">{latestClarification.payload.reason}</p>
                  <ol className="mt-3 space-y-2 text-sm leading-7">
                    {latestClarification.payload.questions.map((question: string, index: number) => (
                      <li key={`${index}-${question}`}>{`${index + 1}. ${question}`}</li>
                    ))}
                  </ol>
                  <form className="mt-4" onSubmit={submitClarification}>
                    <div className="rounded-[var(--radius-md)] border border-[var(--warning)] bg-white p-3">
                      <textarea
                        className="min-h-[120px] w-full resize-none border-0 bg-transparent text-sm leading-7 outline-none"
                        onChange={(event) => setClarificationReply(event.target.value)}
                        placeholder="补充目标、范围、输出要求或约束条件。"
                        value={clarificationReply}
                      />
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
                        <p className="text-xs text-[var(--muted)]">回复会写入当前会话，并在同一个任务里继续执行。</p>
                        <button
                          className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--warning)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                          disabled={isPending || !activeTaskId}
                          type="submit"
                        >
                          <Play size={14} />
                          继续执行
                        </button>
                      </div>
                    </div>
                  </form>
                </article>
              ) : null}

              <section className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white/72 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                      <ListTree size={14} />
                      执行事件流
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">当前任务的状态变化、工具调用和产物创建都会记录在这里。</p>
                  </div>
                  <div className="text-xs text-[var(--muted)]">{liveEvents.length} 条记录</div>
                </div>

                <div className="mt-4 space-y-3">
                  {liveEvents.length === 0 ? (
                    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                      任务事件还没有产生，后台开始执行后会自动刷新。
                    </div>
                  ) : null}

                  {liveEvents.map((event) => {
                    const Icon = eventIconMap[event.type as keyof typeof eventIconMap] ?? Globe2;

                    return (
                      <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4" key={event.id}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Icon size={16} />
                            <span className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                              {event.payload?.type === "tool.started" || event.payload?.type === "tool.finished"
                                ? `${event.payload.type === "tool.started" ? "工具开始" : "工具完成"} / ${toolDisplayName(event.payload.tool)}`
                                : eventLabels[event.type] ?? event.type}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-[var(--muted)]">{formatSessionTime(event.createdAt)}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{compactText(summarizeEvent(event), 520)}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          <form className="border-t border-[var(--line)] bg-white/84 p-4" onSubmit={submitTask}>
            <label className="sr-only" htmlFor="task-input">
              输入任务
            </label>
            <div className="rounded-[22px] border border-[var(--line)] bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <textarea
                className="min-h-[112px] w-full resize-none border-0 bg-transparent text-sm leading-7 outline-none"
                id="task-input"
                onChange={(event) => setMessage(event.target.value)}
                placeholder="继续追加目标，例如：把刚才的结果改成正式说明文，再生成一个清单类产物。"
                value={message}
              />
              <div className="mt-3 flex flex-col gap-3 border-t border-[var(--line)] pt-3 md:flex-row md:items-center md:justify-between">
                <div className="text-xs leading-6 text-[var(--muted)]">新输入会保留在当前会话里，形成连续任务上下文。</div>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--ink-soft)] disabled:opacity-60"
                  disabled={isPending || !activeSessionId}
                  type="submit"
                >
                  <Play size={15} />
                  {isPending ? "提交中" : "继续任务"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="order-3 min-w-0 space-y-3">
          <section className="rounded-[var(--radius-lg)] border border-[var(--foreground)] bg-[var(--foreground)] p-5 text-white shadow-[var(--shadow-soft)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">当前总结</p>
            <p className="mt-4 text-sm leading-7 text-white/88">{translateKnownSummary(currentSummary)}</p>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)]">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <ShieldCheck size={14} />
              可用能力
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Agent 会先判断需求是否足够明确；需要执行时，默认优先走沙箱环境而不是直接碰宿主环境。
            </p>
            <div className="mt-4 grid gap-2">
              {capabilityItems.map((item) => (
                <div
                  className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--line)] bg-white/70 px-3 py-3"
                  key={item.label}
                >
                  <span className="text-sm">{item.label}</span>
                  {item.state === "ready" ? (
                    <CheckCircle2 className="text-[var(--accent)]" size={16} />
                  ) : (
                    <span className="text-xs font-semibold text-[var(--warning)]">需确认</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)]">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <Wrench size={14} />
              执行动作
            </p>
            <div className="mt-4 space-y-2">
              {toolEvents.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                  暂无工具调用。
                </div>
              ) : null}
              {toolEvents.slice(-8).reverse().map((event) => {
                if (event.payload?.type !== "tool.started" && event.payload?.type !== "tool.finished") {
                  return null;
                }

                return (
                  <div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white/70 p-3" key={event.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{toolDisplayName(event.payload.tool)}</span>
                      <span className="font-mono text-[11px] uppercase text-[var(--muted)]">
                        {event.payload.type === "tool.started" ? "开始" : "完成"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                      {compactText(formatToolSummary(event.payload.summary), 180)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)]">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <TerminalSquare size={14} />
              沙箱执行
            </p>
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white/70 p-3 text-sm leading-6 text-[var(--muted)]">
              {sandbox ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--foreground)]">状态：{sandbox.status}</p>
                  <p>沙箱编号：{compactSingleLine(sandbox.sandboxId, 42)}</p>
                  <p>最近活跃：{formatSessionTime(sandbox.lastUsedAt)}</p>
                  <p>创建时间：{formatSessionTime(sandbox.createdAt)}</p>
                  <p>{sandbox.expiresAt ? `预计过期：${formatSessionTime(sandbox.expiresAt)}` : "当前为持久会话沙箱。"}</p>
                </div>
              ) : (
                "当前会话还没有初始化沙箱。提交任务后，这里会展示真实的沙箱状态和最近活跃时间。"
              )}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)]">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              <FolderTree size={14} />
              文件活动
            </p>
            <div className="mt-4 space-y-2">
              {fileToolEvents.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                  暂无文件活动。
                </div>
              ) : null}
              {fileToolEvents.slice(-6).reverse().map((event) => {
                if (event.payload?.type !== "tool.started") {
                  return null;
                }

                return (
                  <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-white/70 p-3" key={event.id}>
                    {event.payload.tool === "grep" ? <Search className="mt-0.5" size={16} /> : <FileText className="mt-0.5" size={16} />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{toolDisplayName(event.payload.tool)}</p>
                      <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                        {compactText(formatToolSummary(event.payload.summary), 160)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                <Archive size={14} />
                当前任务产物
              </p>
              <span className="text-xs text-[var(--muted)]">{currentTaskArtifacts.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {currentTaskArtifacts.length === 0 ? (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                  当前任务还没有生成产物。
                </div>
              ) : null}
              {currentTaskArtifacts.map((artifact) => (
                <a
                  className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-white/70 p-3 transition hover:border-[var(--accent)] hover:bg-white"
                  href={`/api/artifacts/${artifact.id}`}
                  key={artifact.id}
                  target="_blank"
                >
                  <Archive className="mt-0.5 shrink-0" size={17} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{artifact.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {describeMimeType(artifact.mimeType)} · {formatSessionTime(artifact.createdAt)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                <PanelLeft size={14} />
                历史任务
              </p>
              <span className="text-xs text-[var(--muted)]">{tasks.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {tasks.map((task, index) => (
                <a
                  className={
                    task.id === activeTaskId
                      ? "rounded-[var(--radius-md)] border border-[var(--accent)] bg-white p-3"
                      : "rounded-[var(--radius-md)] border border-[var(--line)] bg-white/70 p-3"
                  }
                  href={activeSessionId ? `/tasks/${activeSessionId}?taskId=${task.id}` : "#"}
                  key={task.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{`任务 ${tasks.length - index}`}</span>
                    <span className="text-xs text-[var(--muted)]">{displayTaskStatus(task.status)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{compactSingleLine(task.prompt, 140)}</p>
                </a>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
