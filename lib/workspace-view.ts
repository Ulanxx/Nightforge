import { parseRuntimeEvent } from "@/lib/agent/events";
import { messageRoleSchema, taskStatusSchema, type MessageRole, type TaskStatus } from "@/lib/domain/task";
import { listSessionArtifacts } from "@/lib/store/artifacts";
import { listSessionMessages } from "@/lib/store/messages";
import { listSessions } from "@/lib/store/sessions";
import { listSessionTasks } from "@/lib/store/tasks";
import { prisma } from "@/lib/store/prisma";

export type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  taskCount: number;
  tasks: Array<{ status: TaskStatus }>;
};

export type TaskSummary = {
  id: string;
  prompt: string;
  status: TaskStatus;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageItem = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type EventPayload =
  | { type: "task.started"; message: string }
  | { type: "task.status"; status: string; summary: string }
  | { type: "clarification.requested"; reason: string; questions: string[] }
  | { type: "plan.updated"; steps: string[] }
  | { type: "artifact.created"; artifactId: string; name: string; mimeType: string | null }
  | { type: "tool.started" | "tool.finished"; tool: string; summary: string }
  | { type: "task.failed"; error: string }
  | { type: "approval.required"; approvalId: string; reason: string }
  | { type: "approval.resolved"; approvalId: string; status: "approved" | "denied"; reason: string }
  | { type: "task.finished"; summary: string }
  | null;

export type EventItem = {
  id: string;
  type: string;
  createdAt: string;
  payload: EventPayload;
};

export type ArtifactItem = {
  id: string;
  name: string;
  mimeType: string | null;
  taskId: string | null;
  createdAt: string;
};

export type SandboxItem = {
  sandboxId: string;
  status: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string | null;
};

export type ApprovalItem = {
  id: string;
  status: string;
  reason: string;
  risk: string;
  tool: string | null;
  command: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type SessionWorkspaceData = {
  activeSessionId: string | null;
  activeTaskId: string | null;
  activeTaskStatus: string | null;
  activeTaskPrompt: string | null;
  activeTaskSummary: string | null;
  sessions: SessionSummary[];
  tasks: TaskSummary[];
  messages: MessageItem[];
  events: EventItem[];
  artifacts: ArtifactItem[];
  sandbox: SandboxItem | null;
  approvals: ApprovalItem[];
};

function parseTaskStatus(status: string): TaskStatus {
  return taskStatusSchema.parse(status);
}

function parseApprovalCommand(inputJson: string | null) {
  if (!inputJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(inputJson) as { command?: unknown };
    return typeof parsed.command === "string" ? parsed.command : null;
  } catch {
    return null;
  }
}

function parseMessageRole(role: string): MessageRole {
  return messageRoleSchema.parse(role);
}

export async function listSessionSummaries() {
  const sessions = await listSessions();

  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt.toISOString(),
    messageCount: session._count.messages,
    taskCount: session._count.tasks,
    tasks: session.tasks.map((task) => ({
      status: parseTaskStatus(task.status)
    }))
  }));
}

export function pickActiveTaskId(tasks: Array<{ id: string; status: TaskStatus }>, preferredTaskId?: string | null) {
  if (preferredTaskId && tasks.some((task) => task.id === preferredTaskId)) {
    return preferredTaskId;
  }

  const resumableTask = tasks.find((task) => ["clarifying", "awaiting_input", "planning", "executing"].includes(task.status));
  return resumableTask?.id ?? tasks[0]?.id ?? null;
}

export async function getSessionWorkspaceData(
  sessionId: string | null,
  preferredTaskId?: string | null
): Promise<SessionWorkspaceData> {
  const sessions = await listSessionSummaries();

  if (!sessionId) {
    return {
      activeSessionId: null,
      activeTaskId: null,
      activeTaskStatus: null,
      activeTaskPrompt: null,
      activeTaskSummary: null,
      sessions,
      tasks: [],
      messages: [],
      events: [],
      artifacts: [],
      sandbox: null,
      approvals: []
    };
  }

  const [messages, tasks, artifacts, session] = await Promise.all([
    listSessionMessages(sessionId),
    listSessionTasks(sessionId),
    listSessionArtifacts(sessionId),
    prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        sandbox: true
      }
    })
  ]);

  const activeTaskId = pickActiveTaskId(
    tasks.map((task) => ({
      id: task.id,
      status: parseTaskStatus(task.status)
    })),
    preferredTaskId
  );
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;
  const rawEvents = activeTaskId
    ? await prisma.eventLog.findMany({
        where: { taskId: activeTaskId },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const approvals = activeTaskId
    ? await prisma.approvalRequest.findMany({
        where: { taskId: activeTaskId },
        orderBy: { createdAt: "desc" }
      })
    : [];

  return {
    activeSessionId: sessionId,
    activeTaskId,
    activeTaskStatus: activeTask?.status ?? null,
    activeTaskPrompt: activeTask?.prompt ?? null,
    activeTaskSummary: activeTask?.summary ?? null,
    sessions,
    tasks: tasks.map((task) => ({
      id: task.id,
      prompt: task.prompt,
      status: parseTaskStatus(task.status),
      summary: task.summary,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString()
    })),
    messages: messages.map((message) => ({
      id: message.id,
      role: parseMessageRole(message.role),
      content: message.content,
      createdAt: message.createdAt.toISOString()
    })),
    events: rawEvents.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt.toISOString(),
      payload: parseRuntimeEvent(event.payload)
    })),
    artifacts: artifacts.map((artifact) => ({
      ...artifact,
      taskId: artifact.taskId ?? null,
      createdAt: artifact.createdAt.toISOString()
    })),
    sandbox: session?.sandbox
      ? {
          sandboxId: session.sandbox.sandboxId,
          status: session.sandbox.status,
          createdAt: session.sandbox.createdAt.toISOString(),
          lastUsedAt: session.sandbox.lastUsedAt.toISOString(),
          expiresAt: session.sandbox.expiresAt?.toISOString() ?? null
        }
      : null,
    approvals: approvals.map((approval) => ({
      id: approval.id,
      status: approval.status,
      reason: approval.reason,
      risk: approval.risk,
      tool: approval.tool,
      command: parseApprovalCommand(approval.inputJson),
      createdAt: approval.createdAt.toISOString(),
      resolvedAt: approval.resolvedAt?.toISOString() ?? null
    }))
  };
}
