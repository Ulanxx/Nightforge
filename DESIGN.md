# Design System — DeepAgents 通用智能体

## Product Context
- **What this is:** 一个面向普通业务用户的通用智能体 Web 工作台，负责接收自然语言任务，调用文件、搜索、命令与产物工具，并持续展示执行过程。
- **Who it's for:** 需要把“让 AI 去做一件事”变成持续任务流的业务用户、运营、产品和轻技术用户。
- **Space/industry:** AI 智能体工作台，参考 Manus 的执行感、Kimi 的低门槛输入体验，以及通用对话产品的熟悉交互。
- **Project type:** Web app / task workspace。

## Aesthetic Direction
- **Direction:** Industrial Editorial
- **Decoration level:** intentional
- **Mood:** 首页应该像一张冷静、可信的任务入口海报，让用户立刻知道“我只需要说需求”；任务页则像专业控制台，信息密但不吵，强调过程感与可追踪性。
- **Reference sites:** https://manus.im/ , https://www.kimi.com/ , https://chatgpt.com/

## Information Architecture
- **Home:** 只承载品牌、输入框、快捷任务建议、最近会话列表。目标是降低开始门槛，不展示事件流、工具流、产物流。
- **Task Workspace:** 承载当前会话的完整执行体验。左侧是历史与导航，中间是对话和任务状态，右侧是工具、文件、产物等上下文。
- **Transition:** 用户在首页提交后立刻进入任务页，任务页负责后续轮询、澄清、继续执行与查看产物。
- **History model:** 历史会话始终存在左侧边栏，首页和任务页共用同一套会话列表认知。

## Typography
- **Display/Hero:** Newsreader — 用于首页主标题，带一点编辑感，避免 SaaS 模板味。
- **Body:** Source Sans 3 — 用于正文、列表、状态说明，保证中文长文阅读稳定。
- **UI/Labels:** Source Sans 3 Semibold
- **Data/Tables:** IBM Plex Mono — 用于时间、状态标签、技术细节，形成任务控制台气质。
- **Code:** IBM Plex Mono
- **Loading:** Next.js font loader
- **Scale:** 12 / 14 / 16 / 18 / 24 / 32 / 48

## Color
- **Approach:** restrained
- **Primary:** `#0f766e` — 表示执行、确认、前进
- **Secondary:** `#c76828` — 表示提醒、澄清、需要关注
- **Neutrals:** `#f3f5f7` `#e4e8ee` `#c9d2dc` `#6b7280` `#111827`
- **Semantic:** success `#1f8f63`, warning `#c76828`, error `#b63b3b`, info `#2563eb`
- **Dark mode:** 先不做独立设计，保留通过变量切换的空间；当前版本以浅色专业工作台为主。

## Spacing
- **Base unit:** 8px
- **Density:** comfortable
- **Scale:** 2xs(4) xs(8) sm(12) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** hybrid
- **Grid:** 首页为 `280px + 1fr` 双栏；任务页为 `280px + minmax(0,1fr) + 360px` 三栏，在中小屏退化为单栏堆叠。
- **Max content width:** 1680px
- **Border radius:** sm 6px, md 10px, lg 14px, pill 9999px

## Motion
- **Approach:** minimal-functional
- **Easing:** enter(ease-out), exit(ease-in), move(ease-in-out)
- **Duration:** micro(80ms) short(180ms) medium(280ms) long(420ms)

## Safe Choices
- 首页仍保留左侧历史，用户不会在进入任务后失去会话上下文。
- 任务页继续使用聊天式主轴，因为这对普通业务用户最熟悉。
- 右侧保留工具与产物面板，方便理解“智能体刚刚做了什么”。

## Risks
- **风险 1：** 首页不再展示运行明细，只给任务入口。
  - **收益：** 降低认知负担，更像产品首页而不是后台页面。
  - **代价：** 高级用户第一次进入时，看不到全部能力面板。
- **风险 2：** 采用更强的编辑感标题和更克制的颜色，而不是典型 AI 发光感。
  - **收益：** 更可信、更像生产力工具，避免“通用 AI 套壳”。
  - **代价：** 少一点娱乐性和即时炫技感。
- **风险 3：** 任务页强化状态带和上下文侧栏，减少大面积卡片堆叠。
  - **收益：** 更接近执行台，而不是营销式界面。
  - **代价：** 布局更偏工作台，需要更认真处理响应式。

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-25 | 将单页工作台拆为首页与任务页 | 解决信息架构混乱，建立更像 Manus/Kimi 的两阶段体验 |
| 2026-05-25 | 采用 Industrial Editorial 视觉方向 | 在可信执行感和产品辨识度之间取得平衡 |
