# Manus-Like Research Agent V1 Design

Date: 2026-05-24

## Goal

Build the first usable Manus-like vertical for this project: a research agent that clarifies scope, researches public web sources, and delivers a structured report artifact with citations.

This version should feel like a real agent workspace, not a static chat demo. It must show visible progress, preserve state across refresh, and produce a formal report that a business user can read and share.

## Product Scope

V1 is intentionally narrow.

Included:

- Public web research only.
- One task flow: clarify -> plan -> research -> synthesize -> report.
- Structured markdown report artifact with citations and source links.
- Session persistence, task persistence, event logging, and artifact metadata.
- Manus-like workspace with session rail, main task area, and right-side context panel.

Excluded from V1:

- Uploaded document analysis.
- Code repository analysis.
- Multi-agent orchestration beyond an internal planner/executor split.
- Complex browser workflows such as login, forms, or multi-step site interaction.
- External side effects beyond web reads and artifact export.

## Primary User

The target user is a business user who wants a concise but formal research deliverable.

The report should optimize for:

- Fast comprehension.
- Clear conclusions up front.
- Structured sections.
- Trust through source visibility.

It should not read like an academic paper or a raw evidence dump.

## V1 User Flow

1. The user opens or creates a session.
2. The user submits a research request.
3. The agent decides whether key context is missing.
4. If needed, the agent asks up to 3 clarifying questions.
5. Once the task is sufficiently scoped, the agent presents a short research plan.
6. The agent searches public web sources and browses selected pages.
7. The agent extracts evidence, tracks sources, and emits visible progress events.
8. The agent synthesizes findings into a structured report.
9. The system stores the report as an artifact and shows a preview plus download entry.
10. The user can continue the session with follow-up questions or revision requests.

## Product Principles

### Visible Progress

The user should always know what the agent is doing now, what step comes next, and why the task is waiting if it pauses.

### Artifact First

The end product is a report artifact, not only a chat answer.

### Source Trust

The report should be grounded in a curated set of high-quality sources. V1 should target roughly 6 to 12 core sources instead of maximizing count.

### Minimal Clarification

The agent should be proactive, but not interrogative. It should ask only the minimum set of questions needed to produce a reliable report.

## Workspace Design

V1 uses a balanced three-column workspace.

### Left Rail

- Create new research task.
- Switch sessions.
- Access recent reports.

This rail should stay lightweight. Do not turn it into a project management surface in V1.

### Main Workspace

The main workspace is the primary narrative surface for the task:

- Task intake.
- Clarifying questions.
- Research plan.
- Execution feed.
- Final summary and delivery.

This center column should preserve the user's feeling that they are collaborating with one agent on one continuous task.

### Right Context Panel

- Source queue and visited sources.
- Task status.
- Approval state.
- Artifact preview and download entry.

This panel exists to keep trust and orientation high during execution. It should not degrade into a raw log viewer.

## Task Lifecycle

The task state machine for V1:

- `draft`
- `clarifying`
- `planning`
- `researching`
- `synthesizing`
- `report_ready`
- `completed`
- `failed`
- `approval_required`

Rules:

- New tasks enter `clarifying` if required fields are missing, otherwise `planning`.
- `planning` should produce a visible plan before research begins.
- `researching` captures source discovery, browsing, and extraction.
- `synthesizing` is the report-writing phase.
- `report_ready` means the artifact exists and can be previewed.
- `completed` means the task summary and artifact metadata are persisted.

## Report Contract

V1 report output should be a markdown artifact with a stable section structure:

1. Executive summary.
2. Key findings.
3. Sectioned analysis.
4. Risks, gaps, or uncertainty notes.
5. Source list with links.

Tone:

- Business-readable.
- Concrete.
- Not overly long by default.
- Strongly linked to evidence.

## System Design

### 1. Conversation Orchestrator

Responsibilities:

- Accept incoming task messages.
- Decide whether clarification is required.
- Limit clarification to 1 to 3 necessary questions.
- Transition the task into planning once scoped.

This module owns user-facing task progression. It should not directly contain browser or search logic.

### 2. Research Planner

Responsibilities:

- Convert the user request into a research plan.
- Define research dimensions.
- Define expected report sections.
- Define source strategy and source count target.

The plan should be brief and visible in the UI.

### 3. Research Executor

Responsibilities:

- Perform web search.
- Select candidate sources.
- Open pages.
- Extract relevant text or evidence.
- De-duplicate low-value sources.
- Emit progress events tied to sources.

This module is the core execution loop for V1.

### 4. Report Synthesizer

Responsibilities:

- Turn evidence into a formal report.
- Produce executive summary first.
- Keep uncertainty explicit.
- Attach citations and source links.
- Save the report as an artifact.

### 5. Workspace State And Event Log

Responsibilities:

- Persist sessions, tasks, messages, events, artifacts, and approvals.
- Support refresh recovery.
- Support replay of task progress in the UI.

This is required for a Manus-like experience. Without it, the system becomes a one-shot API demo.

### 6. Policy And Approval

Responsibilities:

- Enforce task permissions.
- Guard risky actions.
- Pause and resume execution around approval decisions.

V1 research may not trigger many approvals, but the framework must exist because it is part of the product identity and future task expansion.

## Suggested Data Responsibilities

Current Prisma models are already close to the needed shape.

Use them with these responsibilities:

- `Session`: workspace continuity.
- `Message`: user and assistant conversation.
- `Task`: task prompt, lifecycle state, final summary.
- `ToolCall`: structured tool execution record.
- `ApprovalRequest`: approval pauses and outcomes.
- `Artifact`: report artifact metadata and storage path.
- `Sandbox`: active execution environment per session.
- `EventLog`: replayable execution feed.

V1 should avoid adding new top-level entities unless a real gap appears during implementation.

## API Direction

The current `POST /api/tasks` route should evolve from a placeholder into the main task entrypoint.

Expected V1 API surface:

- `POST /api/tasks`
  - Create task.
  - Store user message.
  - Enter clarification or execution flow.

- `POST /api/tasks/:taskId/reply`
  - Accept clarification answers.
  - Resume task execution.

- `GET /api/sessions/:sessionId`
  - Load session shell.

- `GET /api/sessions/:sessionId/messages`
  - Load conversation history.

- `GET /api/tasks/:taskId/events`
  - Load or stream execution feed.

- `GET /api/artifacts/:artifactId`
  - Load or download report artifact.

V1 can use polling first if needed, but SSE is the target because the experience depends on live progress.

## Frontend Behavior

### Task Intake

The task input should ask for a research topic in natural language. It does not need a long form. The agent should infer missing details and ask follow-up questions only when needed.

### Clarification

Clarification should appear inline in the main conversation area. The UI should make it clear that the task has not started researching yet.

### Research Plan

The plan should be compact and readable, for example:

- Objective.
- Research angles.
- Source strategy.
- Planned output sections.

### Execution Feed

The feed should emphasize meaningful milestones:

- Clarification complete.
- Plan generated.
- Searching sources.
- Reading page.
- Added source.
- Writing report.
- Report ready.

Do not dump raw low-signal logs into the primary UI in V1.

### Sources Panel

The right panel should show:

- Source title.
- Domain.
- Status such as queued, visited, cited.
- Link out if available.

This is critical for trust and for demonstrating that the system is not fabricating unsupported conclusions.

### Artifact Delivery

When the report is ready, show:

- Title.
- Format.
- Preview snippet.
- Open/download action.

The artifact should also be listed in session history.

## Implementation Strategy

Build V1 in five phases.

### Phase 1: Persistent Task Backbone

- Add database-backed session, message, task, and event persistence.
- Replace in-memory task handling with persistent task creation.
- Implement the task state machine.
- Load state after refresh.

Acceptance signal:

The user can refresh the page and still see the session, messages, and task progress.

### Phase 2: Clarification And Planning

- Add clarification decision logic.
- Add a resume endpoint for clarification answers.
- Render clarification prompts in the workspace.
- Add visible plan generation.

Acceptance signal:

Research tasks either start directly with a visible plan or ask a small number of clarification questions first.

### Phase 3: Public Web Research Loop

- Add search and page-read tools.
- Track source records through events and tool calls.
- Persist source-related task progress.
- Add source visibility in the right panel.

Acceptance signal:

The agent can collect a curated set of public web sources and show progress while doing it.

### Phase 4: Report Artifact Generation

- Generate markdown reports with citations.
- Save artifact metadata.
- Support report preview and download.
- Store final task summary.

Acceptance signal:

The task ends with a formal report artifact and a concise final summary in the workspace.

### Phase 5: Manus-Like Product Polish

- Improve event streaming.
- Improve source/status visualization.
- Add approval framework in the UI.
- Tighten task transitions and retry behavior.

Acceptance signal:

The product feels like an interactive agent workspace instead of a stitched-together API shell.

## Success Criteria

V1 is successful when all of the following are true:

- A user can submit a public-web research task in natural language.
- The agent asks up to 3 necessary clarification questions when needed.
- The user can see a short research plan before execution.
- The system researches a curated set of public sources.
- The system generates a structured markdown report with citations and links.
- The report is stored as an artifact and visible in the workspace.
- Refresh does not destroy session or task visibility.
- The product feels coherent as one continuous workspace interaction.

## Risks And Non-Goals

### Scope Drift

The biggest risk is expanding too early into uploaded files, repo analysis, or broad browser automation. V1 should resist this.

### Shallow Source Quality

If search quality is weak, the whole report quality collapses. Source selection quality matters more than adding more tools.

### UI Over-Instrumentation

A research workspace should show enough execution detail to build trust, but not so much that it becomes an operator console.

### Non-Goal

V1 is not trying to match the full breadth of Manus. It is trying to match the feeling of a capable Manus-like agent within one narrow but complete vertical.

## Immediate Next Step

Write an implementation plan for Phase 1 through Phase 5 with file-level changes, endpoint additions, runtime responsibilities, and acceptance checks.
