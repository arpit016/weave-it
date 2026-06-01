---
artifact: prd
status: draft
owner: product
created_at: 2026-06-01T19:57:54.000Z
updated_at: 2026-06-01T19:57:54.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Local Tasks Workflow For `weave-issues` PRD

## Problem Statement

Weave users use `weave-issues` to turn PRDs, architecture, implementation plans, specs, and other planning context into implementation slices. Today the skill is written around publishing issues to an external tracker. That is not always the desired or available workflow.

For now, the user wants `weave-issues` to create and reconcile local issue/task breakdowns in the active change folder. The local file should be useful for implementation agents and humans, preserve vertical-slice task planning, and still work in repositories with uneven testing maturity.

The current skill also assumes each vertical slice includes tests, but does not define behavior when the target repo has no usable automated test suite. This leaves agents with an unclear choice between blocking, inventing test infrastructure, or silently omitting verification.

## Goals

- Make `weave-issues` create and reconcile local task breakdowns in `tasks.md`.
- Keep `tasks.md` as the durable local artifact for issue/task breakdown evidence.
- Keep the skill name and lifecycle lane as `weave-issues` / `issues`.
- Preserve vertical-slice task planning while adapting verification expectations to the target repo.
- Make task reconciliation preserve useful progress and history.
- Keep external issue trackers as optional input context only, not an output destination.
- Clearly separate `weave-issues` responsibilities from implementer responsibilities.

## Non-Goals

- Do not introduce `issues.md`.
- Do not publish, close, comment on, label, or mutate external issue tracker items.
- Do not make `weave-issues` the day-to-day task status updater.
- Do not require strict test-first TDD process language.
- Do not require every repo to add a test harness before tasks can be generated.
- Do not define implementation architecture for parsing or modifying `tasks.md`.

## Actors

- Weave user: asks `weave-issues` to create or refresh implementation tasks for an active change.
- Implementation agent: picks up tasks from `tasks.md`, implements them, and updates task status and verification fields.
- Human implementer: may do the same work as an implementation agent.
- External issue tracker: may be referenced as source context, but is not mutated by this workflow.

## Current Behavior

`weave-issues` currently describes a tracker-oriented workflow:

- gather context from PRD, architecture, status, and optional issue references
- draft tracer-bullet vertical slices
- quiz the user on granularity and blockers
- publish approved slices to an external issue tracker
- record lifecycle progress for the `issues` lane

Existing Weave lifecycle behavior already treats a populated `tasks.md` as evidence that issue breakdown has happened. Prior Weave context also records that `issues` is a lifecycle lane, not a live artifact context.

The current vertical-slice rule says each slice should cover all layers including tests, but it does not say what to do when a repo lacks automated testing infrastructure.

## Proposed Product Behavior

`weave-issues` should produce local `tasks.md` output by default and for this change only local output is supported. The skill should continue drafting vertical slices, presenting the proposed breakdown to the user, and waiting for approval. After approval, it should create or reconcile `wiki/changes/<change-id>/tasks.md`.

The skill should accept source context from any sufficiently concrete plan or reference, including PRD, architecture, implementation plan, spec, sessions, discussion, codebase findings, local paths, or external issue references. If the user provides an external issue URL or issue number, `weave-issues` may read it as source context when available, but must not mutate the external issue tracker.

When `tasks.md` already exists, `weave-issues` should reconcile rather than bluntly replace it. It should preserve meaningful progress, add new tasks, update changed tasks, and mark obsolete tasks as `invalid` instead of deleting them.

For testing and verification, `weave-issues` should inspect the target repo for existing test infrastructure. If a usable test base exists, code-affecting tasks should include relevant automated test expectations. If no usable test base exists, generated tasks should remain actionable and include manual or smoke verification expectations. Missing automated tests should not by itself block task generation.

## User Workflows

### Workflow: User Creates Local Tasks

1. User runs `weave-issues` for an active change.
2. System reads relevant source context.
3. System drafts vertical-slice tasks.
4. System presents the task breakdown for user review.
5. User approves or asks for changes.
6. System writes local `tasks.md` after approval.
7. System records lifecycle progress for the `issues` lane using the actual sources that informed the task breakdown.

### Workflow: User Reconciles Existing Tasks

1. User reruns `weave-issues` after source context changes.
2. System reads existing `tasks.md` and current source context.
3. System proposes a reconciliation.
4. User approves the proposed changes.
5. System preserves still-valid progress, updates changed tasks, adds new tasks, and marks obsolete tasks `invalid`.
6. System writes the revised `tasks.md`.

### Workflow: User Provides External Issue Context

1. User invokes `weave-issues` with an external issue URL, issue number, or path.
2. System reads that reference as source context when available.
3. System generates or reconciles local `tasks.md`.
4. System does not mutate the external tracker.

### Workflow: Repo Has A Usable Test Suite

1. System inspects the target repo and finds established test infrastructure.
2. System generates code-affecting tasks with relevant automated test expectations.
3. Implementer completes the task and updates status and verification fields in `tasks.md`.

### Workflow: Repo Has No Usable Test Suite

1. System inspects the target repo and does not find usable automated test infrastructure.
2. System still generates actionable tasks.
3. Generated tasks include manual or smoke verification expectations.
4. Implementer later applies `not_tested` only if implementation appears complete but automated verification could not be completed.

## User Stories

1. As a Weave user, I want `weave-issues` to write local `tasks.md`, so that I can work without an external issue tracker.
2. As a Weave user, I want approved task breakdowns to be written only after review, so that the local task file does not change unexpectedly.
3. As a Weave user, I want existing task progress preserved during reconciliation, so that refreshing the breakdown does not erase implementation state.
4. As an implementation agent, I want invalid tasks separated from active tasks, so that I do not accidentally pick up obsolete work.
5. As a Weave user, I want external issue references usable as input context, so that existing planning material can inform local tasks.
6. As a Weave user, I want lifecycle progress to reflect the actual task sources, so that stale downstream guidance remains accurate.
7. As an implementation agent, I want tasks to include verification expectations appropriate to the repo, so that I know how to prove completion.
8. As an implementation agent, I want `not_tested` available as a status, so that I can record completed-but-unverified work without calling it done.

## Functional Requirements

- The system should create or reconcile `wiki/changes/<change-id>/tasks.md` as the local task breakdown artifact.
- The system should not create `issues.md`.
- The system should keep `issues` as the lifecycle lane.
- The system should use `tasks.md` as local issue/task breakdown evidence.
- The system should gather task source context from any sufficiently concrete plan or reference.
- The system should allow external issue references as source context only.
- The system should not mutate external issue trackers.
- The system should preview task creation or reconciliation before writing `tasks.md`.
- The system should wait for explicit user approval before writing `tasks.md`.
- The system should preserve existing task progress when task intent still maps cleanly to the refreshed breakdown.
- The system should keep stable task IDs for unchanged task intent.
- The system should assign new IDs to new tasks.
- The system should not reuse invalidated task IDs.
- The system should mark obsolete tasks as `invalid` instead of deleting them.
- The system should remove invalid tasks from the active task index and list them in a separate invalid-tasks section with reasons.
- The system should include status vocabulary for `todo`, `in_progress`, `blocked`, `done`, `not_tested`, and `invalid`.
- The system should start newly generated tasks as `todo` unless a real blocker is already known.
- The system should inspect the target repo for existing testing conventions before drafting verification expectations.
- The system should include automated test expectations for code-affecting tasks when a usable test base exists.
- The system should include manual or smoke verification expectations when no usable test base exists.
- The system should record lifecycle progress for `issues` after successful local task creation or reconciliation using the actual sources that informed the task breakdown.

## Permissions and Access Control

The workflow is local to the active Weave change. Any user or agent with write access to the repository can create or update `tasks.md`.

External issue trackers are read-only context for this workflow. The skill should not perform tracker mutations, even if credentials are available.

## States and Lifecycle

Task statuses in `tasks.md` should support:

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without a listed blocker or decision
- `done`: implemented and verified
- `not_tested`: implementation appears complete, but automated verification could not be completed
- `invalid`: no longer applies after source context changed

`weave-issues` may define these statuses and initialize generated tasks, but implementers own execution-time status updates.

Change lifecycle should progress to the `issues` lane only after local tasks are successfully created or reconciled.

## Notifications and Visibility

No user notifications are required.

Visibility is through the local `tasks.md` file and Weave change status. Invalid tasks should remain visible in a separate section so users can understand why prior tasks left the active index.

## Edge Cases

- `tasks.md` already exists: reconcile after preview and approval rather than replacing blindly.
- Existing tasks have progress: preserve status and checked acceptance criteria where task intent still maps cleanly.
- Existing task no longer applies: mark as `invalid` with a reason and remove it from the active index.
- Source context is too vague: ask for more context or leave an open question rather than generating misleading tasks.
- External issue reference is unavailable: report that the reference could not be read and continue only if enough other source context exists.
- Repo has no test suite: generate tasks with manual or smoke verification expectations.
- Repo has a test suite but tests cannot be run during implementation: implementer may mark the task `not_tested` with the reason.
- User asks for external issue publication: out of scope for this change.

## Acceptance Criteria

- [ ] `weave-issues` creates or reconciles local `tasks.md` rather than publishing external tracker issues.
- [ ] `issues.md` is not created or documented as the local artifact.
- [ ] External issue references are treated as source context only.
- [ ] The user sees a preview before `tasks.md` is written.
- [ ] Existing task progress is preserved when the task still maps to the refreshed breakdown.
- [ ] Obsolete tasks are marked `invalid` and moved out of the active task index.
- [ ] Newly generated tasks start as `todo` unless a blocker is known.
- [ ] `not_tested` is defined as implementer-applied status vocabulary.
- [ ] Code-affecting tasks include automated test expectations when a usable test base exists.
- [ ] Tasks include manual or smoke verification expectations when no usable test base exists.
- [ ] Lifecycle progress for `issues` records the actual sources used for task generation or reconciliation.
- [ ] Documentation and skill text no longer describe external tracker publishing as the active workflow.

## Rollout Considerations

This is a skill behavior and documentation change. Existing historical `tasks.md` files remain valid.

Users with installed agent skill copies need the canonical template and installed copies updated together so local agent behavior matches the shipped workflow.

No migration of old `tasks.md` files is required.

## Analytics and Success Metrics

- Users can run `weave-issues` without needing external tracker credentials.
- Generated task breakdowns are available locally in `tasks.md`.
- Fewer `weave-issues` runs fail or stall because no external tracker is available.
- Fewer implementation agents pick up obsolete work because invalid tasks are separated from active tasks.
- Task verification expectations are clear in repos with and without automated test infrastructure.

## Revision History

- 2026-06-02: Initial PRD generated from `exploration.md` and exploration session notes.

## Assumptions

- `tasks.md` is the canonical local issue/task breakdown artifact.
- External tracker publishing is out of scope for this change, even when credentials are available.
- Exact markdown section names in `tasks.md` can be refined during architecture or implementation as long as the product behavior remains intact.
- Implementers are responsible for updating task status and verification fields during execution.
- The existing Weave lifecycle model can record `issues` progress from non-architecture sources.

## Open Questions

- What exact `tasks.md` section order should be standardized for the generated local tracker?
- What precise wording should be used for task verification fields in repos with no usable automated test suite?

## Out of Scope

- External issue tracker publishing.
- External issue tracker mutation.
- A new `issues.md` artifact.
- A separate task-status update skill or command.
- Automatic test harness setup for repos without tests unless a source artifact explicitly asks for it.
- Code-level implementation design for task reconciliation.

## Further Notes

This change should keep `weave-issues` focused on producing implementation-ready local task breakdowns. The skill can define the structure and vocabulary of `tasks.md`, but should avoid implying that it knows execution-time outcomes such as whether implementation completed or whether tests actually ran.
