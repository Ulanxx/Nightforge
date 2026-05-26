# General Task Execution Agent Product Plan

Date: 2026-05-26

## Product Positioning

Build this product as a general task execution agent for knowledge workers.

The user should face a single open-ended input box and describe the goal in natural language. The system is responsible for deciding whether the request is specific enough, asking the minimum necessary clarification questions when it is not, combining user input with local files and web information, using a sandbox when execution is required, and choosing whether the final result should be a direct reply, an artifact, or both.

This product is not a research vertical and should not be framed as one. It is also not a chat-first assistant. The core promise is:

- users hand off a task
- the agent figures out what it needs
- the agent executes safely
- the agent returns a usable result

## Target User

The first target user is a general knowledge worker rather than a developer-specific persona.

Typical users:

- people who gather and summarize information across multiple sources
- people who produce reports, notes, drafts, structured lists, and comparison outputs
- people who need help executing multi-step digital tasks rather than answering one-off questions

Their real job to be done is not "answer my question." It is closer to:

- "help me finish this task"
- "pull together the relevant material"
- "turn this mess into a deliverable"
- "do the execution work, not just the thinking work"

## Core Product Behavior

The v1 agent should behave as a cautious execution system.

Behavior rules:

- The input experience is open-ended and template-free by default.
- If the request is underspecified, the agent asks the minimum necessary clarification questions.
- If the request is sufficiently specified, the agent should proceed without asking unnecessary questions.
- The system should default to execution capability, including file edits and command runs, instead of acting as a read-only assistant.
- The system should automatically decide whether the final output belongs in the conversation, as an artifact, or as both.

The intended user perception is:

- "I gave it a task, not a prompt."
- "It understood what was missing."
- "It did real work."
- "I can see what it did."
- "The result is usable."

## Core Task Flow

The v1 task flow should be:

1. User enters a goal in the universal input box.
2. The system evaluates whether enough information is available.
3. If not, the system asks only the smallest set of necessary questions.
4. Once the task is scoped, the system creates a short execution plan.
5. The system decides which sources are needed:
   - conversation context
   - local files or directories
   - public web sources
   - sandbox execution environment
6. The system executes the task.
7. The system decides the best final delivery form:
   - direct answer
   - document artifact
   - structured list or table
   - modified file(s)
   - mixed output
8. The user can continue iterating in the same task context.

This should feel like one continuous task, not separate disconnected tools.

## Sandbox Role

Sandbox execution is a core product capability in v1.

The sandbox should exist in the product model for four reasons:

### 1. Default Execution Environment

When the task requires commands, file edits, batch transformations, dependency installation, or generated outputs, execution should happen in the sandbox by default rather than directly on the host.

### 2. Result Production Environment

The sandbox is where work gets done, not just where commands run.

Examples:

- processing files
- running format conversions
- generating intermediate outputs
- creating deliverables
- testing a task workflow before returning results

### 3. Risk Isolation Layer

The product promise includes default execution capability, which means users need a visible safety boundary.

The sandbox gives the system a trustworthy execution model:

- risky actions are isolated
- file changes happen in a controlled environment
- outputs can be inspected before they are treated as final

### 4. Transparency Surface

Users should be able to understand:

- whether sandbox execution was used
- what the sandbox did
- which files or outputs were created
- what was brought back into the main task workspace

The sandbox should make the system feel more trustworthy, not more opaque.

## MVP Scope

The first version should focus on a single high-quality open-input task loop.

Included:

- one universal input box as the primary entry point
- clarification when required
- short visible planning before execution
- user input, local files, and public web as supported inputs
- sandbox-backed execution for commands and file operations
- automatic choice between direct response and artifact output
- persistent task history and continuation
- visible execution progress and result delivery

Supported result types:

- direct answer in the task thread
- markdown artifact
- structured checklist
- comparison or summary table
- modified or generated local files
- mixed outputs combining summaries and files

Excluded from v1:

- multi-agent orchestration as a user-facing concept
- complex authenticated browser automation
- host-machine direct execution as a default path
- heavyweight project-management views
- recurring workflows and automation-first experiences

## UX Principles

### Open Input, Strong Execution

Users should not need to classify the task in advance. They describe the goal, and the system figures out the execution path.

### Clarify Sparingly

The system should ask fewer questions than a human assistant would if it can make reasonable progress safely.

### Task First, Not Chat First

The center of the experience is task progression and result delivery, not conversational back-and-forth for its own sake.

### Deliverable Over Explanation

The product should bias toward producing something usable, not merely explaining what could be done.

### Visible Work

Users should be able to tell what the agent is doing, what sources it used, whether it entered the sandbox, and what concrete outputs it produced.

## Information Sources

v1 should treat these three input channels as first-class:

- user-provided text in the conversation
- local files and directories
- public web content

The system should determine when each source is needed instead of forcing the user to choose up front.

This is a major product distinction. The value is not any single source. The value is source fusion plus execution.

## Output Strategy

The system should automatically choose the output mode.

Guidelines:

- simple analysis or short answers can stay in the thread
- tasks that naturally produce something reusable should generate artifacts
- tasks that include file transformation or structured output should return those outputs directly
- complex tasks may require both a summary and one or more artifacts

The user should feel that the system chose the most useful final form, not the most convenient engineering form.

## Research Capability Demotion

Research is no longer the product center.

What should remain:

- reading public web content
- extracting relevant text
- combining evidence from multiple sources
- generating written outputs based on gathered material

What should change:

- do not frame the product as a research agent
- do not require a research-specific lifecycle
- do not center source queues or citations in the UI unless they are needed for trust in the current task
- do not make report generation the defining capability

Research becomes one execution pattern inside a broader general task system.

## Product Model Changes

The product should move from research-specific concepts to general execution concepts.

Recommended user-facing lifecycle:

- `intake`
- `clarifying`
- `planning`
- `executing`
- `awaiting_input`
- `completed`
- `failed`

The product should avoid exposing research-specific states such as:

- `researching`
- `synthesizing`
- `report_ready`

Those can exist internally if useful, but they should not define the main product narrative.

## Functional Priorities

### P0: Core Task Loop

Must have for MVP:

- universal task input
- minimum clarification loop
- short execution plan
- multi-source reading
- sandbox execution path
- task progress visibility
- direct reply or artifact output
- persistent task continuation

### P1: Trust And Reliability

Next most important:

- clearer execution plan rendering
- sandbox action summaries
- better failure explanations
- resume after interruption
- stronger result quality consistency

### P2: Productivity Multipliers

After the core loop is solid:

- reusable task patterns
- richer artifact types
- saved context and task memory
- sharing and export improvements

## Research Demotion Checklist

The following changes should happen across product, naming, and flow:

1. Remove research-centered language from homepage and workspace copy.
2. Replace research-specific state names with general execution states.
3. Rename research-specific modules so they describe generic capabilities rather than a vertical workflow.
4. Reframe report generation as one artifact generation capability among many.
5. Reduce source-specific UI prominence unless the current task depends on source trust.
6. Ensure the main task story is "understand -> execute -> deliver" rather than "research -> synthesize -> report."

## MVP Functional Priority Table

| Priority | Capability | Why it matters |
| --- | --- | --- |
| P0 | Universal input box | Defines the product entry model |
| P0 | Clarification gate | Prevents bad execution on underspecified requests |
| P0 | Multi-source ingestion | Core to task usefulness |
| P0 | Sandbox execution | Core to safe action-taking |
| P0 | Artifact generation | Makes outputs reusable |
| P0 | Task history and continuation | Turns one-off runs into a workspace |
| P1 | Better execution explainability | Builds trust |
| P1 | Better error recovery | Prevents task abandonment |
| P1 | Richer output typing | Increases usefulness across task types |
| P2 | Reusable task memory | Improves repeat usage |
| P2 | Saved patterns or presets | Helps frequent tasks without replacing open input |
| P2 | Automation and recurrence | Useful later, not essential to v1 |

## Roadmap

### MVP

Goal:
Let a user hand over a real task in one input box and get a usable result back.

Focus:

- open input
- sparse clarification
- multi-source reading
- sandbox execution
- auto-selected output mode
- visible progress

### Beta

Goal:
Make users trust the system with more complex work.

Focus:

- stronger execution-plan display
- more interpretable sandbox actions
- interruption recovery
- more stable output quality
- better task continuation behavior

### Expansion

Goal:
Turn the product from a single-task executor into a persistent personal work surface.

Focus:

- task memory
- reusable working patterns
- richer artifacts
- scheduled or recurring tasks
- sharing and collaboration

## Success Metrics

This product should be measured by task completion and usefulness, not conversation volume.

Recommended core metrics:

- first-task completion rate
- artifact generation rate
- continuation rate after task completion
- clarification recovery rate
- sandbox task success rate
- user-perceived trust in execution

The north star is not "how much the model said." It is "whether the user trusted it to complete work and found the result usable."
