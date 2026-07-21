# Contracts: weave init is a safe no-op when already initialized

Slice-level technical contracts for this vertical slice.

## Interfaces

- `initWorkspace(options)` in [src/lib/init-workspace.ts](src/lib/init-workspace.ts) gains a new return status:
  - `InitStatus` extends to `"initialized" | "cancelled" | "already_initialized"`.
  - On already-initialized detection, returns `{ status: "already_initialized", message: <msg>, folderPath: <workspacePath>, wikiDir: "", metadataDir: "", sessionPath }` (empty `wikiDir`/`metadataDir` because no scaffold runs).
- `weave init` CLI ([src/commands/init.ts](src/commands/init.ts)) maps `already_initialized` to exit code 0 (success), printing `result.message`.

## Data

- No file is written, deleted, or moved when `already_initialized` is returned.
- No session file is created or replaced.
- `findWorkspaceMode(cwd)` is the sole signal for "already initialized"; its existing walk-up and malformed-yml-as-absent behavior are reused unchanged.

## State

- Initialization state, as perceived by `weave init`, resolves to:
  - `already_initialized`: a valid `.weave/workspace.yml` exists up the tree. No-op, exit 0.
  - `initialized`: no `workspace.yml` up the tree; normal first-time init runs. Unchanged.
  - `cancelled`: user cancelled a prompt during genuine first-time init. Unchanged.
- The `shouldReplaceSession` prompt is skipped entirely in the `already_initialized` path because the short-circuit returns before it.

## Validation and errors

- A malformed or unreadable `workspace.yml` is treated as absent (existing `findWorkspaceMode` behavior), so `weave init` falls through to normal first-time init. No new error path is introduced.
- `weave init --yes` in an already-initialized workspace also short-circuits to `already_initialized` (exit 0) without prompting.

## Files and artifacts

- Modified: `src/lib/init-workspace.ts`, `src/commands/init.ts`.
- No new files. No template files. No config keys.
