# Task Slices

## Purpose

Task slices segment a change into vertical behavior folders so multiple engineers can work in parallel with less `tasks.md` git conflict thrash.

## Folder Model

```text
wiki/changes/<change-id>/task-slices/
  dependency-graph.md          # rollup-derived when slice count >= 2
  <NN>-<slug>/
    slice.md                   # human narrative
    contracts.md               # slice-level technical contracts
    tasks.md                   # horizontal tasks per repo
    status.yml                 # machine-readable slice state
```

## Vocabulary

- **Slice:** vertical tracer-bullet behavior (`01-admin-creates-workflow`).
- **Task:** horizontal work inside a slice (`T1`, `T2`, …).
- **Stored slice status:** `pending`, `in_progress`, `done` in `status.yml` (rollup-derived).
- **Derived slice state:** `ready`, `blocked` in `dependency-graph.md` only.
- **Task status:** `todo`, `in_progress`, `done`, `not_tested`, `blocked`, `invalid`.

## Cross-Slice Coordination

- Within-slice ordering: `Blocked by:` on tasks.
- Cross-slice ordering: `status.yml.depends_on` only (no cross-slice task deps in v1).

## Execution Semantics

- `Execution: afk` — `weave-execute` runs verification without pausing.
- `Execution: hitl` — pauses at acceptance and verification checkpoints.

## Bug-Fix Workflow

1. `/weave-fix` creates `--type fix` change, `findings.md`, and `task-slices/01-<slug>/`.
2. Scope growth: update `findings.md`, re-run `/weave-slices` (idempotent additive expansion).

## Rollup Library

Writer-derives model: `src/lib/sliceRollup.ts` + `weave slice rollup` CLI. No editor PostToolUse hooks.

Triggers: end of `weave-execute` episode, HITL pause, error exit, after `weave-slices` / `weave-fix` scaffolding, manual CLI.

## Dual-Mode Compatibility

- `task-slices/` present → slice mode (`/weave-execute 01 T1`, `/weave-next afk`).
- Only change-root `tasks.md` → flat legacy mode (`/weave-execute T1`, `/weave-execute all`).

Legacy flat changes continue working without migration.

## Lifecycle Lanes

- `findings` — fix-type upstream artifact (`findings.md`).
- `slices` — replaces legacy `issues` lane for slice scaffolding.
