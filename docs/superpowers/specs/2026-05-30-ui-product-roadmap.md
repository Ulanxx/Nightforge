# UI & 产品后续规划
**版本：** v0.2.0 基线之后
**日期：** 2026-05-30
**作者：** Product × Engineering

---

## 一、现状评估

### 已落地（功能完整）
- 三栏 Workspace 布局（左：session 历史 / 中：任务主轴 / 右：执行上下文）
- 实时 SSE 事件流 + EventSource 客户端渲染
- 任务全生命周期：intake → clarifying → planning → executing → awaiting_input → completed / failed
- 人工审批链路：approval.required 事件 → approve/deny route → 自动恢复执行
- 产物（Artifact）创建与下载
- Prisma schema 枚举全量迁移，17 条测试覆盖核心路径

### 已设计、未落地
| 能力 | 设计文档位置 | 现状 |
|------|------------|------|
| 真实 E2B 沙盒隔离 | manus-like-agent-design.md §Sandbox | local placeholder，命令在宿主机执行 |
| Browser automation | manus-like-agent-design.md §MVP Tools | 未实现 |
| 跨 session 任务记忆 | product-plan.md §Future | 未实现 |
| 移动端布局降级 | DESIGN.md §Layout | 已定义，未编码 |
| Web 真实搜索 | product-plan.md §Sources | 当前用 LLM 猜 URL，无真实搜索 API |

### 产品定位漂移风险（需立即清理）
代码仍有"研究助手"语义残留，与 *通用任务执行智能体* 的产品定位矛盾：

| 位置 | 当前名称 | 应改为 |
|------|---------|--------|
| `lib/agent/planning.ts` | `researchAngles` | `taskAngles` |
| `lib/agent/planning.ts` | `reportSections` | `outputSections` |
| `lib/agent/deliverable-runner.ts` | 文件名 | `artifact-runner.ts` |
| `lib/agent/web-input.ts` | `synthesizeTaskDeliverable()` | `buildTaskOutput()` |
| 事件 copy | "正在收集网页材料" | "正在获取外部资料" |
| `app/workspace.tsx` | capability 列表硬编码中文 | 提取为常量 / i18n-ready |

---

## 二、UI 规划

### P0 — 视觉一致性补全（目标：2 天内完成）

#### 2.1 空态引导（Empty State）

**问题：** 新用户打开 workspace，中栏空白，没有任何引导。
**目标：** 无任务时展示大标题 + 3 条可点击的任务示例，点击后自动填入输入框。

```
┌─────────────────────────────────────┐
│                                     │
│   直接交代目标                        │
│   Agent 会判断、规划、执行并返回结果    │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ 整理这批网页，输出可交付总结   │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │ 读取目录文件，生成结构化清单  │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │ 根据目标和资料，产出正式文档  │   │
│   └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**实现位置：** `app/workspace.tsx` — 当 `messages.length === 0 && events.length === 0` 时渲染。

---

#### 2.2 Plan 渲染用真实步骤

**问题：** 中栏"当前执行计划"总是显示 4 个通用步骤（判断→规划→执行→产物），与实际任务无关。
**目标：** 从 `plan.updated` 事件的 `steps[]` 字段渲染真实步骤，逐步标记为已完成。

```typescript
// 期望的 plan.updated 事件结构
{
  type: "plan.updated",
  taskId: "...",
  steps: [
    "获取网页内容：https://example.com",
    "提取正文与结构",
    "归纳重点，生成 Markdown 清单",
    "输出为可下载产物"
  ]
}
```

**UI 行为：**
- 步骤按顺序排列，执行到哪步就在对应行显示 spinner
- 完成后打勾，失败后标红
- 每步最多展示 60 字，超出 ellipsis

**实现位置：** `app/workspace.tsx` planSteps 渲染逻辑 + `lib/agent/planning.ts` buildExecutionPlanSteps()。

---

#### 2.3 审批卡片显示完整上下文

**问题：** 右栏 "Pending Approvals" 只显示 `reason`，用户无法判断该批准什么。
**目标：** 展示 tool 名称 + 关键 input 字段（如 command、path、url）。

```
┌─────────────────────────────────────┐
│ ⚠ 需要审批                          │
│                                     │
│ 工具：shell.exec                     │
│ 命令：rm -rf ./output/temp           │
│ 原因：清理中间产物以释放空间           │
│                                     │
│        [拒绝]          [批准]         │
└─────────────────────────────────────┘
```

**实现位置：** `app/workspace.tsx` approvals 渲染区域，从 `approval.inputJson` 解析关键字段展示。

---

#### 2.4 事件流折叠合并

**问题：** tool.started / tool.finished 成对出现，密集时事件流难以阅读。
**目标：** 将 tool.started + tool.finished 合并为单行，仅在失败或耗时 >5s 时展开。

```
✓ 读取文件 README.md             [展开 ▾]
✓ 执行命令 ls -la               [展开 ▾]
⟳ 获取网页内容 https://...       [进行中...]
✗ 执行命令 npm install           [查看错误 ▾]
```

**实现位置：** `app/workspace.tsx` events 列表渲染逻辑，按 `tool` + 时间窗口合并。

---

### P1 — 体验打磨（目标：1 周内完成）

#### 2.5 任务状态颜色语义

| 状态 | 当前 | 目标 |
|------|------|------|
| `failed` | 灰色文字 "失败" | 红色左边框 + 红色 badge |
| `awaiting_input` | 橙色 badge | 橙色脉冲点 + 底部输入框高亮 |
| `executing` | 灰色 | 主色（teal）脉冲点 |
| `completed` | 绿色 badge | 绿色 + 产物链接自动展开 |

颜色值参考 `DESIGN.md` 和 `app/globals.css` 中已定义的 CSS 变量，不引入新颜色。

---

#### 2.6 Artifact 内联预览

**问题：** 产物只有一个下载链接，用户需要离开页面才能查看内容。
**目标：** Markdown / 纯文本产物在右栏可折叠内联预览（最多 20 行，展开全文）。

```
📄 task-summary.md  [预览 ▾] [下载] [复制]
   ─────────────────────────────
   ## 任务总结
   本次任务共处理 3 个来源，提取...
   [展开全文]
```

**实现位置：** `app/workspace.tsx` artifacts 列表 + `app/api/artifacts/[artifactId]/route.ts`（已有，直接用）。

---

#### 2.7 Session 管理操作

**问题：** 左栏 session 列表只读，无法重命名或删除。
**目标：** 右键或 hover 出现操作菜单：重命名 / 删除。

**API 需要新增：**
```
PATCH /api/sessions/[sessionId]   { title: string }
DELETE /api/sessions/[sessionId]
```

---

#### 2.8 移动端布局降级

按 `DESIGN.md §Layout` 中定义的降级策略实现：

| 断点 | 布局 |
|------|------|
| ≥ 1024px | 完整三栏 |
| 768–1023px | 左栏折叠为 icon-only，右栏隐藏 |
| < 768px | 单栏，右栏变为底部抽屉（swipe up） |

---

### P2 — 产品差异化 UI（2 周后，按用户反馈优先级决定）

#### 2.9 Sandbox 文件树可视化

接入真实 E2B 后，右栏"执行环境"模块从静态文字变为：
- 当前工作目录文件树（轮询刷新）
- 最近 5 条命令输出（可展开）
- 沙盒资源指标（CPU / Memory 如 E2B API 支持）

#### 2.10 Timeline 视图

把事件流换成纵向 timeline，每个阶段（clarifying / planning / executing / completed）为一个节点，节点可展开查看子事件。适合向用户展示"Agent 做了什么"的完整叙事。

#### 2.11 任务模板卡片

首页建议任务从硬编码 4 条变为：
- 数据库存储的模板（admin 可管理）
- 用户历史任务可另存为模板
- 分类展示（文件整理 / 信息提取 / 文档生成）

---

## 三、产品规划

### P0 — 业务迁移清理（1 天，代码改动为主）

对应 `2026-05-26-general-task-execution-agent-business-migration-checklist.md` 中未完成项：

#### 3.1 代码语义重命名

```
lib/agent/planning.ts
  researchAngles         → taskAngles
  reportSections         → outputSections
  generateResearchPlan() → generateExecutionPlan()（已改，验证一致性）

lib/agent/deliverable-runner.ts
  文件重命名             → artifact-runner.ts
  DeliverableRunner      → ArtifactRunner

lib/agent/web-input.ts
  synthesizeTaskDeliverable() → buildTaskOutput()
  collectWebMaterials()       → fetchExternalSources()
```

#### 3.2 事件 copy 清洗

全局搜索以下中文字符串并替换：

| 旧 copy | 新 copy |
|---------|---------|
| "正在收集网页材料" | "正在获取外部资料" |
| "生成研究计划" | "分析任务并制定计划" |
| "研究角度" | "任务切入点" |
| "报告章节" | "输出结构" |

#### 3.3 通用文件输入

`createTaskRequestSchema` 当前缺少文件附件字段。补充：

```typescript
export const createTaskRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000).trim(),
  permissions: z.array(permissionSchema).default(["network", "file.write", "artifact.export"]),
  attachments: z.array(z.object({        // ← 新增
    name: z.string(),
    content: z.string(),                 // base64 or text
    mimeType: z.string()
  })).max(5).default([])
});
```

UI 层：输入框添加文件拖拽区域，支持 .txt / .md / .pdf / .csv 上传。

---

### P1 — 核心能力补齐（2–3 周）

#### 3.4 真实 E2B 沙盒集成

**现状：** `lib/sandbox/manager.ts` 中 `getOrCreate()` 返回 `local-placeholder-{uuid}`，命令在宿主机 zsh 执行。
**目标：** 接入 E2B SDK，每个 session 对应一个真实沙盒实例。

**关键改动：**
```typescript
// lib/sandbox/manager.ts
import { Sandbox } from "@e2b/code-interpreter";

async getOrCreate(sessionId: string): Promise<SandboxSession> {
  const existing = await getStoredSandbox(sessionId);
  if (existing?.sandboxId) {
    // 尝试 resume，超时则新建
    try {
      const sandbox = await Sandbox.reconnect(existing.sandboxId);
      return { sandbox, sandboxId: existing.sandboxId };
    } catch { /* fall through */ }
  }
  const sandbox = await Sandbox.create({ timeoutMs: 3600_000 });
  await upsertSandbox(sessionId, sandbox.sandboxId);
  return { sandbox, sandboxId: sandbox.sandboxId };
}
```

**影响范围：** `lib/agent/general.ts` 中所有 `execCommand()` / `readFile()` / `writeFile()` 调用替换为 sandbox 实例方法。

**前置条件：** 需要 `E2B_API_KEY` 环境变量，已在 `.env.example` 中声明。

---

#### 3.5 任务中断恢复

**问题：** process 重启后，`executing` 状态的任务永远卡住，用户无法重试。
**目标：** 应用启动时扫描 DB 中状态为 `executing` 的任务，标记为 `failed` 并写入事件说明原因。

**实现方案：**
```typescript
// lib/agent/recovery.ts
export async function recoverStuckTasks() {
  const stuck = await prisma.task.findMany({
    where: { status: { in: ["executing", "planning"] } }
  });
  for (const task of stuck) {
    await updateTaskStatus(task.id, "failed", "服务重启，任务中断。请重新提交。");
    await createEvent(task.id, "task.failed", serializeRuntimeEvent({
      type: "task.failed", taskId: task.id,
      error: "服务重启，任务中断。请重新提交。"
    }));
  }
}
```

调用位置：`app/layout.tsx` server component 或 Next.js instrumentation hook。

---

#### 3.6 Web 真实搜索

**现状：** `lib/agent/web-input.ts` 的 `selectWebSources()` 让 LLM 猜测 URL，实际网页可能不存在。
**目标：** 集成真实搜索 API（Tavily 优先，Serper 备选），返回真实可访问的结果 URL 列表。

```typescript
// lib/agent/search.ts（新文件）
export async function searchWeb(query: string, maxResults = 5): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      search_depth: "basic"
    })
  });
  const data = await res.json();
  return data.results.map((r: TavilyResult) => ({ url: r.url, title: r.title, snippet: r.content }));
}
```

**前置条件：** 需要 `TAVILY_API_KEY`，加入 `.env.example`。

---

#### 3.7 输出策略明确化

**现状：** `lib/agent/general.ts` 交付逻辑偏向总是生成 Artifact，直接回复路径模糊。
**目标：** 根据任务类型明确选择交付模式：

| 任务类型 | 交付模式 |
|---------|---------|
| 问答、解释、分析（< 500 字） | 直接 message 回复 |
| 文档、报告、代码（> 500 字） | Artifact + message 摘要 |
| 混合型 | message + Artifact 链接 |

决策逻辑加入 `planning.ts` 的 `generateExecutionPlan()` 输出字段：
```typescript
deliveryMode: "message" | "artifact" | "mixed"
```

---

### P2 — 商业化方向（1 个月后，按需启动）

#### 3.8 Headless API 模式

暴露标准 REST API，支持程序化调用：
- `POST /api/tasks` 已存在，补充 API key 认证中间件
- 添加 `GET /api/tasks/[taskId]` 轮询接口（非 SSE），支持无 EventSource 的客户端
- 文档化 API 用于第三方集成

#### 3.9 跨 Session 上下文引用

用户在输入框可用 `@taskId` 引用历史任务的产物：
```
基于 @task-abc123 的总结，再生成一份 PPT 大纲
```

实现：输入框解析 `@` 触发 session 搜索下拉，选中后将对应产物内容注入 system context。

#### 3.10 团队协作（多用户）

- 任务/产物可共享链接（只读）
- 审批通知发送给指定用户（邮件或 webhook）
- 组织级 permission 策略（管理员可限制哪些工具可用）

---

## 四、执行顺序（推荐）

```
本周（v0.2.x）
  ├── [UI-P0]  2.1 Empty state 引导
  ├── [UI-P0]  2.2 Plan 渲染真实步骤
  ├── [UI-P0]  2.3 审批卡片完整上下文
  ├── [产品-P0] 3.1 代码语义重命名
  └── [产品-P0] 3.2 事件 copy 清洗

下周（v0.3.0）
  ├── [UI-P0]  2.4 事件流折叠合并
  ├── [UI-P1]  2.5 状态颜色语义
  ├── [UI-P1]  2.6 Artifact 内联预览
  ├── [产品-P0] 3.3 文件输入字段
  └── [产品-P1] 3.5 任务中断恢复

第三周（v0.4.0）
  ├── [产品-P1] 3.4 真实 E2B 沙盒集成
  ├── [产品-P1] 3.6 Web 真实搜索
  ├── [UI-P1]  2.7 Session 管理
  └── [UI-P1]  2.8 移动端降级

后续（v1.0.0 方向）
  ├── [UI-P2]  2.9 Sandbox 文件树
  ├── [UI-P2]  2.10 Timeline 视图
  ├── [产品-P1] 3.7 输出策略明确化
  └── [产品-P2] 3.8–3.10 商业化功能
```

---

## 五、验收标准

### UI 验收
- [ ] 新用户打开 workspace 看到空态引导，点击示例可触发任务
- [ ] 执行计划显示与任务相关的真实步骤，且步骤逐个标记完成
- [ ] 审批卡片展示 tool 名称 + 关键参数，用户不需要额外信息即可决策
- [ ] Failed 任务有明显红色视觉区分，Awaiting Input 有脉冲提示
- [ ] Markdown 产物可在右栏折叠预览，无需离开页面

### 产品验收
- [ ] 全局无 "research" / "report" 中文/英文语义残留
- [ ] 用户可通过拖拽文件触发包含附件的任务
- [ ] 服务重启后 stuck 任务自动标记 failed 并提示用户重试
- [ ] Web 来源 URL 均为真实可访问地址（接入搜索 API 后）

---

*本文档为活文档，随实现进展更新。下次版本评审时对照验收标准逐项核查。*
