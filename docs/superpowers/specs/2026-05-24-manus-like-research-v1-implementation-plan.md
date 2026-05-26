# Manus-Like Research Agent V1 Implementation Plan

Date: 2026-05-24

Related spec:

- `docs/superpowers/specs/2026-05-24-manus-like-research-v1-design.md`

## Objective

Translate the V1 design into an implementation sequence that fits the current repository shape.

The goal is to turn the existing scaffold into a usable research-agent vertical with:

- persistent sessions and tasks
- clarification-first task intake
- public-web research execution
- structured report artifact generation
- a Manus-like workspace that shows progress and preserves trust

## Current Baseline

The repository already has:

- a static workspace UI in `app/page.tsx`
- a placeholder task route in `app/api/tasks/route.ts`
- a placeholder runtime in `lib/agent/runtime.ts`
- an in-memory sandbox manager in `lib/sandbox/manager.ts`
- a starter policy engine in `lib/policy/policy-engine.ts`
- Prisma schema covering sessions, tasks, messages, events, approvals, artifacts, and sandbox metadata

What is missing is the connective tissue:

- database-backed state access
- real task lifecycle orchestration
- research-specific runtime stages
- frontend data loading and state rendering
- artifact creation and retrieval

## Delivery Strategy

Implement V1 in six phases. Each phase should leave the app in a runnable state.

Do not start by wiring every advanced tool. The first priority is a stable, replayable task backbone.

## Phase 1: Persistent Backbone

### Goal

Replace placeholder request/response behavior with persisted sessions, messages, tasks, and events.

### Backend Work

1. Add a Prisma client entrypoint:
   - New file: `lib/store/prisma.ts`
   - Export a singleton `PrismaClient`.

2. Add repository-style helpers or service functions:
   - New directory: `lib/store/`
   - Suggested files:
     - `lib/store/sessions.ts`
     - `lib/store/tasks.ts`
     - `lib/store/messages.ts`
     - `lib/store/events.ts`

3. Update `app/api/tasks/route.ts`:
   - Create or reuse a session.
   - Persist the user message.
   - Create a task row with initial state.
   - Write emitted runtime events into `EventLog`.
   - Persist the final assistant summary into `Message` and `Task.summary`.

4. Add read endpoints:
   - `app/api/sessions/[sessionId]/route.ts`
   - `app/api/sessions/[sessionId]/messages/route.ts`
   - `app/api/tasks/[taskId]/events/route.ts`

### Frontend Work

1. Replace hard-coded session/message/event data in `app/page.tsx`.
2. Add initial fetch for:
   - active session
   - task history
   - message history
   - event history

For Phase 1, loading on first render with plain `fetch` is enough. Do not over-build client architecture yet.

### Runtime Work

Keep `lib/agent/runtime.ts` simple in this phase. It can still emit placeholder events, but those events must now map to persisted task lifecycle state.

### Acceptance Criteria

- Creating a task persists `Session`, `Message`, `Task`, and `EventLog` records.
- Refreshing the page does not lose visible task state.
- The UI renders stored messages and events instead of static mock data.

## Phase 2: Clarification And Planning Loop

### Goal

Make the task intake feel like a real research agent instead of a one-shot command box.

### Backend Work

1. Extend `lib/agent/runtime.ts` into a clarification-aware orchestration layer.
2. Add task-state transitions:
   - `clarifying`
   - `planning`
   - `researching`
   - `synthesizing`
   - `report_ready`
   - `completed`
   - `failed`

3. Add a clarification reply endpoint:
   - `app/api/tasks/[taskId]/reply/route.ts`

4. Persist clarification prompts and user answers as `Message` records.

### New Modules

- `lib/agent/orchestrator.ts`
  - decides whether clarification is needed
  - caps clarification to 1 to 3 questions
  - hands off to planning once scoped

- `lib/agent/planner.ts`
  - generates a short visible research plan
  - returns research angles, output sections, and source strategy

### Frontend Work

1. In `app/page.tsx`, add distinct UI states for:
   - task intake
   - clarification
   - plan preview
   - execution feed

2. Clarification prompts should render inline in the main column, not as modal dialogs.

### Acceptance Criteria

- Some tasks can start directly in `planning`.
- Ambiguous tasks enter `clarifying`.
- Submitting clarification answers resumes the same task.
- A visible plan appears before research begins.

## Phase 3: Public-Web Research Execution

### Goal

Replace placeholder execution with a research-specific loop that can search, read, and track sources.

### Backend Work

1. Add research executor module:
   - `lib/agent/research-executor.ts`

2. Add lightweight search and page-read tools:
   - `search.web`
   - `browser.open` or `web.read`

3. Add source extraction logic:
   - normalize title
   - track URL/domain
   - assign source status such as `queued`, `visited`, `cited`

4. Persist structured tool calls in `ToolCall`.

5. Emit richer `EventLog` payloads for:
   - source discovered
   - source opened
   - source accepted
   - source discarded
   - synthesis started

### Data Notes

The current schema does not have a dedicated `Source` table. For V1, source state can live in event payloads and tool output JSON to avoid premature schema growth.

If source rendering becomes awkward, add a `TaskSource` model in a follow-up migration, but do not assume that upfront.

### Frontend Work

1. Replace the placeholder right-panel artifacts/events cards with:
   - current task status
   - source queue
   - visited/cited source list

2. Show meaningful milestones in the center execution feed, not raw logs.

### Acceptance Criteria

- A research task can collect and display public-web sources.
- The user can see which sources were visited and which were cited.
- Progress feels visible while the task is running.

## Phase 4: Report Artifact Generation

### Goal

Produce a formal deliverable instead of ending with a task summary only.

### Backend Work

1. Add synthesizer module:
   - `lib/agent/report-synthesizer.ts`

2. Define markdown report contract:
   - executive summary
   - key findings
   - sectioned analysis
   - uncertainty notes
   - sources

3. Store report output in a stable location:
   - local filesystem for MVP is acceptable
   - persist metadata in `Artifact`

4. Add artifact read/download endpoint:
   - `app/api/artifacts/[artifactId]/route.ts`

### Suggested Supporting Modules

- `lib/artifacts/storage.ts`
- `lib/artifacts/serializer.ts`

### Frontend Work

1. Add artifact preview block in the right panel or main delivery section.
2. Show report title, type, and preview snippet.
3. Add an open/download action.

### Acceptance Criteria

- Completed research tasks generate a markdown artifact.
- Artifact metadata persists and is visible on refresh.
- The final workspace clearly distinguishes between summary and report artifact.

## Phase 5: Real-Time Experience And Approval Shell

### Goal

Make the workspace feel alive and task-native rather than request/response driven.

### Backend Work

1. Upgrade event delivery from fetch-only to SSE if feasible:
   - `app/api/tasks/[taskId]/events/route.ts`
   - stream new events after historical replay

2. Evolve `lib/policy/policy-engine.ts`:
   - task permission checks
   - approval-triggering conditions
   - long-running command policy

3. Add approval endpoints if needed:
   - `app/api/approvals/[approvalId]/approve/route.ts`
   - `app/api/approvals/[approvalId]/deny/route.ts`

### Frontend Work

1. Convert execution feed to live updates.
2. Replace placeholder permissions and risk queue with real task-bound state.
3. Show paused task states clearly.

### Acceptance Criteria

- Running tasks update the workspace without full refresh.
- Approval-required tasks surface the pause reason.
- The UI communicates waiting vs running vs completed cleanly.

## Phase 6: Sandbox And Runtime Hardening

### Goal

Tighten the execution boundary so the agent is ready for broader task types later, without derailing V1.

### Backend Work

1. Upgrade `lib/sandbox/manager.ts` from in-memory placeholder to persistent sandbox lifecycle integration.
2. Record sandbox metadata in the `Sandbox` table.
3. Handle sandbox reuse and expiration explicitly in events.
4. Ensure report generation paths and future browser tooling can run inside the intended execution boundary.

### Notes

For the narrow public-web research V1, this phase can remain partially stubbed if search/page reading does not yet depend on full E2B execution.

Do not block the product loop on perfect sandbox fidelity if the research experience can ship first.

### Acceptance Criteria

- Session execution environment is no longer purely in-memory.
- Sandbox lifecycle changes are visible to the user when they matter.

## File-Level Change Map

Expected new files:

- `lib/store/prisma.ts`
- `lib/store/sessions.ts`
- `lib/store/tasks.ts`
- `lib/store/messages.ts`
- `lib/store/events.ts`
- `lib/agent/orchestrator.ts`
- `lib/agent/planner.ts`
- `lib/agent/research-executor.ts`
- `lib/agent/report-synthesizer.ts`
- `lib/artifacts/storage.ts`
- `lib/artifacts/serializer.ts`
- `app/api/sessions/[sessionId]/route.ts`
- `app/api/sessions/[sessionId]/messages/route.ts`
- `app/api/tasks/[taskId]/events/route.ts`
- `app/api/tasks/[taskId]/reply/route.ts`
- `app/api/artifacts/[artifactId]/route.ts`

Expected updated files:

- `app/page.tsx`
- `app/api/tasks/route.ts`
- `lib/agent/runtime.ts`
- `lib/sandbox/manager.ts`
- `lib/policy/policy-engine.ts`
- `prisma/schema.prisma`

## Recommended Order Of Execution

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6

This order is deliberate:

- first make tasks real
- then make them conversational
- then make them capable
- then make them deliverable
- then make them feel live
- finally harden the execution boundary

## Testing Strategy

### Phase 1

- `npm run prisma:generate`
- `npm run typecheck`
- `npm run lint`
- manual task creation and refresh persistence check

### Phase 2

- ambiguous prompt enters clarification
- clear prompt skips clarification
- clarification answer resumes same task

### Phase 3

- source list is visible
- source states change as research progresses
- tool calls persist

### Phase 4

- report artifact is created
- artifact metadata persists
- report preview renders

### Phase 5

- live feed updates during execution
- approval pauses are visible

### Phase 6

- sandbox reuse path works
- expired sandbox path emits user-visible recovery signal

## First Implementation Slice

The best first coding slice is:

1. Phase 1 persistent backbone
2. minimal Phase 2 clarification loop
3. placeholder but persisted plan rendering

That slice is the smallest change that turns the current scaffold into a believable Manus-like task workspace. It also gives a stable base for the actual research tools in the next slice.
