# Contracts: Guard `weave change new` against a dirty worktree

## Interfaces

- CLI: `weave change new <title> [--type <type>] [--slug <slug>] [--json]` —
  unchanged signature. New failure path on a dirty worktree.
- Library: `createChange(options: CreateChangeOptions)` in `src/lib/changes.ts`
  gains a clean-worktree precondition before any filesystem write or branch
  switch.

## State

- Order of operations in `createChange` must become:
  1. validate title
  2. `resolveTarget(cwd, sessionPath)` → workspace-root target
  3. `assertGitTargets([target])` (git presence)
  4. **`assertCleanGitTargets([target])` (NEW)** — refuse if dirty
  5. `assertChangeMissing` / scaffold writes / `ensureChangeBranch`
- Refusal must be side-effect free: no directory creation, no branch creation,
  no branch switch, current branch unchanged.

## Validation and errors

- Use `ChangeCommandError` with `code: "dirty_worktree"` (stable for JSON
  consumers) and a create-specific message:
  `Uncommitted changes to tracked files in <path>. Commit or stash them before creating a change.`
- Dirtiness definition (DECISION — relaxed): block only when `git status
  --porcelain` reports a line that is NOT an untracked entry (`??`). Untracked
  files are allowed. Implemented as a dedicated `assertNoTrackedChanges` helper,
  separate from `assertCleanGitTargets` (which stays strict for `switchChange`).

## Risks / decisions

- DECISION (chosen): relaxed semantics — only staged/unstaged modifications to
  tracked files block `createChange`; untracked files do not. Rationale: the
  hazard is dragging *modified* committed work across the implicit
  `git checkout -b`; untracked scaffold from `weave init` / freshly written
  change artifacts are expected and must not block the
  `init -> first change` flow.
- This intentionally diverges from `switchChange`'s strict
  `assertCleanGitTargets` (which also blocks untracked) because `switch` only
  runs after a change already exists and has been committed, whereas
  `createChange` runs on a possibly-fresh, never-committed worktree.
- DOES NOT prevent a manual `weave change new` from creating a duplicate change
  while already on a `change/<id>` branch when the only state is untracked/clean.
  That duplicate-prevention lives in the `weave-fix` skill's branch-awareness
  (slice 02) for the agent path; a dedicated CLI "already on a change branch"
  refusal was intentionally left out of this change.
- RISK (resolved): because untracked files no longer block, existing
  `tests/changes.test.ts` cases that call `createChange` after a bare `initGit`
  (untracked `.weave` scaffold) keep passing without fixture changes. Cases that
  modify tracked files before `createChange` would now be blocked — none found
  in the current suite.
