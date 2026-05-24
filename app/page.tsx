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

const sessions = [
  { name: "Market scan", status: "active", time: "12:44" },
  { name: "Node project setup", status: "waiting", time: "11:18" },
  { name: "Report artifact", status: "done", time: "Yesterday" }
];

const events = [
  { icon: CircleDot, label: "Planning", text: "Break task into research, validation, and artifact steps." },
  { icon: Globe2, label: "Browser", text: "Open source pages and collect references inside sandbox." },
  { icon: TerminalSquare, label: "Shell", text: "Prepare workspace and generate markdown report." },
  { icon: ShieldCheck, label: "Approval", text: "Dependency install requires task-level permission." }
];

const artifacts = [
  { icon: FileText, name: "research-report.md", meta: "Markdown · 18 KB" },
  { icon: Archive, name: "workspace.zip", meta: "Archive · 240 KB" }
];

export default function Home() {
  return (
    <main className="min-h-screen p-4 text-[var(--foreground)] md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1500px] grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">DeepAgents</p>
            <h1 className="mt-2 font-serif text-3xl leading-none">Agent Desk</h1>
          </div>
          <div className="p-3">
            <button className="flex h-11 w-full items-center justify-center gap-2 border border-[var(--foreground)] bg-[var(--foreground)] px-3 text-sm font-semibold text-[var(--panel)]">
              <Play size={16} />
              New task
            </button>
          </div>
          <nav className="space-y-2 p-3 pt-0">
            {sessions.map((session) => (
              <a
                className="block border border-[var(--line)] bg-white/55 p-3 transition hover:border-[var(--accent)] hover:bg-white"
                href="#"
                key={session.name}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold">{session.name}</span>
                  <span className="text-[10px] uppercase text-[var(--muted)]">{session.time}</span>
                </div>
                <p className="mt-2 text-xs capitalize text-[var(--muted)]">{session.status}</p>
              </a>
            ))}
          </nav>
        </aside>

        <section className="flex min-h-[720px] flex-col border border-[var(--line)] bg-[var(--panel)]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Session sandbox</p>
              <h2 className="mt-1 text-xl font-semibold">Persistent E2B workspace</h2>
            </div>
            <div className="flex items-center gap-2 border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-xs font-semibold">
              <span className="h-2 w-2 bg-[var(--accent)]" />
              Ready for task
            </div>
          </header>

          <div className="flex-1 space-y-5 overflow-hidden p-4">
            <article className="max-w-[760px] border border-[var(--line)] bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">User</p>
              <p className="mt-2 text-sm leading-6">
                Research the latest browser automation options for sandboxed agents and generate a concise markdown report.
              </p>
            </article>

            <article className="ml-auto max-w-[820px] border border-[var(--line)] bg-[var(--panel-strong)] p-4">
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Agent plan</p>
              <ol className="mt-3 space-y-2 text-sm leading-6">
                <li>1. Check task permissions for web access and file export.</li>
                <li>2. Browse official documentation and implementation references.</li>
                <li>3. Write findings to the sandbox workspace.</li>
                <li>4. Package the report as an artifact.</li>
              </ol>
            </article>

            <div className="grid gap-3 md:grid-cols-2">
              {events.map((event) => (
                <div className="border border-[var(--line)] bg-white/60 p-4" key={event.label}>
                  <div className="flex items-center gap-2">
                    <event.icon size={16} />
                    <span className="text-xs font-semibold uppercase text-[var(--muted)]">{event.label}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6">{event.text}</p>
                </div>
              ))}
            </div>
          </div>

          <form className="border-t border-[var(--line)] p-4">
            <label className="sr-only" htmlFor="task">
              Task
            </label>
            <div className="flex min-h-16 items-end gap-3 border border-[var(--line)] bg-white p-3">
              <textarea
                className="min-h-10 flex-1 resize-none border-0 bg-transparent text-sm outline-none"
                id="task"
                placeholder="Describe a task for the sandboxed agent..."
              />
              <button className="flex h-10 items-center gap-2 bg-[var(--accent)] px-4 text-sm font-semibold text-white">
                <Play size={15} />
                Run
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Permissions</p>
            <div className="mt-4 space-y-2 text-sm">
              {["Network access", "File writes", "Artifact export"].map((item) => (
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
              {artifacts.map((artifact) => (
                <div className="flex items-start gap-3 border border-[var(--line)] bg-white/55 p-3" key={artifact.name}>
                  <artifact.icon className="mt-0.5" size={17} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{artifact.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{artifact.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[var(--line)] bg-[var(--foreground)] p-4 text-[var(--panel)]">
            <p className="text-xs font-semibold uppercase text-white/60">Risk queue</p>
            <p className="mt-3 text-sm leading-6">
              High-risk tool calls pause here before they reach the sandbox executor.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
