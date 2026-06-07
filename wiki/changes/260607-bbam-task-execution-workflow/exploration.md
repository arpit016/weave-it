---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-07T09:52:57.429Z
updated_at: 2026-06-07T10:51:36.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Task Execution Workflow

## Topic

Task execution workflow for local Weave tasks.

## Current Understanding

Weave now has a task prepare workflow that can safely establish local branch readiness for selected `T#` tasks. Prepare is intentionally narrow: it does not implement code, verify work, update task statuses, commit, push, or open PRs.

The next desired workflow is `/weave-execute`: an agent-first workflow that runs selected tasks end to end inside the active Weave change. In v1, execution means:

- ask the user what to execute when no selector is provided;
- resolve selected `T#` tasks by explicit task ids, scope, or all;
- use `Blocked by:` metadata in `tasks.md` to understand dependency order;
- run the existing prepare workflow for the final selected task set;
- implement selected executable tasks;
- run task verification and the smallest relevant broader checks when needed;
- update local `tasks.md` statuses, satisfied acceptance criteria, and concise verification evidence.

`/weave-execute` is local-only in v1. It does not commit, push, open PRs, stash, discard changes, create remote branches, or publish anything remotely.

The v1 product surface is `/weave-execute` only. A deterministic `weave task execute` CLI is deferred because arbitrary implementation is agent behavior, not something the CLI can safely perform without a first-class agent runner.

## Open Questions

- Exact no-argument prompt wording for `/weave-execute`.
- Exact final summary format for multi-task execution runs.
- Whether `/weave-execute all` should include HITL tasks automatically or only when needed as dependencies. Current leaning: do not autonomously execute HITL tasks unless explicitly selected or dependency-driven.
- Whether execution should record structured run history outside task-level verification notes.

## Decisions

- Use the product term `execute` for the agent-first workflow that implements and verifies local `T#` tasks.
- v1 ships `/weave-execute` as an agent skill workflow only.
- Do not add `weave task execute` in v1.
- If `/weave-execute` is invoked without arguments, ask whether the user wants to execute all tasks, a scope, or specific task ids.
- Execute selected tasks by preparing if needed, implementing, verifying, and updating local task status.
- Always run the existing prepare command for the final selected task set before implementation.
- If prepare reports blockers, stop before implementation.
- Do not commit, push, open PRs, stash, discard changes, create remote branches, or publish remotely.
- Use `Blocked by:` in `tasks.md` as dependency truth.
- If selected tasks are blocked by other tasks, execute the blocking tasks first according to dependency order.
- Eligible task statuses are `todo`, `in_progress`, and `not_tested`.
- Execute `blocked` tasks only after their `Blocked by:` dependencies are resolved in the same run.
- Skip `done` and `invalid` tasks by default.
- For multi-task runs, continue independent later tasks when one task fails, but skip downstream tasks blocked by the failed task.
- HITL tasks may be included when explicitly selected or required as dependencies, but the agent must pause for the human input that makes them HITL.
- Dirty repos already on the expected branch are not a blocker when prepare succeeds.
- Mark a task `in_progress` when execution starts for that task.
- Mark a task `done` only when implementation is complete and verification passes.
- Mark a task `not_tested` when implementation appears complete but verification could not run.
- Leave or set a task `in_progress` with notes when verification fails or implementation remains incomplete.
- Update both the active task index status and the task detail `Status:`.
- Check off only acceptance criteria that were actually satisfied.
- Append concise verification notes under the task being executed.
- Do not rewrite unrelated task wording or unrelated sections.

## Scenarios

### No-Argument Invocation

1. A user runs `/weave-execute`.
2. The agent reads the active change's `tasks.md`.
3. The agent asks what to execute, offering available task ids, scopes, and `all`.
4. The user chooses a selector.
5. The agent resolves the final executable task set and dependencies.

### Explicit Task With Dependencies

1. A user runs `/weave-execute T3`.
2. The agent reads `T3` and its `Blocked by:` field.
3. If `T3` depends on `T1`, the agent executes `T1` first unless it is already `done`.
4. After dependency execution succeeds, the agent executes `T3`.

### Scope Execution

1. A user runs `/weave-execute backend`.
2. The agent selects backend-scoped `T#` tasks.
3. The agent includes required dependencies from `Blocked by:`.
4. The agent prepares the final task set, executes tasks in dependency order, verifies them, and updates task status.

### Prepare Blocker

1. A user runs `/weave-execute T2`.
2. The agent resolves the final selected task set.
3. The agent invokes the existing prepare workflow.
4. Prepare reports a dirty repo on a different branch or another blocker.
5. Execution stops before implementation.

### Failed Independent Task

1. A user runs `/weave-execute T1 T2 T3`.
2. `T1` fails verification.
3. `T2` does not depend on `T1`, so the agent continues to `T2`.
4. `T3` depends on `T1`, so the agent skips or blocks `T3`.
5. The final summary reports the failure, completed independent tasks, and blocked downstream tasks.

### HITL Task

1. A selected task is `Type: HITL`.
2. The agent pauses at the point requiring human input.
3. If the user provides the needed input, the agent continues.
4. If the user does not provide the input, the task remains incomplete with local notes.

### Verification Outcome

1. The agent implements a task.
2. The agent runs the task's listed verification first.
3. If listed verification is absent or weak for the change, the agent runs the smallest relevant broader check.
4. Passing verification allows `done`.
5. Unavailable verification allows `not_tested` only when implementation appears complete.
6. Failed verification leaves the task `in_progress` with concise notes.

## Existing Behavior

- `tasks.md` is the canonical local task artifact for a change.
- `tasks.md` includes `T#` implementation tasks, statuses, `Type`, `Scope`, `Primary repo`, `Repos`, `Blocked by`, acceptance criteria, and verification guidance.
- Task statuses are `todo`, `in_progress`, `blocked`, `done`, `not_tested`, and `invalid`.
- `weave-prepare` and `weave task prepare` prepare local branches for selected task repos and store readiness under `status.yml.execution.repos`.
- Prepare is status-agnostic and branch-readiness-only.
- Prepare does not implement, verify, update task statuses, commit, push, open PRs, stash, discard changes, or create remote branches.
- No first-class `/weave-execute` skill exists yet.
- No `weave task execute` CLI exists yet, and v1 does not need one.

## PRD Readiness

Ready. The discussion has enough product decisions to produce a PRD for `/weave-execute` v1 as an agent-first local task execution workflow.
