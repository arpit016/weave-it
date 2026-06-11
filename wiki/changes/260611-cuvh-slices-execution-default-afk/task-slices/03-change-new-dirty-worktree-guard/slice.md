# Guard `weave change new` against a dirty worktree

## Outcome

`weave change new` refuses to create + switch to a new change branch when the
resolved target worktree has uncommitted changes to tracked files. Untracked
files are allowed so the `weave init` -> first `weave change new` flow (which
leaves the scaffold untracked) still works. The user is told to commit or stash
tracked changes first, so an implicit `git checkout -b change/<id>` can no
longer silently drag modified, committed work onto a new branch.

## User flow

1. User has uncommitted changes in the workspace-root worktree.
2. User runs `weave change new "<title>" --type fix`.
3. Weave checks the worktree before writing any files or switching branches and
   refuses with a `dirty_worktree` error naming the path and the remedy.
4. After the user commits/stashes/cleans, `weave change new` proceeds normally
   and creates the change + branch.

## In scope

- Add the clean-worktree precondition to `createChange` in `src/lib/changes.ts`,
  reusing the existing `assertCleanGitTargets` helper.
- The check runs before `assertChangeMissing` writes / `ensureChangeBranch`
  switches, so no partial state is created on refusal.
- Tests: refusal on dirty worktree (mirroring the existing `switchChange` test)
  and success on a clean worktree.

## Out of scope

- Skill-template edits (covered by slices 01 and 02).
- Branch-awareness / re-invocation logic (that is skill-level in `weave-fix`).
- Any `--force` / override flag (only add if the user later requests it).
- Changing `assertCleanGitTargets` semantics for `switchChange`.

## Acceptance criteria

- [ ] `createChange` rejects with a `dirty_worktree` error when the worktree has uncommitted changes to tracked files, before creating files or switching branches.
- [ ] `createChange` succeeds when the worktree has only untracked files (e.g. fresh `weave init` scaffold).
- [ ] `createChange` succeeds on a clean worktree exactly as before.
- [ ] No change branch is created and the current branch is unchanged when the refusal fires.
- [ ] Existing change tests still pass without fixture changes.
