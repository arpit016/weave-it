---
artifact: tasks
slice: 03-change-new-dirty-worktree-guard
status: draft
owner: engineering
created_at: 2026-06-11T18:42:00+05:30
updated_at: 2026-06-11T18:42:00+05:30
source: findings
---

# Tasks: Guard `weave change new` against a dirty worktree

> SLICE INVALID (user decision): the duplicate-change concern is fully handled
> by the `weave-fix` skill's structural `change/<change-id>` branch check
> (slice 02). The CLI dirty guard was reverted — `createChange` change and the
> two added tests were removed from `src/lib/changes.ts` / `tests/changes.test.ts`.
> Tasks below are retained for history only.

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
| T1 | invalid | afk | weave-it | | Add clean-worktree precondition to createChange | None |
| T2 | invalid | afk | weave-it | | Verify createChange refuses on dirty worktree and succeeds when clean | T1 |

## weave-it

### T1: Add clean-worktree precondition to createChange

Status: invalid
Owner:
Repos: weave-it
Execution: afk
Blocked by: None
Files:
- src/lib/changes.ts (M)
- tests/changes.test.ts (M)

### What to build

In `createChange`, add a relaxed clean-worktree precondition after
`assertGitTargets([target])` and before `assertChangeMissing` / scaffold writes
/ `ensureChangeBranch`, so uncommitted changes to tracked files are rejected
before any side effect. Implement a dedicated `assertNoTrackedChanges` helper
(NOT `assertCleanGitTargets`, which stays strict for `switchChange`): parse
`git status --porcelain` and block only when a line is not an untracked (`??`)
entry. Use the `dirty_worktree` error code (stable for JSON consumers). Untracked
files must be allowed so `weave init` -> first `weave change new` is not refused;
this also means existing tests that init without committing keep passing.

### Acceptance Criteria

- [x] `createChange` throws `ChangeCommandError` with `code: "dirty_worktree"` when there are uncommitted changes to tracked files for the resolved target.
- [x] Untracked-only worktrees (fresh init scaffold) do NOT block creation.
- [x] The guard runs before any directory/branch creation; on refusal the current branch is unchanged and no change folder is written.
- [x] `createChange` still succeeds on a clean worktree.
- [x] Existing `tests/changes.test.ts` cases pass without fixture changes.

### Verification

- Automated tests: `npm test -- changes`
- Manual/smoke check: in a repo with an uncommitted edit, run `weave change new "x" --type fix` and confirm a `dirty_worktree` refusal with no new branch.

### T2: Verify createChange refuses on dirty worktree and succeeds when clean

Status: invalid
Owner:
Repos: weave-it
Execution: afk
Blocked by: T1
Files:
- tests/changes.test.ts (M)

### What to build

Add focused tests mirroring the existing `switchChange` dirty test
(`tests/changes.test.ts` around line 463):

1. Dirty refusal: on a clean repo with one initial commit, write an uncommitted
   file, call `createChange`, and assert it rejects with `Uncommitted changes`
   (code `dirty_worktree`); assert no `change/<id>` branch was created and the
   current branch is unchanged.
2. Clean success: on a clean worktree, `createChange` succeeds and switches to
   `change/<id>` as before.

### Acceptance Criteria

- [ ] A test asserts `createChange` rejects on a dirty worktree with the `dirty_worktree` code/message.
- [ ] A test asserts no branch is created and the branch is unchanged on refusal.
- [ ] A test asserts `createChange` still succeeds on a clean worktree.

### Verification

- Automated tests: `npm test -- changes`

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

Reverted per user decision. `createChange` guard and the two tests were removed;
`npm test -- changes` (32) and `npm run typecheck` pass clean after revert. No
CLI behavior change ships from this slice.
