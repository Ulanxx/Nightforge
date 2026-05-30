# DeepAgents Agent — 项目摘要

## 五条要点总结

1. **项目定位**：`deepagents-agent` 是一个类 Manus 的通用智能体，基于 Node.js 控制平面、DeepAgents JS 框架和 E2B 会话沙箱构建，首个里程碑是 Web MVP。

2. **技术栈**：前端和控制平面采用 Next.js 16 App Router（TypeScript + Tailwind CSS），后端使用 DeepAgents JS 实现规划、工具调用、子智能体和任务执行流程，E2B 提供沙箱化执行环境。

3. **架构特点**：每个用户会话对应一个持久化沙箱，包含任务级权限控制和高风险操作审批机制，确保安全与可控。

4. **项目骨架**：已搭建工作区优先的 UI（聊天、权限、事件、风险队列、制品），提供占位任务 API（`POST /api/tasks`），以及智能体运行时（`lib/agent`）、沙箱管理器（`lib/sandbox`）、策略引擎（`lib/policy`）等核心模块接口。

5. **数据模型**：通过 Prisma Schema 定义了 sessions、tasks、messages、tool_calls、approvals、artifacts、sandboxes、event_logs 等完整的业务实体，覆盖智能体执行全链路。