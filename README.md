# deepagents-agent

Manus-like general agent built on a Node.js control plane, DeepAgents JS, and E2B session sandboxes.

The first milestone is a web MVP:

- Next.js app as the UI and server control plane.
- DeepAgents JS for planning, tool calling, subagents, and task execution flow.
- E2B as the sandboxed execution plane.
- One persistent sandbox per user session.
- Task-level permissions plus high-risk action approvals.

See the initial design spec:

- `docs/superpowers/specs/2026-05-24-manus-like-agent-design.md`

## Development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

Open `http://localhost:3000`.

## Current Scaffold

- Next.js 16 App Router with TypeScript and Tailwind CSS.
- Workspace-first UI for chat, permissions, events, risk queue, and artifacts.
- Placeholder task API at `POST /api/tasks`.
- Agent runtime interface in `lib/agent`.
- E2B sandbox manager interface in `lib/sandbox`.
- Policy engine starter in `lib/policy`.
- Prisma schema for sessions, tasks, messages, tool calls, approvals, artifacts, sandboxes, and event logs.

## Verification

```bash
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
```
