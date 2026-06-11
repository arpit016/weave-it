---
artifact: tasks
slice: 01-task-prepare-root-tasks-md
status: draft
owner: engineering
created_at: 2026-06-11T02:59:15Z
updated_at: 2026-06-11T03:21:06Z
source: findings
---

# Tasks: Task prepare checks branch readiness

## Status Legend

- `todo`: ready when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without listed blocker
- `done`: implemented and verified
- `not_tested`: implementation complete, automated verification incomplete
- `invalid`: no longer applies

## Active Task Index

| ID | Status | Execution | Repos | Owner | Title | Blocked by |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | done | hitl | weave-it |  | Simplify task prepare to branch readiness | None |

## weave-it

### T1: Simplify task prepare to branch readiness

Status: done
Owner:
Repos: weave-it
Execution: hitl
Blocked by: None
Files:
- `src/commands/task.ts` (M)
- `src/lib/task-prepare.ts` (M)
- `templates/skills/weave-execute/SKILL.md` (M)
- `templates/skills/weave-prepare/SKILL.md` (M)
- `.claude/skills/weave-execute/SKILL.md` (M)
- `.claude/skills/weave-prepare/SKILL.md` (M)
- `.agents/skills/weave-execute/SKILL.md` (M)
- `.agents/skills/weave-prepare/SKILL.md` (M)
- `wiki/knowledge/domains/change-workflow/features/weave-prepare/behavior.md` (M)
- `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md` (M)
- `tests/` (M)

### What to build

Simplify `weave task prepare` so it only checks and prepares branch readiness for the active change.

In repo mode, prepare the artifact root repo. In workspace mode, prepare every registered workspace repo. Remove prepare's dependency on `tasks.md`, `task-slices/`, task IDs, scopes, and task metadata. `weave-execute` remains responsible for resolving which slice or task to implement, and should invoke bare `weave task prepare --json` once before implementation.

### Acceptance Criteria

- [x] `weave task prepare --json` works without a root-level `tasks.md`.
- [x] `weave task prepare --json` works without any `task-slices/` folder.
- [x] The prepare CLI no longer requires task IDs, `--scope`, or `--all`.
- [x] Repo mode records readiness for the artifact root repo.
- [x] Workspace mode preflights and records readiness for every registered workspace repo.
- [x] Prepare blockers remain branch/readiness blockers only, such as detached HEAD, branch mismatch, missing registered repo paths, or dirty work on a different branch.
- [x] `weave-execute` documentation and installed skill copies call bare `weave task prepare --json` before implementation.
- [x] Regression coverage proves prepare is independent of task artifact shape.

### Verification

- Automated tests: `npm test -- task-prepare` passed.
- Packaging tests: `npm test -- agent-skills` passed.
- Typecheck: `npm run typecheck` passed.
- Manual/smoke check: not run against the live active change because `weave task prepare --json` writes `status.yml.execution`; isolated tests cover no-`tasks.md` and workspace/repo readiness behavior.

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

- `npm test -- task-prepare` passed.
- `npm test -- agent-skills` passed.
- `npm run typecheck` passed.
