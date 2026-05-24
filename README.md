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
