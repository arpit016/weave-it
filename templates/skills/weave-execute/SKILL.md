---
name: weave-execute
description: Execute selected local Weave tasks for an active change by preparing branches, implementing tasks, running verification, and updating tasks.md evidence without committing, pushing, or opening PRs.
last_changed_in: 0.1.0
---

# Weave Execute

Use this skill when the user wants an agent to execute selected `T#` tasks in an active Weave change.

Execution means: resolve the active change, read `tasks.md`, resolve the user's selector, expand dependencies from `Blocked by:`, run prepare for the final task set, implement each eligible task, run appropriate verification, update local task evidence, and summarize outcomes.

Execution is local-only. It must not commit, push, open pull requests, create remote branches, stash, discard changes, force-checkout, publish external issue updates, or create a separate execution run-history artifact.

# Surface Weave Notices

Every Weave skill discovery phase calls at least one Tier 1 command
(`weave workspace`, `weave change current`, `weave change status`,
`weave change new`, or `weave status`). Tier 1 commands return a stable
`notices` array in their `--json` output describing outdated packages,
modified skills, and skills that need updating.

When you run any Tier 1 command (with or without `--json`) and the result
contains a non-empty `notices` array, surface them to the user verbatim
near the start of your response. Do not edit notice text. Do not suppress
notices unless the user explicitly asks. Do not invent notices.

If notices recommend `weave status`, suggest the user run it. If notices
recommend `weave agent update`, suggest that. Do not run `npm i -g` or
any package manager command yourself; let the user run it.

If `WEAVE_NO_NOTICES=1` is set in the environment, the notices array will
be empty by design and you should not warn about it.

# Resolve Context

Start with Tier 1 context commands:

```bash
weave workspace --json
weave change current --json
weave change status --json
```

If there is no active change, stop and say that the user needs `weave change new` or `weave change switch` first.

Read the active change's task artifact:

```text
wiki/changes/<change-id>/tasks.md
```

If `tasks.md` is missing, stop and tell the user to run `weave-issues` first.

# Selector Handling

Resolve the user's selector before preparing or implementing anything.

Supported invocation shapes:

```text
/weave-execute
/weave-execute T3
/weave-execute T1 T3 T7
/weave-execute backend
/weave-execute all
```

Map user input as follows:

- `all` -> all executable `T#` tasks in the active `tasks.md`
- Task ids such as `T1` or `T1 T3` -> those explicit task ids
- A single non-task, non-`all` value such as `backend` -> tasks whose `Scope` matches that value

If invoked without arguments, ask:

```text
What should I execute: all tasks, a scope like backend, or specific task ids like T1 T3?
```

When asking, derive available examples from `tasks.md`: include `all`, available `Scope` values, and available `T#` task ids. Do not default to `all`.

If no tasks match the selector, or an explicit task id is missing, stop before prepare or implementation.

# Task Eligibility

Only execute `T#` tasks. Do not execute `QF#` findings or `R#` refactor records directly.

Executable statuses:

- `todo`
- `in_progress`
- `not_tested`

Conditionally executable:

- `blocked` only after all listed `Blocked by:` dependencies are resolved in the same run or are already `done`

Skip by default:

- `done`
- `invalid`

# Dependency Ordering

Use `Blocked by:` as the source of dependency truth.

For explicit task id selectors, if a selected task depends on incomplete tasks outside the explicit selection, tell the user which blockers must be executed first and ask before expanding the run.

For scope and `all` selectors, automatically include required incomplete blocking tasks and execute them before dependent selected tasks.

Stop before prepare or implementation when:

- a dependency references a missing task id
- a dependency value is unclear and cannot be interpreted as `None` or `T#` ids
- dependencies form a cycle

If a task fails, continue independent later tasks. Skip downstream tasks whose dependencies failed, and summarize those skips at the end.

# Run Prepare Before Implementation

Run exactly one prepare command for the final selected task set before implementing anything.

Use the deterministic prepare CLI. The CLI owns branch readiness and `status.yml.execution` writes. Do not hand-edit `status.yml` and do not run git checkout commands yourself for this workflow.

Map the final selected tasks to prepare like this:

- all executable tasks selected from `all` -> `weave task prepare --all --json`
- explicit task ids -> `weave task prepare T1 T3 --json`
- scope selectors -> `weave task prepare --scope backend --json`
- dependency-expanded selections that no longer map cleanly to one scope -> `weave task prepare T1 T3 --json`

If the global `weave` command is unavailable in this repo, use the local development form:

```bash
npm run dev -- task prepare <selector> --json
```

If prepare reports blockers, stop before implementation. State that no selected implementation repo branches were moved when the prepare result is blocked.

Dirty work already on the expected branch is allowed when prepare succeeds. Dirty work on another branch must be resolved by the user; do not stash, discard, or force-checkout it.

# Execute Tasks

Execute tasks in dependency order.

Before starting each task:

1. Patch only that task's active index row and detail `Status:` to `in_progress`.
2. Do not rewrite unrelated task wording or unrelated task sections.
3. For HITL tasks, pause for the required human input before proceeding. `/weave-execute all` includes HITL tasks, but still pauses before each HITL task.

During implementation:

- Use the task's `### What to build`, acceptance criteria, verification guidance, architecture refs, and repo anchors as the implementation contract.
- Keep edits scoped to the task.
- If the task exposes missing or ambiguous instructions, ask before guessing.

# Verification

Run task-listed checks first. Then run the smallest relevant broader checks when the task's blast radius warrants it.

Examples:

- a skill packaging change should usually run the relevant `tests/agent-skills.test.ts` tests
- a CLI or library behavior change should usually run targeted tests plus typecheck when practical
- final cross-cutting verification may run `npm run typecheck`, `npm test`, and `npm run build`

If verification cannot run, explain why. Mark a task `not_tested` only when implementation appears complete but verification could not be completed.

# Task Artifact Updates

Update `tasks.md` directly and narrowly.

Allowed updates for affected tasks:

- active task index status
- detail section `Status:`
- acceptance criteria checkboxes that were actually satisfied
- concise verification notes under the affected task's `### Verification` section

Status rules:

- set `in_progress` when work begins for a task
- set `done` only when implementation is complete and verification passes
- set `not_tested` when implementation appears complete but verification could not run
- leave or set `in_progress` with notes when implementation is incomplete or verification fails
- skip `done` and `invalid` tasks by default

Do not rewrite unrelated task wording, unrelated task sections, `QF#` entries, `R#` entries, invalid task history, or global task sections unless the selected task's own evidence requires a narrow local note.

# Final Summary

Finish with a grouped outcome summary:

- completed tasks
- tasks left `not_tested`
- failed or still-`in_progress` tasks
- skipped tasks, including `done`, `invalid`, or dependency-blocked tasks
- prepare blockers, if any
- verification commands or checks that passed, failed, or could not run
- next steps for anything unresolved

Always state that `/weave-execute` did not commit, push, open a PR, create remote branches, stash, discard changes, or publish external issue updates.
