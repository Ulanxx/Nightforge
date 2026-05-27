import test from "node:test";
import assert from "node:assert/strict";
import {
  createTaskRequestSchema,
  internalTaskReplyRequestSchema,
  internalTaskRunRequestSchema,
  taskReplyRequestSchema
} from "@/lib/api/schemas";
import { formatSseEvent } from "@/lib/agent/events";
import { buildExecutionPlanSteps } from "@/lib/agent/planning";
import {
  displayTaskStatus,
  messageRoleSchema,
  statusLabels,
  taskStatusSchema
} from "@/lib/domain/task";
import { checkToolPolicy } from "@/lib/policy/policy-engine";
import { pickActiveTaskId } from "@/lib/workspace-view";

test("task status schema accepts supported statuses", () => {
  assert.equal(taskStatusSchema.parse("planning"), "planning");
  assert.equal(taskStatusSchema.parse("clarifying"), "clarifying");
  assert.equal(taskStatusSchema.parse("executing"), "executing");
  assert.equal(taskStatusSchema.parse("completed"), "completed");
});

test("message role schema rejects unsupported roles", () => {
  assert.throws(() => messageRoleSchema.parse("tool"));
});

test("displayTaskStatus maps known statuses and preserves unknown values", () => {
  assert.equal(displayTaskStatus("planning"), statusLabels.planning);
  assert.equal(displayTaskStatus("awaiting_input"), statusLabels.awaiting_input);
  assert.equal(displayTaskStatus(null), statusLabels.idle);
  assert.equal(displayTaskStatus("paused"), "paused");
});

test("create task request schema trims values and fills permissions", () => {
  const parsed = createTaskRequestSchema.parse({
    sessionId: " session-1 ",
    message: "  do something  "
  });

  assert.deepEqual(parsed, {
    sessionId: "session-1",
    message: "do something",
    permissions: []
  });
});

test("task reply schema rejects empty message", () => {
  assert.throws(() => taskReplyRequestSchema.parse({ message: "   " }));
});

test("internal task run schema validates required fields", () => {
  const parsed = internalTaskRunRequestSchema.parse({
    sessionId: "session-1",
    taskId: "task-1",
    message: "run it",
    permissions: ["network"]
  });

  assert.equal(parsed.taskId, "task-1");
  assert.deepEqual(parsed.permissions, ["network"]);
});

test("internal task reply schema validates clarification payload", () => {
  const parsed = internalTaskReplyRequestSchema.parse({
    sessionId: "session-1",
    taskId: "task-1",
    originalPrompt: "original",
    message: "answer"
  });

  assert.equal(parsed.originalPrompt, "original");
  assert.equal(parsed.message, "answer");
});

test("buildExecutionPlanSteps produces stable user-facing plan sections", () => {
  const steps = buildExecutionPlanSteps({
    objective: "整理仓库和网页资料，生成一份中文交付说明。",
    researchAngles: ["读取本地项目结构", "补充公开网页背景", "提炼关键差异"],
    reportSections: ["任务背景", "执行结果", "后续建议"],
    sourceStrategy: "先读取本地文件，再按需抓取公开网页说明。"
  });

  assert.deepEqual(steps, [
    "明确目标：整理仓库和网页资料，生成一份中文交付说明。",
    "准备材料：先读取本地文件，再按需抓取公开网页说明。",
    "执行重点：读取本地项目结构；补充公开网页背景",
    "交付结果：任务背景；执行结果；后续建议"
  ]);
});

test("policy engine rejects dangerous commands without approval", () => {
  const result = checkToolPolicy({
    tool: "run_command",
    permissions: ["network"],
    command: "rm -rf tmp"
  });

  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.risk, "high");
});

test("policy engine requires approval for dependency installs", () => {
  const result = checkToolPolicy({
    tool: "run_command",
    permissions: ["network"],
    command: "npm install"
  });

  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.risk, "medium");
});

test("policy engine requires approval for external side effects", () => {
  const result = checkToolPolicy({
    tool: "run_command",
    permissions: ["network", "artifact.export"],
    command: "git push origin main"
  });

  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.risk, "high");
});

test("pickActiveTaskId prefers explicit task id then resumable task", () => {
  assert.equal(
    pickActiveTaskId(
      [
        { id: "task-1", status: "completed" },
        { id: "task-2", status: "clarifying" }
      ],
      "task-1"
    ),
    "task-1"
  );

  assert.equal(
    pickActiveTaskId([
      { id: "task-1", status: "completed" },
      { id: "task-2", status: "executing" }
    ]),
    "task-2"
  );
});

test("formatSseEvent emits event-stream payload", () => {
  const payload = formatSseEvent({ id: "evt-1", type: "task.status" }, "task-event");

  assert.equal(payload, 'event: task-event\ndata: {"id":"evt-1","type":"task.status"}\n\n');
});
