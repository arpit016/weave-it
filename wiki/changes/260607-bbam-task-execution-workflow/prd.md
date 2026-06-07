---
artifact: prd
status: draft
owner: product
created_at: 2026-06-07T10:53:31.000Z
updated_at: 2026-06-07T10:58:29.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Task Execution Workflow PRD

## Problem Statement

Weave can break a change into local `T#` implementation tasks and can now prepare the relevant repos for implementation through `/weave-prepare` and `weave task prepare`. That prepare workflow solves branch readiness, but it intentionally stops before implementation.

After prepare, an engineer or agent still has to manually decide which tasks to execute, reason through `Blocked by:` dependencies, implement each task, run verification, update local task statuses, check off satisfied acceptance criteria, and leave enough evidence for the next agent or human to understand what happened.

This creates a gap in the AI-assisted SDLC flow: Weave can plan and prepare work, but it does not yet provide a first-class agent workflow for carrying selected local tasks through implementation and verification.

## Goals

- Provide `/weave-execute` as the v1 agent-first task execution workflow.
- Let the user execute tasks by explicit task id, scope, or all tasks.
- Ask the user what to execute when `/weave-execute` is invoked without a selector.
- Use `Blocked by:` metadata in `tasks.md` to execute dependencies before dependent tasks.
- Always use the existing prepare workflow before implementation.
- Implement selected executable `T#` tasks and run appropriate verification.
- Update local `tasks.md` status, satisfied acceptance criteria, and concise verification evidence.
- Continue independent tasks when one task fails, while skipping downstream tasks blocked by that failure.
- Keep execution local-only and avoid remote publishing side effects.

## Non-Goals

- Adding `weave task execute` in v1.
- Creating a deterministic CLI that implements arbitrary code.
- Committing changes.
- Pushing branches.
- Opening pull requests.
- Creating remote branches.
- Stashing, discarding, force-checking-out, or otherwise resolving dirty work automatically.
- Publishing or updating external issue trackers.
- Creating per-repo task artifacts.
- Rewriting unrelated task content in `tasks.md`.
- Replacing `/weave-prepare`; execution should build on prepare rather than duplicate it.

## Actors

- **User**: invokes `/weave-execute`, chooses the task selector when needed, and provides input for HITL tasks.
- **Agent using `/weave-execute`**: resolves the active change, selects tasks, prepares repos, implements tasks, runs verification, and updates local task state.
- **Future implementation agent**: may resume from task statuses and verification notes left by a previous `/weave-execute` run.
- **Human engineer**: may inspect local changes, task status updates, verification notes, and remaining failures after execution.

## Current Behavior

Weave stores local implementation tasks in `wiki/changes/<change-id>/tasks.md`. `T#` task entries include status, type, scope, primary repo, related repos, dependency metadata, acceptance criteria, and verification guidance.

Current task statuses are:

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified
- `not_tested`: implementation appears complete, but automated verification could not be completed
- `invalid`: no longer applies after source context changed

The prepare workflow can select tasks by task id, scope, or all tasks. It derives implementation repos from task metadata, safely prepares branches for the active change, and records readiness in `status.yml.execution.repos`.

Prepare does not implement code, run task verification, update task statuses, commit, push, open PRs, stash, discard changes, or create remote branches. There is no first-class `/weave-execute` workflow today.

## Proposed Product Behavior

`/weave-execute` is an agent-first local workflow for executing `T#` tasks in an active Weave change.

The v1 surface is:

```text
/weave-execute
/weave-execute T3
/weave-execute T1 T3 T7
/weave-execute backend
/weave-execute all
```

When no selector is provided, the agent asks what to execute and suggests available task ids, scopes, and `all` from `tasks.md`.

The no-argument prompt should be short and example-driven, such as:

```text
What should I execute: all tasks, a scope like backend, or specific task ids like T1 T3?
```

When a selector is provided, the agent resolves the matching `T#` tasks, evaluates `Blocked by:` dependencies, expands execution order to include required blocking tasks, runs prepare for the final selected task set, implements executable tasks, verifies them, and updates `tasks.md`.

Execution is local-only. It does not commit, push, open PRs, create remote branches, stash, discard, or publish external state.

Execution evidence is stored in the affected task entries through status, checked acceptance criteria, and task-level verification notes. V1 does not create a separate execution run history artifact or status log.

## User Workflows

### Workflow: User Executes Specific Tasks

1. The user runs `/weave-execute T3`.
2. The agent reads the active change and `tasks.md`.
3. The agent resolves `T3` and inspects its `Blocked by:` field.
4. If `T3` depends on incomplete tasks, the agent executes those blocking tasks first unless they are already `done`.
5. The agent runs prepare for the final task set.
6. If prepare succeeds, the agent marks the current task `in_progress`, implements it, verifies it, and updates the task result.
7. The agent summarizes completed, failed, skipped, and blocked tasks.

### Workflow: User Executes A Scope

1. The user runs `/weave-execute backend`.
2. The agent selects `T#` tasks whose `Scope` matches `backend`.
3. The agent includes required dependencies from `Blocked by:`.
4. The agent runs prepare for the final selected task set.
5. The agent executes tasks in dependency order.
6. Independent tasks continue even if another task fails.
7. The agent updates `tasks.md` and summarizes results.

### Workflow: User Executes All Tasks

1. The user runs `/weave-execute all`.
2. The agent selects all executable `T#` tasks in the active change.
3. The agent orders work by `Blocked by:` dependencies.
4. The agent runs prepare for the final selected task set.
5. The agent executes eligible AFK tasks and includes HITL tasks, pausing before each HITL task for required user input.
6. The agent skips `done` or `invalid` tasks by default.
7. The agent summarizes completed work and any remaining failures or blockers.

### Workflow: User Invokes Without Arguments

1. The user runs `/weave-execute`.
2. The agent reads `tasks.md`.
3. The agent asks a short selector question with examples, such as: "What should I execute: all tasks, a scope like backend, or specific task ids like T1 T3?"
4. The user chooses a selector.
5. The agent continues as if the selector had been passed directly.

### Workflow: HITL Task Requires Input

1. A selected task is `Type: HITL`.
2. The agent pauses at the point where human input is required.
3. If the user provides the required input, execution continues.
4. If the user does not provide the input, the task remains incomplete with notes.

## User Stories

1. As a user, I want to run `/weave-execute T3`, so that the agent can implement and verify a specific local task.
2. As a user, I want `/weave-execute backend` to execute backend-scoped tasks, so that I can run a focused slice of the change.
3. As a user, I want `/weave-execute` without arguments to ask what to execute, so that the agent does not accidentally run all tasks.
4. As an agent user, I want dependencies from `Blocked by:` to be handled automatically, so that dependent tasks are not attempted before their prerequisites.
5. As an agent user, I want prepare to run before execution, so that implementation happens on the correct local branches.
6. As a human engineer, I want task statuses and verification notes updated locally, so that I can understand what the agent completed and what remains.
7. As a user, I want independent tasks to continue after an unrelated task fails, so that one failure does not waste the whole execution run.
8. As a user, I want HITL tasks to pause for input, so that the agent does not pretend human decisions are autonomous.

## Functional Requirements

- The system should provide `/weave-execute` as the v1 execution surface.
- The system should support explicit task id selectors such as `T3` and `T1 T3 T7`.
- The system should support scope selectors such as `backend`, matched against task `Scope`.
- The system should support `all` as a selector for all executable `T#` tasks.
- The system should ask for a selector when `/weave-execute` is invoked without arguments.
- The system should keep the no-argument selector prompt short and example-driven, mentioning all tasks, a scope, and specific task ids.
- The system should derive selector suggestions or examples from available task ids and scopes in `tasks.md`.
- The system should use `Blocked by:` as the source of task dependency truth.
- The system should execute incomplete blocking tasks before dependent selected tasks.
- The system should always run the existing prepare workflow for the final selected task set before implementation.
- The system should stop before implementation when prepare reports blockers.
- The system should execute tasks with statuses `todo`, `in_progress`, and `not_tested`.
- The system should execute `blocked` tasks only after their blockers are resolved in the same run.
- The system should skip `done` and `invalid` tasks by default.
- The system should mark each task `in_progress` when execution starts for that task.
- The system should mark a task `done` only when implementation is complete and verification passes.
- The system should mark a task `not_tested` when implementation appears complete but verification could not run.
- The system should leave or set a task `in_progress` with notes when implementation remains incomplete or verification fails.
- The system should update status in both the active task index and the task detail section.
- The system should check off only acceptance criteria that were actually satisfied.
- The system should append concise verification evidence under the task being executed.
- The system should continue independent later tasks when one task fails.
- The system should skip downstream tasks whose dependencies failed.
- The system should include HITL tasks in `/weave-execute all`, but pause before each HITL task for required user input.
- The system should pause for human input whenever a HITL task requires it.
- The system should not rewrite unrelated task wording or unrelated sections.
- The system should not commit, push, open PRs, create remote branches, stash, discard, or publish externally.
- The system should not create a separate execution run history artifact or status log in v1.

## Permissions and Access Control

`/weave-execute` is initiated by the local user through an agent workflow. It may edit local repo files and local Weave artifacts as part of task execution, but it must not perform remote publishing side effects in v1.

There is no separate role or admin model in v1. The local user remains responsible for reviewing code changes, approving any HITL decisions, and deciding whether to commit, push, or open a PR after execution.

## States and Lifecycle

`/weave-execute` uses the existing task status lifecycle:

- `todo` can transition to `in_progress` when execution starts.
- `in_progress` can transition to `done` when implementation is complete and verification passes.
- `in_progress` can transition to `not_tested` when implementation appears complete but verification could not run.
- `in_progress` can remain `in_progress` when implementation is incomplete or verification fails.
- `blocked` can transition into execution only after its `Blocked by:` dependencies are resolved.
- `done` and `invalid` are skipped by default.

Execution itself has run-level outcomes:

- prepared and executed successfully
- prepared but task verification failed
- prepared but verification could not run
- blocked during prepare
- skipped because task was already `done` or `invalid`
- skipped because an upstream dependency failed
- paused because HITL input is required

## Notifications and Visibility

`/weave-execute` should make execution progress visible through chat summaries and local `tasks.md` updates.

The final summary should show:

- completed tasks
- tasks left `not_tested`
- failed or still-`in_progress` tasks
- skipped tasks, including `done`, `invalid`, or dependency-blocked tasks
- prepare blockers, if any
- verification commands or checks that passed, failed, or could not run
- next steps for anything unresolved

No in-app, email, Slack, or external notifications are part of v1.

## Edge Cases

- If there is no active Weave change, `/weave-execute` should stop and tell the user to create or switch to a change first.
- If `tasks.md` is missing, `/weave-execute` should stop and direct the user to generate tasks first.
- If no tasks match the selector, `/weave-execute` should stop before prepare or implementation.
- If a selected task id is missing, `/weave-execute` should report the missing id and stop.
- If dependency metadata references a missing task, `/weave-execute` should stop or leave the dependent task blocked with a clear note.
- If dependencies form a cycle, `/weave-execute` should stop and report the cycle.
- If prepare reports blockers, `/weave-execute` should stop before implementation.
- If prepare succeeds with dirty repos already on the expected branch, `/weave-execute` may proceed.
- If a task fails verification, independent tasks may continue, but dependent downstream tasks should be skipped or blocked.
- If verification cannot run, the task may be marked `not_tested` only when implementation appears complete.
- If a HITL task needs input and the user does not provide it, the task remains incomplete.
- If `/weave-execute all` includes HITL tasks, the agent should pause before each HITL task rather than running through them unattended.
- If a task is `done` or `invalid`, it is skipped by default even when included by scope or all.
- If the agent cannot confidently update an acceptance criterion, it should leave that checkbox unchanged.

## Acceptance Criteria

- [ ] User can invoke `/weave-execute` with no arguments and choose from task ids, scopes, or `all`.
- [ ] The no-argument prompt is short and includes examples for all tasks, a scope, and specific task ids.
- [ ] User can invoke `/weave-execute T3` to execute a specific task.
- [ ] User can invoke `/weave-execute T1 T3 T7` to execute multiple specific tasks.
- [ ] User can invoke `/weave-execute <scope>` to execute matching scoped tasks.
- [ ] User can invoke `/weave-execute all` to execute all executable tasks.
- [ ] The agent resolves `Blocked by:` dependencies before dependent tasks.
- [ ] The agent runs prepare for the final selected task set before implementation.
- [ ] Prepare blockers stop execution before implementation starts.
- [ ] Eligible tasks move to `in_progress` when execution begins.
- [ ] Successfully implemented and verified tasks are marked `done`.
- [ ] Completed-but-unverified tasks are marked `not_tested`.
- [ ] Failed or incomplete tasks remain `in_progress` with concise notes.
- [ ] `done` and `invalid` tasks are skipped by default.
- [ ] Independent tasks continue after an unrelated task fails.
- [ ] Downstream tasks are skipped or blocked when their dependency fails.
- [ ] `/weave-execute all` includes HITL tasks but pauses before each HITL task for user input.
- [ ] HITL tasks pause for user input instead of being treated as fully autonomous.
- [ ] Satisfied acceptance criteria are checked off without rewriting unrelated task content.
- [ ] Task-level verification notes record passed, failed, or unavailable checks.
- [ ] No separate execution run history artifact or status log is created in v1.
- [ ] Execution does not commit, push, open PRs, stash, discard, create remote branches, or publish externally.

## Rollout Considerations

This is a local agent workflow. v1 can roll out as a bundled agent skill and slash command without changing remote service behavior.

Existing changes with `tasks.md` should work when they follow the current task shape, especially the `Status`, `Type`, `Scope`, `Primary repo`, `Repos`, `Blocked by`, acceptance criteria, and verification sections. Older or hand-written task files may require the agent to ask for clarification when metadata is missing or inconsistent.

`weave task execute` should remain absent in v1 so users do not confuse deterministic CLI behavior with agent implementation behavior.

## Analytics and Success Metrics

Success can be measured qualitatively in v1 through local workflow outcomes:

- users can move from tasks to implemented local changes with fewer manual instructions;
- task status and verification notes are more consistently updated;
- fewer agents start dependent tasks before blockers are resolved;
- fewer implementations happen on unprepared branches;
- users need fewer follow-up prompts to understand what completed and what remains.

No external analytics or telemetry is required for v1.

## Revision History

- 2026-06-07: Initial PRD generated from `exploration.md` and exploration session context.
- 2026-06-07: Closed open PRD questions for no-argument prompt style, multi-task summary format, HITL behavior in `all`, and v1 run-history scope.

## Assumptions

- `tasks.md` follows the current Weave task artifact shape produced by `weave-issues`.
- `Blocked by:` entries use valid `T#` task ids or a clear `None` value.
- `/weave-execute` can rely on the existing prepare workflow for branch readiness.
- Local task artifact updates are acceptable as part of execution.
- The local user reviews code changes before any commit, push, or PR action outside this workflow.

## Open Questions

None at this time.

## Out of Scope

- `weave task execute` CLI behavior.
- Remote branch creation.
- Commit, push, and PR workflows.
- External issue tracker publishing.
- Automated stash or dirty-work resolution.
- Per-repo task files.
- A general-purpose agent runner launched by the CLI.
- A separate execution run history artifact or `status.yml` execution log.

## Further Notes

The strongest precedent is the prepare workflow: deterministic branch readiness belongs to `weave task prepare`, while agent interpretation and user-facing summaries belong to slash-command skills. `/weave-execute` should follow that split by using prepare as a prerequisite and keeping implementation behavior in the agent skill.
