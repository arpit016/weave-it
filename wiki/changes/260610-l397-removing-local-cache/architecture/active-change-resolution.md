---
artifact: architecture
facet: active-change-resolution
status: draft
owner: engineering
created_at: 2026-06-10T19:05:20.000Z
updated_at: 2026-06-10T19:05:20.000Z
source: prd.md, codebase, architecture discussion
---

# Active Change Resolution

## Current Model

`src/lib/changes.ts` currently uses session-backed routing:

- `currentChange` loads or creates the local session, resolves the target, calls `currentContextForTarget`, and saves the session if branch inference occurred.
- `currentContextForTarget` reads `activeChangeForTarget(session, target)`, then reads changes with the saved id as the active marker.
- If branch inference succeeds and no saved session value exists, `currentContextForTarget` calls `setCurrentChangeForPath` and returns `source: "inferred_saved"`.
- If saved session state and branch inference disagree, the saved session state remains authoritative and the result reports a mismatch.
- `progressChange`, `clearChangeStaleness`, `knowledgeChange`, and `activeChangeContext` call the same resolver, so they can mutate the `status.yml` selected by hidden session state.
- `switchChange` writes `current_change` to the local session after checking out the change branch.

This behavior conflicts with the PRD because a stale local pointer can select a change when the branch does not.

## Proposed Model

Create a branch-derived active-change resolver in `src/lib/changes.ts`. It should be the only active-change resolver used by commands that require an active change.

Suggested result state:

```ts
type CurrentSource = "branch" | "none";

type ActiveChangeResolution =
  | "branch_active"
  | "no_active_change"
  | "invalid_active_branch"
  | "non_git_no_active_change";
```

Suggested result fields:

```ts
export interface CurrentChangeTargetResult {
  id?: string;
  name?: string;
  path: string;
  source: CurrentSource;
  saved: false;
  resolution: ActiveChangeResolution;
  current?: ChangeSummary;
  branch?: string;
  branchMatch: BranchMatch;
  invalidBranch?: { branch: string; changeId: string; reason: string };
}
```

The exact field names can be adjusted during implementation, but the machine-readable resolution value should exist so agents do not have to infer the cause from message text.

## Resolver Algorithm

Implement the resolver around the resolved root path, not the original nested cwd:

```ts
async function currentContextForTarget(target: ChangeTarget): Promise<CurrentChangeTargetResult> {
  const gitRoot = await findGitRoot(target.path);
  if (!gitRoot) {
    return noActive(target, "non_git_no_active_change", undefined, "not_git");
  }

  const branch = await currentBranch(target.path);
  if (!branch || !branch.startsWith("change/")) {
    return noActive(target, "no_active_change", branch, branch ? "unknown" : "unknown");
  }

  const changeId = branch.slice("change/".length);
  const changePath = path.join(target.path, "wiki", "changes", changeId);
  const statusPath = path.join(changePath, "status.yml");

  if (!(await pathExists(statusPath))) {
    return invalidActiveBranch(target, branch, changeId, "missing_status");
  }

  const metadata = await readChangeMetadata(changePath, changeId);
  if (metadata.branch !== branch) {
    return invalidActiveBranch(target, branch, changeId, "status_branch_mismatch");
  }

  return {
    id: target.id,
    name: target.name,
    path: target.path,
    source: "branch",
    saved: false,
    resolution: "branch_active",
    current: { ...metadata, path: path.join("wiki", "changes", changeId), changePath, active: true },
    branch,
    branchMatch: "match",
  };
}
```

The implementation can reuse existing helpers such as `readChangeMetadata`, `currentBranch`, `findGitRoot`, and `changeDir` rather than duplicating path construction.

## File-Level Changes

`src/lib/changes.ts`

- Remove session loading/saving from `currentChange`, `statusChange`, `activeChangeContext`, `progressChange`, `clearChangeStaleness`, and `knowledgeChange` where it exists only to resolve active change.
- Replace `currentContextForTarget(session, target, now, { saveInferred })` with a branch-only resolver.
- Remove `activeChangeForTarget` from active lookup paths.
- Update `listChanges` to compute the active marker from the current branch-derived change id.
- Update `switchChange` so it only checks out or creates the expected branch; it should not write `current_change` or clear `current_artifact`.
- Update formatters to render `source: branch` and resolution-specific no-active/invalid messages.
- Add `resolution` to JSON result types for current and status.

`src/lib/session-state.ts`

- Keep `current_change` and `current_artifact` optional fields in `SessionFolder` for legacy parse tolerance.
- Remove helper exports only after all call sites are gone, or leave them unused temporarily if that keeps the first implementation smaller.

`src/lib/doctor.ts`

- Replace `readActiveChange` session lookup with branch-derived lookup or a shared helper exported from `changes.ts`.
- Do not warn about old local session fields.

`src/commands/slice.ts` and `src/lib/task-prepare.ts`

- No direct architecture change is needed if `currentChange` and `activeChangeContext` keep compatible success shapes.
- Verify no-active states still produce the existing `no_current_change` recovery message.

## Non-Git Behavior

`weave change new` should fail before creating files when the resolved root is not inside a git repo. This prevents creating a change that cannot be activated by branch state.

Implementation point:

- In `createChange`, after `resolveTarget`, call `findGitRoot(target.path)` for every target.
- If any target lacks a git root, throw `ChangeCommandError("not_git_repo", "Weave changes require a git repository. Initialize git, then run `weave change new` again.")` or equivalent.
- Remove or stop using `BranchStatus: "skipped_not_git"` for change creation.

## Compatibility

- Existing local session files remain readable.
- Existing change folders remain readable.
- Existing branches named `change/<id>` continue to work.
- Existing non-git change folders may be listed if directly inspected, but they should not become active without a branch.

## Risks

- `statusChange({ change })` currently uses the saved active id when reading all changes. It should read all changes without a session active id and set `active` by branch-derived id.
- `readChanges` may need a branch-derived active id argument to preserve active markers in list/status output.
- Human output that says `Source: session` must be updated or tests will keep encoding the old model.
