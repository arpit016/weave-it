# Active Change Commands

## Topic

Add `weave change list`, `weave change switch`, `weave change current`, and `weave change status` so Weave can answer which change is active and make it easy to continue an existing change.

## Current Understanding

Weave now stores change work under `wiki/changes/{id}` and uses `change/{id}` branches. The next gap is local developer workflow: after several changes exist, the CLI should make it obvious which change is active, what status it has, and how to move between changes.

The active change should be local workspace/session state, not committed repository state. Different developers can work on different active changes in the same repositories, and one workspace may contain multiple participating repos.

The active state should be tracked per folder in the current Weave session. That lets Weave answer "what is active in every workspace folder?" and lets propagation set active state for destination repos when a change expands across the workspace.

The command family should support both human-readable text output and `--json` so agents and scripts can use the same commands.

## Open Questions

- Should `weave change status` later grow an implementation progress mode, or should that remain a separate command if needed?
- Should `weave change list --verbose` be added later for branch diagnostics across inactive changes?

## Decisions

- Add `weave change list [target] [--json]`.
- Add `weave change switch <change> [--json]`.
- Add `weave change current [target] [--json]`.
- Add `weave change status [change] [--target <target>] [--json]`.
- Treat the user typo `witch` as `switch`; the command name should be `switch`.
- Store active change state in the local Weave session, under each folder entry in `~/.cache/weave/current-session.yml`.
- Do not create `.weave/current-change.yml`; no `.gitignore` entry is needed for active change state.
- Use this session folder shape:

```yaml
folders:
  weave-it:
    path: /Users/arpit/personal/weave-it
    name: Weave It
    kind: app
    current_change:
      id: 260525-w3ye-active-change-commands
      path: wiki/changes/260525-w3ye-active-change-commands
      branch: change/260525-w3ye-active-change-commands
      updated_at: "..."
```

- Resolve change references by full change id, 4-character token, or unique slug/title substring.
- If a reference has no match or multiple matches, return a clear error and do not mutate state.
- `weave change new` should set the newly-created change as current for every target after successful artifact and branch creation.
- `weave change new` may run with uncommitted changes because it is often used to formalize work already started.
- `weave change propagate` copies change planning artifacts into destination repos and creates or checks out the matching branch there.
- `weave change propagate` should set current only for destination repos, not for the source repo.
- `weave change propagate` does not copy implementation files, commits, staged files, or patches.
- `switch` should create or check out `status.yml.branch` in git repositories.
- If branch checkout or creation fails, `switch` must not update active session state.
- `switch` should block on uncommitted changes.
- In non-git folders, `switch` should update active session state and report that branch work was skipped.
- `switch` should not edit `status.yml`; it only changes active session state and git branch.
- `propagate` should block on uncommitted changes in affected destination repos.
- If no session active state exists and the current git branch maps unambiguously to a known change, `current` and `status` should save that inferred active state.
- For `current all` and `status --target all`, the same self-healing behavior should apply across every matching workspace repo, and output should clearly report when pointers were saved.
- If saved session state and git branch point to different known changes, mutating commands that depend on active context should fail with both contexts shown and instruct the user to run `weave change switch <id>`.
- `status` should report metadata only for this version: id, title, type, stage, branch, path, active marker, and branch match/mismatch.
- `list` should remain a clean index and only mark the active change; inactive branch diagnostics belong in `status` or a later verbose mode.
- `list all` and `current all` should group results by workspace folder.

## Scenarios

- A developer runs `weave change list` in the current repo and sees local changes sorted newest first.
- A developer has an active change; `weave change list` marks it with `*`.
- A developer runs `weave change list all` and sees changes grouped by workspace folder.
- A developer runs `weave change new "Fix import review"` after already editing files. Weave creates the change branch and sets that new change current without blocking on the dirty worktree.
- A developer runs `weave change switch 260525-abcd-fix-login` and Weave checks out `change/260525-abcd-fix-login`, then updates the current session folder entry.
- A developer runs `weave change switch abcd` and the 4-character token resolves to a unique change.
- A developer runs `weave change switch login` and a unique slug/title substring resolves to a change.
- A developer runs `weave change switch auth` and multiple changes match; Weave explains the ambiguity and leaves current state untouched.
- A developer runs `weave change switch B` while uncommitted edits exist for change A. Weave blocks and leaves session state unchanged.
- A developer runs `weave change current` and gets the active change id, title, type, stage, branch, and path.
- A developer runs `weave change current` with no saved session active state while on a matching `change/{id}` branch. Weave saves that inferred active state and reports it.
- A developer runs `weave change current all` in a workspace where multiple repos are already on known `change/{id}` branches. Weave saves active state for each matching repo and reports which entries were saved.
- A developer runs `weave change status` and sees active change metadata plus whether the current git branch matches the expected branch.
- A developer runs `weave change status <change>` to inspect a change without switching to it.
- A developer runs `weave change propagate 260525-auth-ui --from web --to api`. Weave copies `status.yml` and `exploration.md` into `api`, checks out or creates the matching branch in `api`, and sets `api` current for that change.
- A developer runs a mutating command when session state points to change X but git branch points to change Y. Weave refuses to choose implicitly and tells the user to resolve with `weave change switch <id>`.

## Existing Behavior

- `weave change new` creates `wiki/changes/{id}/exploration.md` and `wiki/changes/{id}/status.yml`.
- Generated status metadata includes `id`, `slug`, `title`, `type`, `stage`, `branch`, `created_at`, and `updated_at`.
- New change branches are named `change/{id}`.
- `weave change propagate` copies an existing change exploration into another repo.
- There is no first-class active change pointer yet.
- Users and agents currently need to infer the active change from branch state or folder names.
- The current Weave session already lives at `~/.cache/weave/current-session.yml` and tracks workspace folders by id, path, name, and kind.
- Committed `.weave/` metadata currently stores shared sync and agent install manifests, which should stay separate from local active session state.

## PRD Readiness

Ready for implementation. The command surface, active-state storage model, lifecycle rules, mismatch behavior, dirty-worktree policy, propagation behavior, and core scenarios are defined.
