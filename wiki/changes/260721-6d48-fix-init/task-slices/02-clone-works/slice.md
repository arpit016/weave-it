# Everyday commands work on a fresh clone

## Outcome

On a fresh `git clone` of an initialized Weave workspace (`.weave/workspace.yml` present, no machine-local session), everyday commands work without first running `weave init`:

- `weave workspace` shows the resolved context (workspace view in workspace mode; derived repo folder in repo mode) without writing any session file.
- `weave add` registers/materializes repos (workspace mode) or lazily creates a repo-mode session containing the target folder and proceeds.
- The `no_session` JSON status is renamed to `not_initialized` and is emitted only in the genuine uninitialized case (no `workspace.yml` anywhere up the tree).

## User flow

1. Teammate runs `git clone <workspace-repo>` and `cd` into it.
2. Teammate runs `weave workspace` and sees the workspace name and registered repos (workspace mode) or the resolved repo folder (repo mode). No session file is written.
3. Teammate runs `weave add <path|url>`; it succeeds. In repo mode, a session containing the target folder is lazily created.
4. Teammate runs `weave change current` / `weave change status`; context resolves from `workspace.yml` and the current branch.
5. At no point is the teammate told to run `weave init`.

## In scope

- Rework `addFolder` ([src/lib/add-folder.ts](src/lib/add-folder.ts)) to dispatch on `findWorkspaceMode(cwd)` first; return `not_initialized` when no `workspace.yml`; lazily create a target-only session in repo mode via a new `loadOrCreateSession` helper.
- Rename `AddFolderStatus` `no_session` -> `not_initialized` with the updated message `No Weave context found. Run \`weave init\` first.`
- Rework `buildRepoModeResult` ([src/lib/show-workspace.ts](src/lib/show-workspace.ts)) to derive the root folder from `workspacePath` when no session exists (no write, exit 0).
- Rename `ShowWorkspaceResult.status` `no_session` -> `not_initialized`.
- Update exit-code checks in [src/commands/add.ts](src/commands/add.ts) and [src/commands/workspace.ts](src/commands/workspace.ts).
- Add `loadOrCreateSession(folder, now, sessionPath)` to [src/lib/session-state.ts](src/lib/session-state.ts).
- Update tests in [tests/init.test.ts](tests/init.test.ts) and the core-command-reference behavior doc.

## Out of scope

- `weave init` already-initialized short-circuit (slice 01).
- Committing repo-mode folder membership into the repo.
- Auto-materializing (cloning/pulling) registered-but-missing sub-repos beyond the existing `weave add` materialization behavior.
- Changing branch-derived active-change resolution.
- Warning on malformed `workspace.yml`.

## Acceptance criteria

- [ ] On a fresh clone (workspace mode, no session), `weave add <path|url>` succeeds without `weave init`.
- [ ] On a fresh clone, `weave workspace` lists the workspace and registered repos with no init prompt.
- [ ] Repo-mode `weave workspace` with a valid `workspace.yml` but no session shows the derived repo context (exit 0) and writes no session file.
- [ ] Repo-mode `weave add <target>` with no session lazily creates a session containing only the target folder and succeeds.
- [ ] No everyday command emits `no_session`; the status is `not_initialized` and appears only when no `workspace.yml` exists up the tree.
- [ ] `weave change *` and `weave doctor` behavior is unchanged when `workspace.yml` is present.
