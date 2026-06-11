---
artifact: findings
status: draft
owner: engineering
created_at: 2026-06-11T02:59:15Z
updated_at: 2026-06-11T03:12:12Z
source: discussion
---

# Findings: weave task prepare is task-coupled

## Summary

`weave task prepare` is failing because it is coupled to task selection and task parsing. The command currently expects task IDs, scopes, or `--all`, then looks for a root-level `tasks.md` to derive repos. That conflicts with the newer execution model: task and slice selection belongs to `weave-execute`, while branch readiness should be a simple prerequisite for the active change.

The desired behavior is simpler: `weave task prepare` should check and prepare branch readiness for the active repo or for every registered repo in the active workspace. It should not inspect `tasks.md`, `task-slices/`, task IDs, scopes, dependency metadata, or slice task heading formats.

## Repro

In a slice-based change with no root-level `tasks.md`:

1. Scaffold one or more task slices.
2. Invoke `/weave-execute` for a selected slice/task or run `weave task prepare`.
3. Observe prepare fail before branch readiness because it tries to resolve tasks from root `tasks.md`.

## Scope & Impact

Affected surfaces:

- `weave task prepare`
- `/weave-execute`, because it runs prepare before implementation
- any local workflow that expects task branch readiness before editing implementation repos

Impact: slice-first changes can be blocked by an unrelated task artifact lookup. The current command boundary also forces prepare to learn slice execution semantics that should remain owned by `weave-execute`.

## Root cause

The prepare command has the wrong responsibility boundary. `src/commands/task.ts` requires exactly one task selector mode, and `src/lib/task-prepare.ts` calls `loadTasksForChange(context.change.changePath)` before branch readiness. That makes branch preparation depend on task artifact shape.

The architecture decision from discussion is to invert that dependency:

- `weave task prepare` owns branch readiness for the active repo/workspace.
- `weave-execute` owns slice selection, task selection, dependency expansion, implementation, verification, and task evidence updates.
- `weave-execute` should call bare `weave task prepare --json` once before implementing the final selected execution set.

## Related

- `src/commands/task.ts`
- `src/lib/task-prepare.ts`
- `templates/skills/weave-execute/SKILL.md`
- `.claude/skills/weave-execute/SKILL.md`
