---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-07T08:58:42.259Z
updated_at: 2026-06-07T08:59:05.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Task Prepare Workflow

## Topic

Task preparation for repo and workspace changes.

## Current Understanding

Weave task planning now records implementation-location metadata in the canonical `wiki/changes/<change-id>/tasks.md` artifact. That metadata is enough for future implementation agents to know which repo or repos a task may touch, but it does not yet solve the local branch-readiness problem.

In repo mode, the artifact root and implementation repo are the same git checkout. `weave change new` and `weave change switch` already create or check out the change branch for that repo, so task preparation is mostly validation.

In workspace mode, the artifact root has the active Weave change branch, but registered implementation repos have independent git branches. Before an engineer or agent starts work, the relevant sub-repos need to be on the same change branch recorded in `status.yml.branch`.

The desired product behavior is a new prepare workflow:

- `/weave-prepare` as the agent/slash-command surface.
- `weave task prepare` as the deterministic CLI surface.
- Prepare means local branch readiness only.
- Prepare does not implement tasks, verify tasks, update task completion status, commit, push, or open PRs.

Prepare derives the relevant repos from selected `T#` tasks in `tasks.md`, then ensures those repos are locally ready on the active change branch.

## Open Questions

None for the product behavior captured so far. Technical design still needs to decide exact parser boundaries, CLI JSON shape, tests, and whether implementation should live in new task-specific modules or shared change helpers.

## Decisions

- Use the product term `prepare`.
- Prepare means local branch readiness for selected task repos/folders.
- Prepare is distinct from future task execution.
- Task execution is out of scope for this change and may be handled as a separate future change.
- Expose prepare through both `/weave-prepare` and `weave task prepare`.
- Support task id, scope, and all selection modes.
- Support multiple explicit task ids such as `/weave-prepare T1 T3 T7`.
- If `/weave-prepare` is invoked without arguments, ask the user what to prepare and suggest available scopes, task ids, and `all`.
- Scope matching is case-insensitive.
- Prepare is task-status agnostic; it uses task metadata only to derive repos and does not care whether a task is `todo`, `in_progress`, `blocked`, `done`, `not_tested`, or `invalid`.
- `/weave-prepare all` means all repos referenced by all `T#` tasks in the active change, not all registered workspace repos.
- In workspace mode, missing or ambiguous repo metadata stops and asks the user to fix or choose repo mapping.
- In repo mode, missing or ambiguous repo metadata defaults to the repo root.
- The artifact root must already be on `status.yml.branch`; prepare should stop if the artifact root git branch is mismatched.
- In workspace mode, prepare creates or checks out `status.yml.branch` inside selected implementation repos.
- A missing sub-repo branch is created from the repo's current clean branch.
- An existing sub-repo branch is checked out automatically when the repo is clean.
- A dirty repo already on `status.yml.branch` is acceptable because no branch movement is needed.
- A dirty repo on another branch stops before switching; prepare must not stash, commit, discard, or move changes automatically.
- Non-git selected repos/folders are recorded as `skipped_not_git` and prepare still succeeds.
- Do not persist dirty state in `status.yml`.
- Store per-repo branch readiness under `status.yml.execution.repos`.
- Store `state: prepared` for git repos where branch readiness was established.
- Store both `prepared_at` and `verified_at` for prepared repos.
- Do not store `last_prepare` in v1.
- Do not store selector-specific `preparations` in v1.
- Preserve existing `execution.repos` records across different prepare selections.
- If `status.yml.execution.branch` differs from top-level `status.yml.branch`, treat execution readiness as stale and let the next prepare overwrite readiness for the current branch.

## Scenarios

### Backend Engineer Prepares Backend Work

1. A backend engineer runs `/weave-prepare backend`.
2. Weave reads all `T#` tasks with `Scope: backend`, matching case-insensitively.
3. Weave derives the union of `Primary repo` and `Repos` metadata from those tasks.
4. In workspace mode, Weave ensures those selected repos are on `status.yml.branch`.
5. In repo mode, Weave validates the root repo is already on `status.yml.branch`.
6. Weave records per-repo readiness in `status.yml.execution.repos`.

### Frontend Engineer Prepares Frontend Work Later

1. A frontend engineer runs `/weave-prepare frontend`.
2. Weave prepares only repos referenced by frontend-scoped tasks.
3. Existing backend repo readiness records stay in `status.yml.execution.repos`.
4. The latest prepare does not remove previously prepared repos.

### Prepare All Task Repos

1. A user runs `/weave-prepare all`.
2. Weave reads all `T#` tasks in `tasks.md`, regardless of status.
3. Weave derives all repos referenced by those tasks.
4. Weave prepares only those referenced repos, not every registered workspace repo.

### Prepare Specific Tasks

1. A user runs `/weave-prepare T1 T3 T7`.
2. Weave reads exactly those `T#` tasks.
3. Weave derives the union of repos from those tasks and prepares them.

### No Argument Invocation

1. A user runs `/weave-prepare`.
2. Weave does not default to `all`.
3. Weave asks what to prepare and suggests available scopes, task ids, and `all`.

### Dirty Repo

1. A selected workspace repo has uncommitted changes and is already on `status.yml.branch`.
2. Prepare succeeds because no checkout or branch creation is needed.
3. Dirty state is shown from live git output if useful, but not stored.

### Dirty Repo On Another Branch

1. A selected workspace repo has uncommitted changes and is not on `status.yml.branch`.
2. Prepare stops before switching branches.
3. Weave does not stash, commit, discard, or move those changes.

### Non-Git Selected Repo Or Folder

1. A selected repo/folder is not a git repo.
2. Prepare records `branch_status: skipped_not_git` and `state: skipped` for that entry.
3. Prepare succeeds.

## Existing Behavior

- `weave change new` creates `status.yml.branch` and creates/checks out that branch only for the resolved Weave root.
- In repo mode, the resolved Weave root is also the implementation repo.
- In workspace mode, registered repos are implementation locations inside one workspace change context, but their git branches are not prepared by existing change commands.
- `tasks.md` can now include `Scope`, `Primary repo`, `Repos`, `Architecture refs`, and `Coordination` fields.
- `weave-issues` does not create per-repo task artifacts.
- No first-class `weave task prepare` or `/weave-prepare` behavior exists yet.

## PRD Readiness

Ready. The discussion has enough product decisions to produce a detailed PRD for task preparation.
