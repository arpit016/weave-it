# weave init is a safe no-op when already initialized

## Outcome

Running `weave init` in a directory whose tree already contains a valid `.weave/workspace.yml` reports that Weave is already initialized (including the detected mode) and makes no changes. No scaffold files are created or overwritten, no `git init` runs, the repo is never moved, and no machine-local session is written or replaced. The destructive workspace-mode adoption path (`initWorkspaceFromGitRepo`) becomes syntactically unreachable for any already-initialized tree.

## User flow

1. User runs `weave init` inside a cloned (or otherwise already-initialized) workspace, possibly out of habit or following stale docs.
2. Weave walks up from cwd via `findWorkspaceMode` and finds a valid `.weave/workspace.yml`.
3. Weave prints: `Weave is already initialized (mode: <repo|workspace>). Start a new change with \`weave change new "<title>"\`.`
4. Weave exits successfully (exit 0). No files change.

## In scope

- Top-of-function `findWorkspaceMode(cwd)` short-circuit in `initWorkspace` ([src/lib/init-workspace.ts](src/lib/init-work-workspace.ts)), before the `shouldReplaceSession` prompt and before `selectInitMode`.
- New `already_initialized` value on `InitStatus`.
- The "already initialized" message including the detected mode and the `weave change new "<title>"` suggestion.
- `commands/init.ts` treats `already_initialized` as success (exit 0).

## Out of scope

- Renaming `no_session` -> `not_initialized` (that lands in slice 02).
- Repo-mode `weave workspace` derive-only behavior (slice 02).
- `weave add` repo-mode lazy session creation (slice 02).
- Any change to `weave change *` or `weave doctor` (D5: no change).
- Warning on malformed `workspace.yml` (existing treat-as-absent behavior preserved).

## Acceptance criteria

- [ ] `weave init` inside a workspace-mode workspace with a valid `workspace.yml` returns `already_initialized`, exits 0, and does not move the repo.
- [ ] `weave init` inside a repo-mode workspace with a valid `workspace.yml` returns `already_initialized`, exits 0, and does not re-scaffold or write a session.
- [ ] `weave init` in a folder with no `workspace.yml` in its tree performs the normal first-time init flow unchanged.
- [ ] The `shouldReplaceSession` prompt does not fire when the workspace is already initialized.
- [ ] The "already initialized" message includes the detected mode and suggests `weave change new "<title>"`.
