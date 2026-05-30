"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Bot, Clock3, FolderClock, Sparkles } from "lucide-react";
import { displayTaskStatus } from "@/lib/domain/task";
import type { SessionSummary } from "@/lib/workspace-view";

type HomeShellProps = {
  sessions: SessionSummary[];
};

const suggestedTasks = [
  "整理这批网页和本地材料，输出一份可交付总结",
  "读取目录里的文件，归纳重点并生成结构化清单",
  "根据我给的目标和资料，产出一份正式说明文档",
  "需要的话请直接处理文件，并把结果整理成产物"
];

function formatSessionTime(timestamp: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

export function HomeShell({ sessions }: HomeShellProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function createTask(prompt: string) {
    const trimmed = prompt.trim();

    if (!trimmed) {
      return;
    }

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = message;
    setMessage("");
    await createTask(current);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto grid min-h-screen max-w-[1680px] grid-cols-1 lg:grid-cols-[296px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--line)] bg-[var(--sidebar)] lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="border-b border-[var(--line)] px-5 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--foreground)] text-white">
                  <Bot size={20} />
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">DeepAgents</p>
                  <h1 className="text-lg font-semibold">任务执行 Agent</h1>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                直接交代目标。Agent 会判断是否需要补充信息，自行读取网页和文件，必要时进入沙箱执行，并返回可用结果。
              </p>
            </div>

            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FolderClock size={16} />
                最近会话
              </div>
              <span className="font-mono text-xs text-[var(--muted)]">{sessions.length}</span>
            </div>

            <nav className="min-h-0 flex-1 space-y-2 overflow-auto px-4 pb-4">
              {sessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/70 px-4 py-5 text-sm text-[var(--muted)]">
                  还没有会话。输入一个任务后，这里会保留历史。
                </div>
              ) : null}

              {sessions.map((session) => (
                <a
                  className="block rounded-2xl border border-[var(--line)] bg-white/72 px-4 py-4 transition hover:border-[var(--accent)] hover:bg-white"
                  href={`/tasks/${session.id}`}
                  key={session.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="line-clamp-2 text-sm font-semibold leading-6">{session.title}</span>
                    <ArrowRight className="shrink-0 text-[var(--muted)]" size={15} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>{displayTaskStatus(session.tasks[0]?.status)}</span>
                    <span>{formatSessionTime(session.updatedAt)}</span>
                  </div>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.15),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(199,104,40,0.12),transparent_28%)]" />
          <div className="relative mx-auto flex min-h-screen w-full max-w-[980px] flex-col justify-center px-6 py-12 md:px-10">
            <div className="max-w-[760px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">任务入口</p>
              <h2 className="mt-5 font-serif text-5xl leading-[1.05] text-[var(--foreground)] md:text-7xl">
                直接交任务，
                <br />
                把执行过程交给 Agent。
              </h2>
              <p className="mt-6 max-w-[640px] text-lg leading-8 text-[var(--muted)]">
                你只需要描述目标。系统会先澄清必要信息，再整合网页、本地文件和当前上下文执行任务，最后自动决定回复还是产物交付。
              </p>
            </div>

            <form className="mt-12" onSubmit={submitTask}>
              <div className="rounded-[28px] border border-[var(--line)] bg-white/92 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
                <textarea
                  className="min-h-[164px] w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-7 outline-none placeholder:text-[var(--muted)]"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="例如：读取这个目录和我补充的背景信息，必要时上网补资料，把内容整理成一份中文说明和结构化清单。"
                  value={message}
                />
                <div className="mt-4 flex flex-col gap-3 border-t border-[var(--line)] pt-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {suggestedTasks.map((task) => (
                      <button
                        className="rounded-full border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                        key={task}
                        onClick={() => setMessage(task)}
                        type="button"
                      >
                        {task}
                      </button>
                    ))}
                  </div>
                  <button
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--ink-soft)] disabled:opacity-60"
                    disabled={isPending}
                    type="submit"
                  >
                    <Sparkles size={16} />
                    {isPending ? "正在进入任务页" : "提交任务"}
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-2">
                <Clock3 size={15} />
                提交后自动跳转任务页
              </span>
              <span>支持读取网页、分析文件、沙箱执行、生成产物</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
