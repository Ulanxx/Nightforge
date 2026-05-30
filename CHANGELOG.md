# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-05-30

### Added
- Full task execution pipeline with background `executeTaskInBackground` and `continueTaskInBackground` executors
- Human-in-the-loop approval flow: `POST /api/approvals/[approvalId]/approve` and `/deny` routes with idempotent status checks
- Internal task dispatch routes: `/api/internal/tasks/run`, `/reply`, `/approval` for background runner callbacks
- SSE streaming endpoint `GET /api/tasks/[taskId]/events?stream=1` for real-time task event delivery
- `lib/api/approval-resolution.ts` — injectable approval route handler (supports dependency injection for testing)
- `lib/api/task-events.ts` — helpers for collecting undelivered SSE events
- Prisma enums `TaskStatus` and `MessageRole` replacing raw string columns
- Migration `20260530_add_approval_action_context` adding `tool` and `inputJson` fields to `ApprovalRequest`
- General task execution agent (`lib/agent/general.ts`) with planning, clarification, and tool-loop phases
- Planning module (`lib/agent/planning.ts`) with `decideClarification`, `generateExecutionPlan`, and `buildExecutionPlanSteps`
- DeepAgents integration (`lib/agent/deepagents.ts`) and deliverable runner (`lib/agent/deliverable-runner.ts`)
- Web input tools (`lib/agent/web-input.ts`) and artifact storage (`lib/store/artifacts.ts`)
- Workspace UI (`app/workspace.tsx`, `lib/workspace-view.ts`) with Manus-style task/chat layout
- OpenRouter LLM client (`lib/llm/openrouter.ts`)
- DESIGN.md design system specification

### Changed
- `app/api/tasks/route.ts` — refactored from synchronous event loop to background dispatcher pattern
- `lib/agent/runtime.ts` — upgraded runtime to support `taskId`, `mode` (full/plan-only), and real agent delegation
- `lib/store/approvals.ts` — added `actionContext` persistence for approved tool actions
- `lib/api/schemas.ts` — added `internalTaskApprovalRequestSchema` and `createTaskRequestSchema`
- `tests/domain-and-schema.test.ts` — expanded to 17 tests covering approval resolution, SSE events, and plan steps

### Fixed
- Approval route now returns 409 if request already resolved (idempotent double-click protection)

## [0.1.0] - 2026-05-24

### Added
- Initial Next.js agent scaffold with session, task, and message models
- Basic agent runtime with planning stub
- Prisma schema with SQLite support
- Policy engine for permission-gated tool execution
- Sandbox manager integration with E2B
