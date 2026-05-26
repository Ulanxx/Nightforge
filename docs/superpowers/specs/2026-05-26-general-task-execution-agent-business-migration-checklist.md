# General Task Execution Agent Business Migration Checklist

Date: 2026-05-26

Related document:

- `docs/superpowers/specs/2026-05-26-general-task-execution-agent-product-plan.md`

## Objective

Move the product from a research-centered vertical into a general task execution agent without drifting into a vague "do anything" story.

This checklist is not a low-level engineering plan. It is the business-facing migration checklist that aligns product narrative, task model, experience design, and capability boundaries.

## Migration Goal

After this migration:

- the product should present itself as a universal task execution workspace
- the user should understand that they are handing off a task, not starting a chat
- research should become one internal capability pattern rather than the product identity
- sandbox execution should become an explicit part of the product promise

## Workstream 1: Page-Level Product Narrative

### Homepage

Goal:
Make the homepage clearly communicate "describe a goal and the agent will execute" rather than "start a research flow."

Checklist:

- Replace any research-centered or report-centered headline language.
- Rewrite the main promise around task handoff, execution, and delivery.
- Ensure the input box framing implies open-ended task entry rather than a specific vertical.
- Update helper text to mention:
  - user input
  - local files
  - web information
  - sandbox execution when needed
- Review suggested prompt examples so they represent general task execution rather than mostly research tasks.
- Ensure the recent-session area reinforces task continuity, not research history.

Definition of done:

- A new user can read the homepage and understand that this is a general task execution agent.
- The homepage no longer suggests that the core product is a research tool.

### Task Workspace

Goal:
Make the workspace feel like a task execution console rather than a research dashboard.

Checklist:

- Reframe the main content area around task progression:
  - intake
  - clarification
  - plan
  - execution
  - result
- Reduce UI emphasis on research-specific source concepts unless the current task truly depends on them.
- Add visible cues when sandbox execution is active.
- Make result delivery feel broader than report delivery.
- Ensure continuation prompts encourage follow-up work in the same task context.

Definition of done:

- The task page reads as a general mission-control surface.
- Users can understand what the agent is doing without the UI implying a research-only workflow.

## Workstream 2: Task State Model

Goal:
Replace research-specific lifecycle language with a general execution lifecycle.

Target user-facing states:

- `intake`
- `clarifying`
- `planning`
- `executing`
- `awaiting_input`
- `completed`
- `failed`

Checklist:

- Audit every state currently exposed to the user.
- Identify research-specific states such as:
  - `researching`
  - `synthesizing`
  - `report_ready`
- Decide which ones remain internal implementation details and which must disappear entirely.
- Ensure UI labels, filtering logic, summaries, and badges all use the new task execution model.
- Ensure event summaries map cleanly onto the new model.

Definition of done:

- A user can read task status without seeing vertical-specific workflow language.
- State names reinforce a general execution model.

## Workstream 3: Capability And Module Reframing

Goal:
Keep useful capabilities while removing research as the architecture center of gravity.

Checklist:

- Identify research-specific modules, helpers, and concepts currently acting as first-class workflow elements.
- Split them into generic capability categories:
  - web reading
  - source extraction
  - synthesis
  - artifact generation
  - execution orchestration
- Rename modules that currently overfit the research vertical.
- Keep report generation only as one artifact-generation mode.
- Ensure future task types can reuse web-reading and synthesis capabilities without inheriting research terminology.

Recommended reframing examples:

- `research` -> `web-intake` or `source-ingestion`
- `report-runner` -> `artifact-runner` or `deliverable-runner`
- `research plan` -> `execution plan`
- `sources` -> `inputs`, `evidence`, or `materials`, depending on context

Definition of done:

- The architecture reads as a general task execution system.
- Research remains possible, but no longer defines the product or module map.

## Workstream 4: API And Product Contract

Goal:
Ensure the API surface reflects a general task agent rather than a special-purpose research flow.

Checklist:

- Review task creation contract to ensure the API is neutral to task type.
- Ensure reply/resume flows are framed around task continuation, not clarification in a research workflow only.
- Ensure event APIs support general execution status, sandbox progress, file operations, and artifact creation.
- Ensure artifact APIs are not implicitly report-specific.
- Review session APIs to ensure they model task continuity, not just one-shot runs.

Business contract expectations:

- `POST /api/tasks` creates a general task, not a research task.
- `POST /api/tasks/:taskId/reply` resumes a task, not just a research clarification loop.
- event and artifact endpoints should feel generic enough to support any supported task type.

Definition of done:

- The external and internal API contracts do not force a research-specific mental model.

## Workstream 5: Copy And Naming Audit

Goal:
Remove research-first wording and replace it with language that supports the new product identity.

Checklist:

- Audit homepage copy.
- Audit task-page copy.
- Audit empty states.
- Audit task summaries.
- Audit status labels.
- Audit event labels.
- Audit artifact labels.
- Audit error messages where the product describes what it was doing.

Replace phrases like:

- "research task"
- "research plan"
- "sources selected for the report"
- "report synthesis"
- "research complete"

With phrases like:

- "task"
- "execution plan"
- "input materials collected"
- "artifact generation"
- "task completed"

Definition of done:

- A product copy review no longer reveals the old vertical as the dominant story.

## Workstream 6: Sandbox As A Product Feature

Goal:
Turn sandbox execution from an implementation detail into a visible trust and execution primitive.

Checklist:

- Decide where the product explicitly tells the user sandbox execution is being used.
- Add a task-stage or panel treatment that shows sandbox activity clearly but concisely.
- Define what counts as a sandbox-worthy action:
  - command execution
  - file generation
  - file modification
  - batch processing
  - dependency installation
- Define what the user should see after sandbox work completes:
  - outputs created
  - files changed
  - artifacts returned
  - failures encountered
- Ensure sandbox usage reinforces trust rather than complexity.

Definition of done:

- Users understand when the agent executed work in isolation.
- Sandbox usage improves confidence in the agent's ability to act safely.

## Workstream 7: Universal Input Box Experience

Goal:
Make the open-ended input box feel intentional rather than underspecified.

Checklist:

- Ensure placeholder copy teaches users to describe goals, not keywords.
- Ensure examples span multiple task types, not one vertical.
- Ensure the post-submit experience quickly shows whether the agent is clarifying, planning, or executing.
- Ensure blank-state guidance does not force users into templates.
- Ensure the system communicates that the agent can choose among multiple sources and execution strategies automatically.

Definition of done:

- The universal input box feels powerful and understandable without relying on templates.

## Workstream 8: Output Strategy

Goal:
Make results feel task-native instead of report-native.

Checklist:

- Define when a task should end with a direct reply only.
- Define when a task should generate one or more artifacts by default.
- Define how structured outputs such as tables, checklists, or transformed files are presented.
- Ensure the UI supports mixed outcomes:
  - a concise summary
  - one or more artifacts
  - file changes or generated files
- Ensure result framing emphasizes completed work, not just model prose.

Definition of done:

- Users see results in the form that best matches the task.
- The product is not biased toward reports when another form is more useful.

## Workstream 9: Research Capability Demotion

Goal:
Preserve useful research mechanics while removing them from the center of the product.

Checklist:

- Keep public web reading as a supported input capability.
- Keep evidence synthesis as a supported reasoning pattern.
- Keep document generation as one possible output.
- Remove research from:
  - top-level positioning
  - primary state model
  - main UI emphasis
  - default terminology
- Reclassify research as one task pattern within the general execution system.

Definition of done:

- A user who never runs a research-like task still experiences a coherent product.
- A user who does run a research-like task still benefits from the web-reading capability.

## Business Priority Matrix

### P0: Must Ship With The Repositioning

- homepage narrative rewrite
- task workspace narrative rewrite
- user-facing state model rewrite
- sandbox surfaced as part of the task model
- universal input box framing
- output strategy broadening beyond reports

### P1: Strongly Recommended Right After

- capability and module renaming
- event/copy cleanup
- stronger sandbox visibility
- artifact presentation cleanup
- research capability demotion in secondary UI

### P2: Follow-On Improvements

- reusable working patterns without replacing open input
- richer artifact typing
- better result previews
- more explicit execution trust cues

## Sequencing Recommendation

The migration should be executed in this order:

1. Product language and positioning
2. User-facing state model
3. Workspace narrative and panels
4. Sandbox visibility
5. Output strategy broadening
6. Internal module and capability renaming
7. Deep cleanup of research-specific remnants

This order matters because product confusion starts at the narrative level before it appears in code structure.

## Exit Criteria

The migration is complete when all of the following are true:

- a first-time user would describe the product as a task execution agent
- the homepage no longer implies a research-first product
- the task workspace no longer feels like a specialized research UI
- sandbox execution is visible and understandable
- outputs are not biased toward reports
- research survives only as one supported execution pattern inside the broader system
