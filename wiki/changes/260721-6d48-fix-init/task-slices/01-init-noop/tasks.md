---
artifact: tasks
slice: 01-init-noop
status: draft
owner: engineering
created_at: 2026-07-21T17:14:00.000Z
updated_at: 2026-07-21T17:14:00.000Z
source: architecture
---

# Tasks: weave init is a safe no-op when already initialized

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
| T1 | done | afk | weave-it | | Add already_initialized short-circuit to initWorkspace | None |
| T2 | done | afk | weave-it | | Map already_initialized to exit 0 in commands/init.ts | T1 |
| T3 | done | afk | weave-it | | Verify weave init is idempotent on already-initialized workspaces | T1, T2 |

## weave-it

### T1: Add already_initialized short-circuit to initWorkspace

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: None
Files:
- src/lib/init-workspace.ts (C)

### What to build

Add `"already_initialized"` to the `InitStatus` union. At the very top of `initWorkspace()` (before `loadCurrentSession`/`shouldReplaceSession` and before `selectInitMode`), call `findWorkspaceMode(options.cwd ?? process.cwd())`. If it returns a valid workspace, return an `InitWorkspaceResult` with `status: "already_initialized"`, `folderPath: workspace.workspacePath`, `message` set to: `Weave is already initialized (mode: <mode>). Start a new change with \`weave change new "<title>"\`.` (substituting `<mode>` with `workspace.mode` and `<title>` as a placeholder hint). Do not call `ensureWeaveScaffold`, `writeRepoWorkspaceMetadata`, `createCurrentSession`, `saveCurrentSession`, or any git operations in this path. Import `findWorkspaceMode` from `./workspace-mode.js`.

### Acceptance Criteria

- [x] `InitStatus` includes `"already_initialized"`.
- [x] `initWorkspace` returns `already_initialized` when `findWorkspaceMode(cwd)` finds a valid workspace, before any prompt or write.
- [x] No file write, `git init`, repo move, or session write/replace occurs in the `already_initialized` path.
- [x] The returned message includes the detected mode and the `weave change new "<title>"` suggestion.

### Verification

- Automated tests: `npm test -- init.test.ts` (see T3)
- Manual/smoke check: from a repo with `.weave/workspace.yml`, run `weave init` and confirm no files change and exit code is 0.

### T2: Map already_initialized to exit 0 in commands/init.ts

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: T1
Files:
- src/commands/init.ts (C)

### What to build

In `initCommand`'s action handler, ensure `already_initialized` is treated as success: print `result.message` and do not set `process.exitCode`. Only `cancelled` should set `process.exitCode = 1` (existing behavior). Confirm `initialized` and `already_initialized` both exit 0.

### Acceptance Criteria

- [x] `weave init` in an already-initialized workspace exits 0.
- [x] `weave init` in a genuinely uninitialized workspace still exits 0 on success and 1 on cancel, unchanged.

### Verification

- Automated tests: `npm test -- init.test.ts` (see T3)
- Manual/smoke check: run `weave init` in an initialized repo and check `echo $?` is 0.

Note: `src/commands/init.ts` already only sets `process.exitCode = 1` when `result.status === "cancelled"`, so `already_initialized` is already treated as success (exit 0) with no code change required.

### T3: Verify weave init is idempotent on already-initialized workspaces

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: T1, T2
Files:
- tests/init.test.ts (C)

### What to build

Add tests in [tests/init.test.ts](tests/init.test.ts):
- `weave init` in a workspace-mode workspace with a committed `.weave/workspace.yml` returns `already_initialized`, exits 0, and does not move the repo (assert the repo dir is unchanged and no new files appear).
- `weave init` in a repo-mode workspace with `.weave/workspace.yml` returns `already_initialized`, exits 0, and does not re-scaffold or write a session (assert no session file at the isolated `sessionPath`).
- `weave init` in a folder with no `workspace.yml` performs normal first-time init (regression guard for the unchanged path).
- `weave init --yes` in an already-initialized workspace also returns `already_initialized` without prompting.

### Acceptance Criteria

- [x] All new tests pass.
- [x] Existing first-time init tests still pass (no regression).

### Verification

- Automated tests: `npm test -- init.test.ts` -> 27 passed (3 new tests + updated existing "does not overwrite" test + 23 unchanged tests).
- Typecheck: `npm run typecheck` -> clean.
- Manual/smoke check: none beyond automated tests.

Note: the pre-existing "does not overwrite existing wiki and metadata files when init runs again" test was updated to assert `already_initialized` (it sets up a `.weave/workspace.yml`, so under the new short-circuit init is a no-op; the test's intent — files are not overwritten — is still satisfied).

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

Slice 01 complete. `npm test -- init.test.ts` -> 27 passed. `npm run typecheck` -> clean.
