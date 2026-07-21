# Contracts: Everyday commands work on a fresh clone

Slice-level technical contracts for this vertical slice.

## Interfaces

- `addFolder(options)` in [src/lib/add-folder.ts](src/lib/add-folder.ts):
  - `AddFolderStatus` becomes `"added" | "already_exists" | "not_initialized"`.
  - Dispatch order: `findWorkspaceMode(cwd)` first. Undefined -> return `not_initialized`. Workspace mode -> `addFolderToWorkspace` (unchanged). Repo mode -> load-or-create session, then `addFolderToRepoSession`.
  - The `not_initialized` message is `No Weave context found. Run \`weave init\` first.`
- `showWorkspace(options)` in [src/lib/show-workspace.ts](src/lib/show-workspace.ts):
  - `ShowWorkspaceResult.status` becomes `"ok" | "not_initialized"`.
  - In repo mode with no session, derive a single folder from `workspacePath` (id/name from the dir basename or `workspace.yml.name`, `kind: "app"`), return `status: "ok"`, exit 0. No session write.
  - The `not_initialized` message is `No Weave context found. Run \`weave init\` first.`
- `loadOrCreateSession(folder, now, sessionPath)` in [src/lib/session-state.ts](src/lib/session-state.ts): if `loadCurrentSession` returns undefined, `createCurrentSession(folder, now)` + `saveCurrentSession`; otherwise return the loaded session. Always returns a non-undefined `CurrentSession`.
- Command wrappers [src/commands/add.ts](src/commands/add.ts) and [src/commands/workspace.ts](src/commands/workspace.ts): exit-code check becomes `result.status === "not_initialized" ? 1 : 0`.

## Data

- `.weave/workspace.yml` (committed) is the sole source of truth for initialization, mode, workspace name, and registered repos.
- `~/.cache/weave/current-session.yml` (machine-local) becomes an optional cache, lazily created only by write commands (`weave add` in repo mode). `weave workspace` never writes it.
- The lazily-created repo-mode session contains ONLY the target folder. The workspace-root repo is not auto-added.

## State

- Command context resolution:
  - `findWorkspaceMode(cwd)` returns a valid workspace -> initialized; proceed using committed metadata + cwd/branch, regardless of session presence.
  - `findWorkspaceMode(cwd)` returns undefined -> genuine uninitialized; return `not_initialized` (exit 1).
- `weave workspace` remains read-only: no file writes in any path.
- `weave add` in repo mode with no session writes a session file containing the target folder (consistent with `weave add` being a write command).

## Validation and errors

- Malformed `workspace.yml` is treated as absent (existing `findWorkspaceMode` behavior), so commands fall through to `not_initialized`. No new error path.
- `weave add` with a target path that does not resolve to a directory continues to throw `Expected a directory: <path>` (unchanged).
- `weave add` workspace-mode refusal when an unregistered destination already exists is unchanged.

## Files and artifacts

- Modified: `src/lib/add-folder.ts`, `src/lib/show-workspace.ts`, `src/lib/session-state.ts`, `src/commands/add.ts`, `src/commands/workspace.ts`, `tests/init.test.ts`.
- Documentation: `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md` (dispatch table rows for repo-mode `weave workspace` with no session, and the repo-mode "Next: weave init" hint).
- No new files. No schema migrations. No config keys.
