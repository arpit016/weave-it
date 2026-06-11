# Contracts: Branch-Derived Active Change

Slice-level technical contracts for the branch-derived active-change resolver.

## Interfaces

- `weave change current --json` keeps the existing top-level result shape and adds a per-target resolution state.
- `weave change status --json` keeps the existing top-level result shape and adds the same per-target resolution state.
- Commands that require an active change continue to throw `ChangeCommandError("no_current_change", ...)` when no branch-derived change exists.
- `weave change new` throws `ChangeCommandError("not_git_repo", ...)` or equivalent when the resolved root has no git root.

## Data

- `status.yml` remains the durable source for stage, artifacts, stale lanes, stale history, and branch metadata.
- Existing local session files may still contain `current_change`; this slice must not migrate, clean, or warn about those fields.
- `SessionFolder.current_change` can remain in the TypeScript type for parse tolerance, but active routing must not read it.

## State

- Resolution states:
  - `branch_active`: branch is `change/<id>` and matching `status.yml` is valid.
  - `no_active_change`: branch is absent, detached, or not `change/<id>`.
  - `invalid_active_branch`: branch is `change/<id>` but the change folder/status is missing or mismatched.
  - `non_git_no_active_change`: resolved root has no git repository.
- `weave change switch <change>` activates a change by checking out or creating `change/<id>` only.
- `weave change new` creates a change only after git availability is confirmed.

## Validation and errors

- Validate branch shape before reading a change folder.
- Validate `wiki/changes/<id>/status.yml` exists before returning active change.
- Validate `status.yml.branch` matches the current branch before returning `branch_active`.
- Do not fall back to session state after any validation failure.

## Files and artifacts

- Primary implementation: `src/lib/changes.ts`.
- Supporting alignment: `src/lib/doctor.ts`, `src/commands/slice.ts`, `src/lib/task-prepare.ts` only as needed by compile/test fallout.
- Tests: `tests/changes.test.ts`, `tests/cli-change-progress.test.ts`, `tests/cli-change-staleness.test.ts`.

## Observability

- Human output should no longer say `Source: session` for branch-derived current state.
- JSON output should include a stable resolution field so agents can distinguish missing branch, invalid branch, and non-git states.
