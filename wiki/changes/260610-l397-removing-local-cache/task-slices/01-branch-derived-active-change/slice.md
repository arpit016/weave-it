# Branch-Derived Active Change

## Outcome

Weave resolves the active change from the resolved root git branch instead of hidden local `current_change` session state. Commands that require an active change stop when the branch does not identify a valid change.

## User flow

1. User is in a Weave repo or workspace root on `change/<change-id>`.
2. User runs `weave change current`, `weave change status`, `weave change progress`, `weave change knowledge`, `weave task prepare`, or `weave slice rollup`.
3. Weave resolves the root from `cwd`, reads the root branch, validates `wiki/changes/<change-id>/status.yml`, and operates on that change.
4. If the branch is not a valid change branch, Weave returns a no-active or invalid-active state without reading `current_change`.

## In scope

- Branch-derived active-change resolver in `src/lib/changes.ts`.
- Stable machine-readable current/status resolution state.
- Non-git `weave change new` refusal before files are written.
- Active markers for list/status based on branch-derived id.
- `weave doctor` active-change reporting aligned with branch authority.
- Regression tests that stale session data does not select an active change.

## Out of scope

- Removing the `weave artifact` command surface.
- Updating skill templates and knowledge docs.
- Workspace/sub-repo branch-disagreement UX beyond workspace-root authority.

## Acceptance criteria

- [ ] `weave change current --json` reports active change from `change/<id>` plus matching status file.
- [ ] `weave change current --json` reports no active change on non-change branches even when session has `current_change`.
- [ ] `weave change current --json` reports invalid active branch for `change/<missing-id>`.
- [ ] `weave change new` refuses non-git roots before writing change files.
- [ ] Lifecycle-mutating commands use the branch-derived change and refuse to run without one.
