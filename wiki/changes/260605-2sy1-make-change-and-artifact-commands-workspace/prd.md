---
artifact: prd
status: draft
owner: product
created_at: 2026-06-04T18:53:00.000Z
updated_at: 2026-06-04T18:53:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: sessions
---

# Make Change And Artifact Commands Workspace Aware PRD

## Problem Statement

Weave now has first-class workspace registration via `weave add` and workspace inspection via `weave workspace`, but the change and artifact commands still behave as if the active context is always the exact current directory or a folder listed in the local session.

This creates a confusing split for users working inside a workspace sub-repo. A user can run `weave workspace` from `peoplebox-platform/billing/` and see the parent workspace, but `weave change current`, `weave change status`, `weave change list`, `weave change progress`, and `weave artifact current` still resolve against `billing/` itself. Because workspace sub-repos are not supposed to have their own `wiki/changes/`, these commands report no change, fail to progress the active change, or can accidentally scaffold a second Weave context inside the sub-repo when older `--target` flows are used.

The product needs one coherent model: in workspace mode, the workspace owns the Weave change and artifact store; registered sub-repos are implementation locations inside that workspace, not separate artifact stores.

## Goals

- Make all `weave change` and `weave artifact` commands resolve their context by walking up from `cwd` to the nearest Weave mode file.
- In workspace mode, make the workspace root the single target for change and artifact state, even when the command is run from inside a registered sub-repo.
- In repo mode, make commands run from a nested subdirectory resolve to the repo's Weave root instead of treating the subdirectory as a standalone change root.
- Remove obsolete multi-target behavior from change and artifact commands by deleting `--target` options.
- Remove `weave change propagate` entirely.
- Preserve the existing single-context change lifecycle: `wiki/changes/<change-id>/`, `status.yml`, artifact lanes, current change state, and current artifact state.
- Avoid introducing a new `status.yml` scope or target schema in this change.

## Non-Goals

- Adding per-sub-repo `wiki/changes/` support in workspace mode.
- Adding a `status.yml.scope`, `targets`, or touched-repos field.
- Keeping `--target` as a compatibility shim or reinterpreting it as a workspace sub-repo selector.
- Keeping `weave change propagate` for repo mode only.
- Updating every skill to deeply understand workspace sub-repo intent.
- Adding `weave remove`, `weave workspace clone-missing`, or sub-repo presence indicators.
- Migrating or warning on existing sub-repos that already have their own `wiki/changes/`.

## Actors

- **Developer using a workspace**: runs Weave commands from the workspace root or from inside registered sub-repos.
- **Developer using repo mode**: runs Weave commands from any nested folder inside a single repo.
- **Agent or automation**: relies on `weave change current --json`, `weave change status --json`, and `weave artifact current --json` to find the active artifact context.
- **Maintainer of Weave skills**: expects skills to call a stable command surface that no longer has obsolete multi-target semantics.

## Current Behavior

### Workspace mode

`weave add` and `weave workspace` already dispatch on `cwd` by walking up to `.weave/workspace.yml`. A workspace can register sub-repos in `.weave/workspace.yml.repos`, and `weave workspace` reads that committed truth directly.

The change and artifact commands do not share that dispatch model. They resolve targets from `session.folders` and `realpath(cwd)`:

- From the workspace root, commands usually work because the workspace root is in `session.folders`.
- From a sub-repo such as `peoplebox-platform/billing/`, commands resolve to `billing/` and then look for `billing/wiki/changes/`.
- Because workspace sub-repos are not session folders and normally have no `wiki/changes/`, `current`, `status`, and `list` report no active change or no changes.
- `progress`, `clear-stale`, `knowledge`, and artifact set flows fail because no current change is found.
- Older `--target ./billing` flows can create `billing/wiki/changes/` and add the sub-repo to `session.folders`, violating the workspace-only artifact model.

### Repo mode

Repo mode works when commands run from the repo root. From nested subdirectories, commands can incorrectly use that subdirectory as the target root instead of walking up to the repo's `.weave/workspace.yml` with `mode: repo`.

### Multi-target behavior

The command surface currently exposes multi-target concepts:

- `weave change new --target <target...>`
- `weave change list [target|all]`
- `weave change current [target|all]`
- `weave change status --target <target>`
- `weave change progress --target <target>`
- `weave change clear-stale --target <target>`
- `weave change knowledge --target <target>`
- `weave artifact current --target <target>`
- `weave change propagate <change-id> --to <target...>`

These flows predate the workspace committed-registry model and no longer match the desired workspace-only change store.

## Proposed Product Behavior

All `weave change` and `weave artifact` commands become cwd-dispatched, single-context commands.

Mode resolution:

- The command walks up from `cwd` looking for `.weave/workspace.yml`.
- If it finds `mode: workspace`, the command's target root is the workspace root.
- If it finds `mode: repo`, the command's target root is the repo root.
- If no valid Weave mode file is found, the command fails with a clear "No Weave context found. Run `weave init` first." style error.

Workspace mode behavior:

- `workspace/wiki/changes/` is the only durable change store.
- Running a command from inside `workspace/billing/` behaves the same as running it from `workspace/`.
- `weave change new` creates one change in `workspace/wiki/changes/<change-id>/`.
- `weave change current`, `status`, `list`, `switch`, `progress`, `clear-stale`, and `knowledge` all operate on the workspace change state.
- `weave artifact current`, `current set`, and `current clear` all operate on the workspace artifact context.
- No command in this change creates `wiki/` or `.weave/` inside a registered sub-repo.

Repo mode behavior:

- Running from a nested directory inside a repo-mode Weave project resolves to the repo root.
- Single-repo change behavior remains otherwise unchanged.

Removed behavior:

- `--target` is removed from change and artifact commands.
- `all` target behavior is removed.
- `weave change propagate` is removed.
- The `weave-propagate` skill is removed from shipped and installed skill sets.

## User Workflows

### Workflow: Developer checks current change from a workspace sub-repo

1. Developer is inside `peoplebox-platform/billing/`.
2. Developer runs `weave change current`.
3. Weave walks up to `peoplebox-platform/.weave/workspace.yml`.
4. Weave sees `mode: workspace`.
5. Weave reads current change state for `peoplebox-platform/`.
6. Weave reports the workspace's active change and artifact path.

### Workflow: Developer progresses PRD from a workspace sub-repo

1. Developer is inside `peoplebox-platform/billing/`.
2. Developer edits `peoplebox-platform/wiki/changes/<change-id>/prd.md`.
3. Developer runs `weave change progress prd --source sessions`.
4. Weave resolves the context to `peoplebox-platform/`.
5. Weave updates `peoplebox-platform/wiki/changes/<change-id>/status.yml`.
6. No files are created under `billing/wiki/`.

### Workflow: Developer creates a change from a repo-mode subdirectory

1. Developer is inside `single-app/src/routes/`.
2. `single-app/.weave/workspace.yml` has `mode: repo`.
3. Developer runs `weave change new "Fix route loading"`.
4. Weave walks up to `single-app/`.
5. Weave creates `single-app/wiki/changes/<change-id>/`.
6. The command does not create `src/routes/wiki/`.

### Workflow: Agent resolves artifact context

1. Agent runs `weave artifact current --json` from the directory the user is editing.
2. Weave resolves the directory to the containing workspace or repo root.
3. Weave returns the active artifact for that single context.
4. The agent no longer needs to pass `--target` or `all`.

### Workflow: User tries obsolete multi-target commands

1. User runs `weave change new "Do thing" --target app`.
2. The CLI rejects the unknown option.
3. User reruns `weave change new "Do thing"` from the desired workspace or repo context.

## User Stories

1. As a workspace user, I want `weave change current` to work from inside any registered sub-repo, so that I do not need to remember to `cd` to the workspace root.
2. As a workspace user, I want `weave change progress` to update the workspace change even when I am editing a sub-repo, so that lifecycle commands match where I am working.
3. As a repo-mode user, I want change commands run from nested directories to resolve to the repo root, so that commands do not create accidental nested Weave contexts.
4. As an agent, I want one cwd-based way to resolve current change and artifact context, so that I do not need to reason about session folders, `all`, or target ids.
5. As a maintainer, I want obsolete multi-target and propagation behavior removed, so that the CLI surface matches the workspace-only change model.
6. As a user who previously used `weave change propagate`, I want the command removed clearly rather than kept with confusing semantics, so that I do not copy artifacts into sub-repos by mistake.

## Functional Requirements

- The system should resolve all `weave change` and `weave artifact` commands from `cwd` by walking up to `.weave/workspace.yml`.
- The system should treat `mode: workspace` as a single workspace-level change context.
- The system should treat `mode: repo` as a single repo-level change context.
- The system should fail clearly when no Weave context is found above `cwd`.
- The system should remove the `--target` option from all `weave change` subcommands.
- The system should remove target positionals from `weave change list` and `weave change current`.
- The system should remove the `--target` option from `weave artifact current`, `weave artifact current set`, and `weave artifact current clear`.
- The system should remove `weave change propagate` from the CLI.
- The system should remove the `weave-propagate` skill from bundled templates and installed skill copies.
- The system should keep `weave change new` return JSON stable enough for existing consumers by preserving `targets: [...]` as a one-element array unless implementation finds a stronger reason to break it.
- The system should not create or modify `wiki/` inside workspace sub-repos as part of change or artifact command resolution.
- The system should not add workspace sub-repos to `session.folders` as a side effect of change or artifact commands.
- The system should update README and knowledge docs to remove `--target`, `all`, and propagation examples.
- The system should update `weave-new` and `weave-next` guidance to stop recommending multi-target or `change current all` flows.

## States and Lifecycle

The change lifecycle remains the existing one:

- Feature changes start at `stage: exploration`.
- Non-feature changes start at `stage: started`.
- Artifact lanes remain `exploration`, `prd`, `architecture`, and `issues`.
- `weave change progress <lane>` continues to update `status.yml.artifacts`, `stage`, `stale`, and knowledge invalidation.

This PRD changes how the command finds the containing change context, not the lifecycle vocabulary.

## Edge Cases

- **Command from workspace root**: behavior remains the same, but it now uses the shared cwd-dispatch resolver.
- **Command from workspace sub-repo**: resolves to workspace root and never scaffolds inside the sub-repo.
- **Command from repo-mode nested directory**: resolves to repo root.
- **Command outside any Weave context**: fails with a clear initialization hint.
- **Malformed workspace.yml**: follows the same conservative behavior as the shared mode helper; if no valid mode is found, the command should not silently create nested change state.
- **User passes removed `--target`**: command fails as an unknown option.
- **User invokes removed `weave change propagate`**: command fails because the subcommand no longer exists.
- **Existing sub-repo already has a local `wiki/changes/`**: out of scope; this change does not migrate or delete it.
- **Existing automation parses `targets` array**: preserve a one-element `targets` array where practical to reduce breakage.

## Acceptance Criteria

- [ ] From a workspace root, `weave change current`, `status`, `list`, `progress`, `clear-stale`, `knowledge`, `switch`, and `new` continue to operate on `workspace/wiki/changes/`.
- [ ] From inside a registered workspace sub-repo, the same commands operate on the parent workspace's `wiki/changes/`.
- [ ] From inside a repo-mode subdirectory, the same commands operate on the repo root's `wiki/changes/`.
- [ ] From outside any Weave context, change and artifact commands fail with a clear "run weave init" style message.
- [ ] `weave artifact current`, `current set`, and `current clear` resolve to the same workspace or repo root as `weave change current`.
- [ ] `--target` is not accepted on any change or artifact command.
- [ ] `weave change list all` and `weave change current all` are no longer documented or supported.
- [ ] `weave change propagate` is removed from the CLI.
- [ ] `weave-propagate` is removed from skill templates and installed skill directories.
- [ ] No workspace sub-repo gets `wiki/`, `.weave/`, or `session.folders` entries from change/artifact commands.
- [ ] README and knowledge docs describe cwd-dispatched single-context change and artifact behavior.
- [ ] Existing lifecycle progress and staleness behavior continues to work for the resolved single context.

## Rollout Considerations

This is a breaking simplification for users or automations that still use `--target`, `all`, or `weave change propagate`.

The expected communication should be explicit:

- Change and artifact commands are now cwd-dispatched.
- In workspace mode, run commands from anywhere inside the workspace; they operate on the workspace change store.
- Multi-target `--target` and propagation flows have been removed.
- Users should create one workspace-level change and use normal repo workflows for implementation inside registered sub-repos.

No data migration is required for normal workspaces because the durable change store remains `wiki/changes/`.

## Analytics and Success Metrics

Success can be evaluated qualitatively and through test coverage:

- Fewer "no current change" reports when users run commands from workspace sub-repos.
- No new accidental `wiki/changes/` folders inside registered sub-repos during workspace workflows.
- Skills and docs no longer mention deleted multi-target commands.
- Test coverage proves cwd dispatch for workspace root, workspace sub-repo, repo root, repo subdirectory, and no-context failure.

## Revision History

- 2026-06-05: Initial PRD generated from PRD session capture, current command reference knowledge, and change workflow knowledge.

## Assumptions

- Workspace mode should remain workspace-only for Weave artifacts; sub-repos are implementation locations, not separate artifact stores.
- It is acceptable to remove `--target` and `weave change propagate` without compatibility aliases because the product model is still pre-1.0 and the old behavior conflicts with workspace mode.
- Keeping `targets: [...]` as a one-element JSON field is preferred for compatibility, but the command surface should no longer expose multi-target behavior.
- The shared `findWorkspaceMode` helper is the intended source of mode truth for this command family.

## Open Questions

- Should removed options get custom migration messages, or are standard Commander unknown-option errors sufficient?
- Should existing sub-repo-local Weave scaffolds be detected and warned about in a later change?

## Out of Scope

- Per-sub-repo `wiki/changes/`.
- Hybrid workspace/spec plus sub-repo/task artifact routing.
- `status.yml.scope` or touched-repo metadata.
- Workspace clone/missing-repo workflows.
- Full workspace-aware rewriting of every skill's discovery prompts.
- Migration of existing accidental sub-repo change folders.

## Further Notes

The most important user-facing behavior is consistency: `weave add`, `weave workspace`, `weave change`, and `weave artifact` should all agree that the current context is found by walking up from `cwd` to committed Weave mode metadata.
