"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Archive,
  CheckCircle2,
  CircleDot,
  FileText,
  Globe2,
  Play,
  ShieldCheck,
  TerminalSquare
} from "lucide-react";

type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  tasks: Array<{ status: string }>;
};

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type EventPayload =
  | { type: "task.started"; message: string }
  | { type: "task.status"; status: string; summary: string }
  | { type: "clarification.requested"; reason: string; questions: string[] }
  | { type: "plan.updated"; steps: string[] }
  | { type: "artifact.created"; artifactId: string; name: string; mimeType: string | null }
  | { type: "tool.started" | "tool.finished"; tool: string; summary: string }
  | { type: "task.failed"; error: string }
  | { type: "approval.required"; reason: string }
  | { type: "task.finished"; summary: string }
  | null;

type EventItem = {
  id: string;
  type: string;
  createdAt: string;
  payload: EventPayload;
};

type Artifact = {
  id: string;
  name: string;
  mimeType: string | null;
};

type WorkspaceProps = {
  activeSessionId: string | null;
  sessions: SessionSummary[];
  messages: Message[];
  events: EventItem[];
  artifacts: Artifact[];
  activeTaskId: string | null;
  activeTaskStatus: string | null;
};

const eventIconMap = {
  "task.started": CircleDot,
  "task.status": CircleDot,
  "clarification.requested": ShieldCheck,
  "plan.updated": CircleDot,
  "artifact.created": Archive,
  "tool.started": TerminalSquare,
  "tool.finished": CheckCircle2,
  "task.failed": ShieldCheck,
  "approval.required": ShieldCheck,
  "task.finished": FileText
} as const;

const permissionItems = ["Network access", "File writes", "Artifact export"];

function formatSessionTime(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function summarizeEvent(event: EventItem) {
  if (!event.payload) {
    return event.type;
  }

  switch (event.payload.type) {
    case "task.started":
      return event.payload.message;
    case "task.status":
      return event.payload.summary;
    case "clarification.requested":
      return event.payload.questions.join(" ");
    case "task.failed":
      return event.payload.error;
    case "plan.updated":
      return `Plan with ${event.payload.steps.length} steps ready.`;
    case "artifact.created":
      return `Artifact ready: ${event.payload.name}`;
    case "tool.started":
    case "tool.finished":
      return event.payload.summary;
    case "approval.required":
      return event.payload.reason;
    case "task.finished":
      return event.payload.summary;
    default:
      return event.type;
  }
}

function sessionStatus(session: SessionSummary) {
  return session.tasks[0]?.status ?? "idle";
}

function isTaskRunning(status: string | null) {
  return Boolean(status && !["completed", "failed", "clarifying"].includes(status));
}

export function Workspace({
  activeSessionId,
  sessions,
  messages,
  events,
  artifacts,
  activeTaskId,
  activeTaskStatus
}: WorkspaceProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [clarificationReply, setClarificationReply] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isTaskRunning(activeTaskStatus)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [activeTaskStatus, router]);

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    const payload = {
      sessionId: activeSessionId ?? undefined,
      message: trimmed,
      permissions: ["network", "file.write", "artifact.export"]
    };

    setMessage("");

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as { sessionId: string; taskId: string };

    startTransition(() => {
      router.push(`/?sessionId=${result.sessionId}#active`);
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
      router.refresh();
    });
  }

  const latestPlan = [...events].reverse().find((event: EventItem) => event.payload?.type === "plan.updated");
  const latestClarification = [...events]
    .reverse()
    .find((event: EventItem) => event.payload?.type === "clarification.requested");
  const latestSummary = [...messages].reverse().find((item) => item.role === "assistant");

  return (
    <main className="min-h-screen p-4 text-[var(--foreground)] md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1500px] grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">DeepAgents</p>
            <h1 className="mt-2 font-serif text-3xl leading-none">Agent Desk</h1>
          </div>
          <div className="p-3">
            <button
              className="flex h-11 w-full items-center justify-center gap-2 border border-[var(--foreground)] bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--panel)]"
              onClick={() => {
                startTransition(() => {
                  router.refresh();
                });
              }}
              type="button"
            >
              <Play size={16} />
              New task
            </button>
          </div>
          <nav className="space-y-2 p-3 pt-0">
            {sessions.length === 0 ? (
              <div className="border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                No sessions yet.
              </div>
            ) : null}
            {sessions.map((session) => (
              <a
                className="block border border-[var(--line)] bg-white/55 p-3 transition hover:border-[var(--accent)] hover:bg-white"
                href={session.id === activeSessionId ? "#active" : `/?sessionId=${session.id}`}
                key={session.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold">{session.title}</span>
                  <span className="text-[10px] uppercase text-[var(--muted)]">
                    {formatSessionTime(session.updatedAt)}
                  </span>
                </div>
                <p className="mt-2 text-xs capitalize text-[var(--muted)]">{sessionStatus(session)}</p>
              </a>
            ))}
          </nav>
        </aside>

        <section className="flex min-h-[720px] flex-col border border-[var(--line)] bg-[var(--panel)]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Session sandbox</p>
              <h2 className="mt-1 text-xl font-semibold">
                {activeSessionId ? "Persistent workspace active" : "Ready for first task"}
              </h2>
            </div>
            <div className="flex items-center gap-2 border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-xs font-semibold">
              <span className="h-2 w-2 bg-[var(--accent)]" />
              {isTaskRunning(activeTaskStatus)
                ? `Task running: ${activeTaskStatus}`
                : events.length > 0
                  ? "Task history loaded"
                  : "Ready for task"}
            </div>
          </header>

          <div className="flex-1 space-y-5 overflow-auto p-4">
            {messages.length === 0 ? (
              <article className="max-w-[760px] border border-dashed border-[var(--line)] bg-white/60 p-4 text-sm text-[var(--muted)]">
                Submit a research task to create the first persisted session.
              </article>
            ) : null}

            {messages.map((item) => (
              <article
                className={
                  item.role === "assistant"
                    ? "ml-auto max-w-[820px] border border-[var(--line)] bg-[var(--panel-strong)] p-4"
                    : "max-w-[760px] border border-[var(--line)] bg-white/70 p-4"
                }
                key={item.id}
              >
                <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                  {item.role === "assistant" ? "Agent" : "User"}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.content}</p>
              </article>
            ))}

            {latestPlan?.payload?.type === "plan.updated" ? (
              <article className="ml-auto max-w-[820px] border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                <p className="text-xs font-semibold uppercase text-[var(--muted)]">Agent plan</p>
                <ol className="mt-3 space-y-2 text-sm leading-6">
                  {latestPlan.payload.steps.map((step: string) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
            ) : null}

            {latestClarification?.payload?.type === "clarification.requested" ? (
              <article className="ml-auto max-w-[820px] border border-[var(--warning)] bg-[var(--panel-strong)] p-4">
                <p className="text-xs font-semibold uppercase text-[var(--muted)]">Clarification needed</p>
                <p className="mt-2 text-sm leading-6">{latestClarification.payload.reason}</p>
                <ol className="mt-3 space-y-2 text-sm leading-6">
                  {latestClarification.payload.questions.map((question: string) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
                <form className="mt-4" onSubmit={submitClarification}>
                  <div className="flex min-h-16 items-end gap-3 border border-[var(--warning)] bg-white p-3">
                    <textarea
                      className="min-h-10 flex-1 resize-none border-0 bg-transparent text-sm outline-none"
                      onChange={(event) => setClarificationReply(event.target.value)}
                      placeholder="Answer the clarification questions so the agent can continue..."
                      value={clarificationReply}
                    />
                    <button
                      className="flex h-10 items-center gap-2 bg-[var(--warning)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={isPending || !activeTaskId}
                      type="submit"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              </article>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              {events.map((event) => {
                const Icon = eventIconMap[event.type as keyof typeof eventIconMap] ?? Globe2;

                return (
                  <div className="border border-[var(--line)] bg-white/60 p-4" key={event.id}>
                    <div className="flex items-center gap-2">
                      <Icon size={16} />
                      <span className="text-xs font-semibold uppercase text-[var(--muted)]">
                        {event.type}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6">{summarizeEvent(event)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <form className="border-t border-[var(--line)] p-4" onSubmit={submitTask}>
            <label className="sr-only" htmlFor="task">
              Task
            </label>
            <div className="flex min-h-16 items-end gap-3 border border-[var(--line)] bg-white p-3">
              <textarea
                className="min-h-10 flex-1 resize-none border-0 bg-transparent text-sm outline-none"
                id="task"
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Describe a research task for the agent..."
                value={message}
              />
              <button
                className="flex h-10 items-center gap-2 bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isPending}
                type="submit"
              >
                <Play size={15} />
                {isPending ? "Running" : "Run"}
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Permissions</p>
            <div className="mt-4 space-y-2 text-sm">
              {permissionItems.map((item) => (
                <div className="flex items-center justify-between border border-[var(--line)] bg-white/55 p-3" key={item}>
                  <span>{item}</span>
                  <CheckCircle2 className="text-[var(--accent)]" size={16} />
                </div>
              ))}
              <div className="flex items-center justify-between border border-[var(--line)] bg-white/55 p-3">
                <span>Dependency install</span>
                <span className="text-xs font-semibold text-[var(--warning)]">Confirm</span>
              </div>
            </div>
          </section>

          <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Artifacts</p>
            <div className="mt-4 space-y-2">
              {artifacts.length === 0 ? (
                <div className="border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                  No artifacts yet.
                </div>
              ) : null}
              {artifacts.map((artifact) => (
                <a
                  className="flex items-start gap-3 border border-[var(--line)] bg-white/55 p-3 transition hover:border-[var(--accent)] hover:bg-white"
                  href={`/api/artifacts/${artifact.id}`}
                  key={artifact.id}
                  target="_blank"
                >
                  <Archive className="mt-0.5" size={17} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{artifact.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{artifact.mimeType ?? "Artifact"}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section className="border border-[var(--line)] bg-[var(--foreground)] p-4 text-[var(--panel)]">
            <p className="text-xs font-semibold uppercase text-white/60">Current summary</p>
            <p className="mt-3 text-sm leading-6">
              {latestSummary?.content ?? "The workspace will show the latest assistant summary here."}
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
