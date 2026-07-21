---
artifact: tasks
slice: 02-clone-works
status: draft
owner: engineering
created_at: 2026-07-21T17:14:00.000Z
updated_at: 2026-07-21T17:14:00.000Z
source: architecture
---

# Tasks: Everyday commands work on a fresh clone

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
| T1 | done | afk | weave-it | | Add loadOrCreateSession helper to session-state.ts | None |
| T2 | done | afk | weave-it | | Rework addFolder to dispatch on findWorkspaceMode and lazily create repo-mode session | T1 |
| T3 | done | afk | weave-it | | Rework buildRepoModeResult to derive root folder when no session | None |
| T4 | done | afk | weave-it | | Update command-wrapper exit-code checks to not_initialized | T2, T3 |
| T5 | done | afk | weave-it | | Update tests for clone-works behavior and not_initialized rename | T2, T3, T4 |
| T6 | done | afk | weave-it | | Update core-command-reference behavior doc | T2, T3 |
| T7 | done | afk | weave-it | | Verify fresh-clone workflow end to end | T1, T2, T3, T4, T5, T6 |

## weave-it

### T1: Add loadOrCreateSession helper to session-state.ts

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: None
Files:
- src/lib/session-state.ts (C)

### What to build

Add `loadOrCreateSession(folder: ResolvedFolder, now: Date, sessionPath = defaultSessionPath()): Promise<CurrentSession>`. It calls `loadCurrentSession(sessionPath)`; if undefined, calls `createCurrentSession(folder, now)` and `saveCurrentSession(result, sessionPath)` then returns the new session; otherwise returns the loaded session. Reuses existing `createCurrentSession` and `saveCurrentSession`.

### Acceptance Criteria

- [x] `loadOrCreateSession` returns a non-undefined `CurrentSession`.
- [x] When no session file exists, it creates one containing the given folder and persists it.
- [x] When a session file exists, it returns it without modification.

### Verification

- Automated tests: `npm test -- init.test.ts` (covered by T5 clone-simulation tests)

### T2: Rework addFolder to dispatch on findWorkspaceMode and lazily create repo-mode session

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: T1
Files:
- src/lib/add-folder.ts (C)

### What to build

Restructure `addFolder` in [src/lib/add-folder.ts](src/lib/add-folder.ts):
1. Rename `AddFolderStatus` `no_session` -> `not_initialized`.
2. Call `findWorkspaceMode(cwd)` first. If undefined, return `{ status: "not_initialized", message: "No Weave context found. Run \`weave init\` first." }`.
3. If workspace mode, call `addFolderToWorkspace` (unchanged).
4. If repo mode, call `loadOrCreateSession(targetFolder, now, sessionPath)` where `targetFolder` is the resolved target folder, then proceed with `addFolderToRepoSession` using the returned session. Remove the old unconditional `if (!session) return no_session` gate.

Note: the lazily-created session contains only the target folder (the workspace-root repo is not auto-added).

### Acceptance Criteria

- [x] `addFolder` returns `not_initialized` only when `findWorkspaceMode` returns undefined.
- [x] In workspace mode, `addFolder` proceeds without a session (unchanged behavior).
- [x] In repo mode with no session, `addFolder` lazily creates a session containing the target folder and succeeds.
- [x] In repo mode with an existing session, `addFolder` behavior is unchanged.

### Verification

- Automated tests: `npm test -- init.test.ts` (see T5)

Implementation note: `loadOrCreateSession` creates an EMPTY session (no folders); `addFolderToRepoSession` then adds the target folder, yielding `status: "added"` (not `already_exists`). The final session contains only the target folder, matching the PRD's "target only" decision. The helper signature is `loadOrCreateSession(now, sessionPath)` (no folder param).

### T3: Rework buildRepoModeResult to derive root folder when no session

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: None
Files:
- src/lib/show-workspace.ts (C)

### What to build

Rework `buildRepoModeResult` in [src/lib/show-workspace.ts](src/lib/show-workspace.ts):
1. Rename `ShowWorkspaceResult.status` `no_session` -> `not_initialized`.
2. Change the function signature to accept the resolved `workspacePath` (and the `findWorkspaceMode` result) so it can derive the root folder.
3. When a repo-mode workspace is found but no session exists, derive a single folder from `workspacePath`: `id` from the dir basename (slugified), `name` from the basename or `workspace.yml.name` if present, `kind: "app"`, `wiki: <workspacePath>/wiki`, `metadata: <workspacePath>/.weave`. Return `status: "ok"`, exit 0. Do NOT write a session file.
4. When a repo-mode workspace is found AND a session exists, keep today's behavior (list `session.folders`).
5. The `not_initialized` status is only returned when `showWorkspace` finds no workspace AND no session. Update `showWorkspace` to pass the `findWorkspaceMode` result into `buildRepoModeResult` so it can distinguish "repo mode, no session" from "no workspace at all".

### Acceptance Criteria

- [x] Repo-mode `weave workspace` with `workspace.yml` but no session returns `status: "ok"`, exit 0, shows the derived repo folder, and writes no session file.
- [x] Repo-mode `weave workspace` with `workspace.yml` and a session lists `session.folders` (unchanged).
- [x] `weave workspace` with no `workspace.yml` and no session returns `not_initialized`, exit 1.
- [x] `weave workspace` remains read-only in all paths.

### Verification

- Automated tests: `npm test -- init.test.ts` (see T5)

Implementation note: `showWorkspace` passes `modeResult?.workspacePath` into `buildRepoModeResult`. The derived folder uses `slugify(basename, "folder")` as the id. `titleFromSlug` is not needed since `ShowWorkspaceFolder` has no `name` field.

### T4: Update command-wrapper exit-code checks to not_initialized

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: T2, T3
Files:
- src/commands/add.ts (C)
- src/commands/workspace.ts (C)

### What to build

Update the exit-code checks:
- [src/commands/add.ts](src/commands/add.ts) line 20: `if (result.status === "not_initialized") process.exitCode = 1;`
- [src/commands/workspace.ts](src/commands/workspace.ts) line 17: `exitCode: result.status === "not_initialized" ? 1 : 0`

### Acceptance Criteria

- [x] `weave add` and `weave workspace` exit 1 only on `not_initialized`; exit 0 on `ok`/`added`/`already_exists`.

### Verification

- Automated tests: `npm test -- init.test.ts` (see T5)

### T5: Update tests for clone-works behavior and not_initialized rename

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: T2, T3, T4
Files:
- tests/init.test.ts (C)

### What to build

Update [tests/init.test.ts](tests/init.test.ts):
- Rename existing `no_session` assertions (lines 268 and 432) to `not_initialized`.
- The "requires init before adding folders" test (line 260) now asserts `not_initialized` when no `workspace.yml` exists (the genuine uninitialized case).
- The "returns no_session in repo mode when no session exists" test (line 425) splits into two: (a) repo mode with `workspace.yml` but no session -> `status: "ok"`, derived root folder shown; (b) no `workspace.yml` and no session -> `not_initialized`.
- Add: workspace-mode clone simulation — init a workspace, then run `weave add` and `weave workspace` with an isolated/empty `sessionPath`; assert both succeed and `weave workspace` lists the registered repo.
- Add: repo-mode clone simulation — init a repo, then run `weave add <target>` and `weave workspace` with an isolated `sessionPath`; assert `weave add` lazily creates a session containing the target and `weave workspace` (no-session variant) shows the derived root.

### Acceptance Criteria

- [ ] All renamed and new tests pass.
- [ ] No `no_session` string remains in the test file.

### Verification

- Automated tests: `npm test -- init.test.ts`

### T6: Update core-command-reference behavior doc

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: T2, T3
Files:
- wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md (C)

### What to build

Update [wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md](wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md):
- The dispatch table row for repo-mode `weave workspace` with no session (line 281): change from `status: no_session, exit 1` to `status: ok, exit 0, derived root folder shown (no session write)`.
- The repo-mode "Next: weave init" hint in the repo-mode text output example: update to reflect that `weave init` is no longer required on a clone.
- Add a note that `weave add` in repo mode with no session lazily creates a session containing the target folder.
- Rename the `no_session` status references to `not_initialized`.
- Add a changelog entry at the bottom of the Change History section.

### Acceptance Criteria

- [x] Dispatch table reflects the new repo-mode no-session behavior.
- [x] No `no_session` string remains in the doc (except the changelog entry documenting the rename).
- [x] Change History has a dated entry for this change.

### Verification

- Manual/smoke check: grep the doc for `no_session` and confirm zero matches (except the changelog entry); grep for `not_initialized` and confirm the new behavior is described.

### T7: Verify fresh-clone workflow end to end

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: T1, T2, T3, T4, T5, T6
Files:
- tests/init.test.ts (C)

### What to build

Add a single end-to-end test that simulates the full fresh-clone workflow:
1. Init a workspace-mode workspace, commit its `.weave/workspace.yml`.
2. Simulate a clone by copying the workspace to a new temp dir and using an isolated empty `sessionPath`.
3. Run `weave workspace` (assert workspace view, no error), `weave add <local-path>` (assert success), `weave change current` (assert it resolves or reports no active change cleanly, no init error).
4. Assert no `weave init` was run and no `no_session`/`not_initialized` error was emitted on the everyday commands.

### Acceptance Criteria

- [x] The end-to-end clone workflow test passes.
- [x] No everyday command in the workflow emits `not_initialized` when `workspace.yml` is present.

### Verification

- Automated tests: `npm test -- init.test.ts` -> 32 passed (includes the new "end-to-end fresh-clone workflow works without weave init" test).
- Manual/smoke check: from a real cloned workspace with no session file, run `weave workspace` and `weave add` and confirm they succeed.

Implementation note: the test uses an isolated `cloneSessionPath` to simulate a fresh clone (no `current-session.yml`). It asserts `weave workspace` returns `ok` with the workspace view, `weave change current` returns `ok` and resolves the workspace path from `workspace.yml` (not a `no_weave_context` error), and no session file is written by the read-only commands. The git add/commit step was dropped because workspace-mode init already creates the initial commit.

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

Slice 02 complete. `npm test -- init.test.ts` -> 32 passed. `npm test` (full suite) -> 211 passed. `npm run typecheck` -> clean. `npm run build` -> success.
