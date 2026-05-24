# Manus-Like General Agent Design

Date: 2026-05-24

## Goal

Build a Manus-like general agent as a web application. The agent accepts natural-language tasks, plans the work, executes risky actions inside an E2B sandbox, streams progress to the user, and returns summaries plus generated artifacts.

The MVP should prove the general task loop before optimizing any single vertical workflow.

## Product MVP Flow

1. The user opens the web app and creates or resumes a session.
2. The user enters a task in chat.
3. The server creates or reuses one E2B sandbox for that session.
4. DeepAgents JS plans the task, calls tools, and updates progress.
5. Tool execution happens through the sandbox for shell, filesystem, browser, package, and project operations.
6. The UI streams agent progress, tool calls, command output, browser actions, approvals, and artifacts.
7. When the task completes, the user sees a summary, can inspect or download artifacts, and can continue in the same session.

## Architecture

Use a Next.js single application for the first version, but keep module boundaries ready for later worker extraction.

### Modules

- `app/`: chat workspace, session routes, artifact viewer, approval UI.
- `app/api/`: sessions, messages, tasks, events, artifacts, and approvals APIs.
- `lib/agent/`: DeepAgents JS runtime, system prompts, subagents, and tool registry.
- `lib/sandbox/`: E2B sandbox manager for create, resume, command execution, file operations, and artifact collection.
- `lib/policy/`: task permission whitelist and high-risk action checks.
- `lib/store/`: database adapter. Start with SQLite/Prisma for local development, keep Postgres compatibility.
- `lib/events/`: server-side event recording and SSE event streaming.

### Runtime Boundary

The Node.js server is the control plane:

- Owns sessions, tasks, permissions, model calls, event streaming, approval state, and persistence.
- Decides when a tool call is allowed, blocked, or paused for user approval.
- Tracks sandbox lifecycle and artifact metadata.

E2B is the execution plane:

- Runs shell commands, package installs, project tests, browser automation, file generation, and artifact preparation.
- Holds session workspace files during the sandbox lifetime.
- Is treated as disposable execution state, not the source of durable product data.

## Agent Design

Use DeepAgents JS as the primary runtime.

The main agent should:

- Maintain the task plan.
- Select tools.
- Delegate specialized work to subagents.
- Stream progress events.
- Request approval before blocked or risky actions.
- Produce a final answer that links to artifacts and summarizes evidence.

### Initial Subagents

- `researcher`: searches, browses pages, extracts findings, and prepares cited reports.
- `developer`: edits files, runs commands, installs dependencies when permitted, and validates results with tests or checks.

Keep the first subagent set small. Add more only after the execution loop is stable.

## Tool Design

All tools should emit structured `ToolCall` and `EventLog` records.

### MVP Tools

- `shell.exec`: run commands in the E2B sandbox.
- `fs.read`: read files from the sandbox workspace.
- `fs.write`: write files to the sandbox workspace.
- `fs.list`: list sandbox workspace files.
- `browser.open`: open a URL in the sandbox browser environment.
- `browser.click`: click an element.
- `browser.type`: type into an input.
- `browser.screenshot`: capture browser state.
- `search.web`: perform web search and return summarized, source-linked results.
- `artifact.list`: list generated artifacts.
- `artifact.pack`: package selected files as downloadable artifacts.
- `artifact.download`: serve artifacts through the app.
- `approval.request`: pause execution and ask the user to approve or deny a risky action.

### Tool Contract

Each tool should define:

- Input schema.
- Output schema.
- Required permissions.
- Risk level.
- Whether approval is required.
- Timeout.
- Event fields for logging and UI display.

## E2B Sandbox Lifecycle

Use one persistent E2B sandbox per session.

### Creation

Create a sandbox on the first task message in a session. Store:

- `sandboxId`
- `sessionId`
- status
- creation time
- last-used time
- expiration time if available

### Reuse

When a user continues the same session, reuse the existing sandbox if it is alive. If reuse fails, create a new sandbox and emit a clear event that filesystem state may have changed.

### Expiration And Cleanup

Do not destroy the sandbox immediately after task completion. Keep it alive for follow-up work. Periodically clean idle sandboxes and archive known artifacts before cleanup.

The user should be able to reset the sandbox manually.

## Permissions And Safety

Use task-level permission whitelists plus high-risk action confirmation.

### Task Permissions

Supported MVP permissions:

- Network access.
- File writes.
- Dependency installation.
- Long-running commands.
- Access to user-uploaded files.
- Artifact export.

The agent receives the permission state in context and must request approval when a planned action exceeds it.

### High-Risk Actions

Require explicit user approval for:

- Deleting many files or removing important directories.
- Installing system packages.
- Running unknown install scripts.
- Uploading files to external services.
- Using user credentials.
- Executing commands beyond a runtime threshold.
- Git push, deployment, payment, email sending, or any external side effect.

### Auditability

Persist every tool call, approval decision, sandbox lifecycle event, and artifact export.

## Data Model

MVP entities:

- `User`: owner of sessions. Can be a single local user initially.
- `Session`: chat/workspace session with one active sandbox reference.
- `Message`: user, assistant, and system-visible chat messages.
- `Task`: one user request and its execution state.
- `ToolCall`: structured record of each tool invocation and result.
- `ApprovalRequest`: pending or resolved user approval.
- `Artifact`: generated file metadata, preview type, storage path, and source sandbox path.
- `Sandbox`: E2B sandbox metadata and lifecycle state.
- `EventLog`: ordered stream of status, progress, tool, approval, and error events.

Use `userId` even in a single-user MVP so the system can later become multi-user without rewriting core tables.

## Frontend

Do not build a marketing landing page. The first screen is the agent workspace.

### Views

- `Chat Workspace`: session list, chat thread, task progress, and compact tool activity.
- `Approval Modal`: action summary, reason, risk, command or URL details, approve once, deny, and optional remember-for-task.
- `Artifact Viewer`: preview markdown, text, code, images, and screenshots; download unsupported file types.

### Live Feedback

The UI should stream:

- Task plan changes.
- Current step.
- Tool call start and finish.
- Command output snippets.
- Browser screenshots when useful.
- Approval waits.
- Final summary and artifacts.

## Testing And Acceptance Criteria

The MVP is acceptable when these tasks work end to end:

1. Research task: "Research X and generate a markdown report." The agent searches, browses, writes a report artifact, and cites sources.
2. Development task: "Create a simple Node project and run tests." The agent writes files in E2B, installs dependencies if approved, runs tests, and returns results.
3. Dependency approval: a task requiring package installation pauses for permission or approval.
4. Risk approval: delete, upload, long command, or external side-effect actions pause and wait for user approval.
5. Refresh recovery: after page refresh, session messages, task state, events, and artifact metadata remain visible.
6. Sandbox failure recovery: if a sandbox expires or cannot be reused, the system creates a new one and tells the user what changed.

## Implementation Strategy

Start as a Next.js single app to keep the feedback loop fast. Keep agent, sandbox, policy, store, and events as independent modules so the runtime can later move into a separate Node worker.

Initial build order:

1. Scaffold Next.js app, database, and session/task/event models.
2. Add E2B sandbox manager.
3. Add minimal DeepAgents JS runtime with shell, filesystem, and artifact tools.
4. Add SSE event stream and workspace UI.
5. Add approval policy engine.
6. Add browser and web search tools.
7. Add artifact viewer and cleanup flows.

## Open Decisions

- Exact model provider and model names.
- Whether search uses a hosted search API or browser-driven search for the MVP.
- Exact database choice: SQLite for local-first MVP or Postgres from day one.
- Whether browser automation uses E2B browser template support or a custom Playwright setup inside the sandbox.
