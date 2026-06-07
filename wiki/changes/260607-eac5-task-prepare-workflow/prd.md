---
artifact: prd
status: draft
owner: product
created_at: 2026-06-07T08:59:05.000Z
updated_at: 2026-06-07T08:59:05.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration
---

# Task Prepare Workflow PRD

## Problem Statement

Weave can now generate workspace-aware `tasks.md` files with task-level repo metadata, but there is no first-class way to prepare the relevant repos for implementation.

In repo mode, this is mostly already handled because the change artifact root and implementation repo are the same checkout. `weave change new` and `weave change switch` create or check out the change branch at the repo root.

In workspace mode, the change artifact root and implementation repos are different git checkouts. The workspace root may be on `change/<change-id>`, but backend, frontend, mobile, infra, or docs repos inside the workspace may still be on `main`, `develop`, a release branch, or another local branch. If an engineer or agent starts implementation without preparing those repos, code changes may land on the wrong branch.

The product needs a safe, explicit, local-only prepare workflow that derives relevant repos from selected tasks and establishes branch readiness before future task execution.

## Product Summary

Add a new task preparation workflow:

```text
/weave-prepare
weave task prepare
```

Prepare means:

```text
Validate selected task repo mapping and ensure selected repos/folders are locally ready for work on status.yml.branch.
```

Prepare does not mean:

```text
Implement, verify, mark tasks done, commit, push, open PRs, stash, discard changes, or publish anything remotely.
```

## Goals

- Provide a first-class task preparation workflow before future task execution.
- Support both repo mode and workspace mode.
- Use task metadata in `tasks.md` to derive relevant repos.
- Prepare by task id, scope, or all task-referenced repos.
- Keep prepare local-only and safe.
- Record durable per-repo branch readiness in `status.yml`.
- Preserve one canonical `tasks.md` artifact and avoid per-repo task artifacts.
- Support backend and frontend engineers preparing their scopes independently.
- Make `/weave-prepare` convenient for agents and users while keeping `weave task prepare` deterministic and scriptable.

## Non-Goals

- Implementing tasks.
- Running task verification.
- Updating task statuses such as `in_progress`, `done`, or `not_tested`.
- Committing changes.
- Pushing branches.
- Opening pull requests.
- Creating remote branches.
- Stashing, discarding, moving, or committing dirty worktree changes.
- Persisting dirty worktree state.
- Tracking selector-specific preparation history.
- Creating `tasks/<repo>/tasks.md` or any per-repo task artifact.
- Preparing every registered workspace repo unless those repos are referenced by selected `T#` tasks.
- Defining the future task execution workflow. Execution should be handled in a separate change.

## Actors

- **Backend engineer**: prepares backend task repos before implementing backend-owned slices.
- **Frontend engineer**: prepares frontend task repos before implementing frontend-owned slices.
- **Full-stack engineer**: prepares all or full-stack task repos before working across boundaries.
- **Agent using `/weave-prepare`**: translates user intent into `weave task prepare`, handles no-argument selection prompts, and summarizes results.
- **Future execution agent**: will use prepared repo state as a preflight signal before implementation, but that behavior is out of scope for this change.

## Glossary

- **Prepare**: local branch-readiness step for selected task repos/folders.
- **Artifact root**: the repo or workspace root that owns `wiki/changes/<change-id>/` and `status.yml`.
- **Implementation repo**: a repo/folder where task implementation may happen. In repo mode this is the artifact root; in workspace mode this is usually a registered workspace repo.
- **Selected tasks**: `T#` tasks matched by task id, scope, or all.
- **Referenced repos**: repos derived from selected tasks' `Primary repo` and `Repos` metadata.
- **Change branch**: top-level `status.yml.branch`, such as `change/260607-eac5-task-prepare-workflow`.

## User-Facing Surfaces

### Slash Command

```text
/weave-prepare
/weave-prepare T3
/weave-prepare T1 T3 T7
/weave-prepare backend
/weave-prepare all
```

The slash command loads a `weave-prepare` skill. The skill should invoke the CLI and summarize results. It should not implement code or edit task statuses.

### CLI

```bash
weave task prepare T3
weave task prepare T1 T3 T7
weave task prepare --scope backend
weave task prepare --all
weave task prepare --json
```

The CLI owns deterministic branch preparation and status storage.

## Selection Semantics

Prepare supports three selection modes.

### Task Id Selection

Explicit task id selection prepares repos referenced by those tasks:

```text
/weave-prepare T3
/weave-prepare T1 T3 T7
```

CLI equivalent:

```bash
weave task prepare T3
weave task prepare T1 T3 T7
```

Rules:

- Only `T#` task ids are valid prepare targets in v1.
- Multiple task ids are supported.
- Selection is status-agnostic.
- If any requested task id is missing, prepare should stop and ask/report the invalid id.

### Scope Selection

Scope selection prepares repos referenced by all `T#` tasks whose `Scope` matches the provided value:

```text
/weave-prepare backend
/weave-prepare frontend
/weave-prepare full-stack
```

CLI equivalent:

```bash
weave task prepare --scope backend
```

Rules:

- Scope matching is case-insensitive.
- Scope labels remain free-form; Weave should not enforce a fixed taxonomy.
- Scope selection is status-agnostic.
- If no `T#` tasks match the scope, prepare should report that no matching tasks were found and avoid branch changes.

### All Selection

All selection prepares repos referenced by all `T#` tasks in the active change:

```text
/weave-prepare all
```

CLI equivalent:

```bash
weave task prepare --all
```

Rules:

- `all` means all repos referenced by all `T#` tasks.
- `all` does not mean every registered workspace repo.
- `all` is status-agnostic.

### No-Argument Selection

If the user invokes `/weave-prepare` without arguments, the skill should ask what to prepare.

Example prompt:

```text
What do you want to prepare?

- all
- backend
- frontend
- full-stack
- T1
- T2
- T3
```

Rules:

- Do not default to `all`.
- Suggestions should be derived from available task ids and scopes in `tasks.md`.
- The CLI may reject no-argument prepare with a message explaining valid selectors.

## Task Status Semantics

Prepare is task-status agnostic.

It should include selected `T#` tasks regardless of task status:

```text
todo
in_progress
blocked
not_tested
invalid
```

Reasoning:

- Prepare is branch readiness only.
- Prepare does not decide whether a task should be executed.
- Future execution behavior can apply execution eligibility rules separately.

## Repo Derivation

For selected `T#` tasks, Weave derives referenced repos from:

```md
Primary repo: <repo id or workspace>

Repos: <repo ids, or None>
```

Rules:

- The repo set is the union of selected tasks' `Primary repo` and `Repos` values.
- `None`, empty values, and non-repo placeholders are ignored only when they are validly non-repo-specific in repo mode.
- In workspace mode, missing or ambiguous repo metadata stops and asks the user to fix or choose repo mapping.
- In repo mode, missing or ambiguous repo metadata defaults to the repo root.
- `Repo Involvement` remains guidance only and is not the primary source of repo derivation.

## Repo Mode Behavior

Repo mode means the artifact root is the implementation repo.

Prepare behavior in repo mode:

1. Resolve the active change.
2. Read `status.yml.branch`.
3. Verify the artifact root is on `status.yml.branch` when it is a git repo.
4. Parse selected tasks from `tasks.md`.
5. If task repo metadata is missing or ambiguous, default to the repo root.
6. Record or refresh root readiness in `status.yml.execution.repos`.

Repo mode does not normally need extra branch creation because `weave change new` and `weave change switch` already manage the artifact-root branch.

Example repo-mode storage:

```yaml
execution:
  version: 1
  branch: change/260607-eac5-task-prepare-workflow
  repos:
    root:
      path: .
      mode: repo
      branch: change/260607-eac5-task-prepare-workflow
      state: prepared
      branch_status: already_active
      prepared_head: abc123
      prepared_at: "2026-06-07T09:00:00.000Z"
      verified_at: "2026-06-07T09:30:00.000Z"
```

## Workspace Mode Behavior

Workspace mode means the artifact root owns `wiki/changes/<change-id>/`, while implementation happens in registered repos.

Prepare behavior in workspace mode:

1. Resolve the active workspace change.
2. Read top-level `status.yml.branch`.
3. Require the workspace artifact root to already be on `status.yml.branch` if it is a git repo.
4. Stop if the artifact root is on a different branch.
5. Parse selected tasks from workspace-level `tasks.md`.
6. Derive selected implementation repos from task metadata.
7. Validate derived repo ids against `.weave/workspace.yml`.
8. For each selected repo, ensure the local checkout is ready on `status.yml.branch`.
9. Record per-repo readiness in workspace `status.yml.execution.repos`.

Prepare should not auto-switch the workspace artifact root. `weave change switch` owns artifact-root branch switching.

## Branch Readiness Rules

### Clean Repo, Branch Missing

If the selected repo is clean and `status.yml.branch` does not exist locally:

```text
create status.yml.branch from the repo's current clean branch
```

Example:

```text
current branch: main
expected branch: change/260607-eac5-task-prepare-workflow
result: create change/260607-eac5-task-prepare-workflow from main
```

### Clean Repo, Branch Exists

If the selected repo is clean and `status.yml.branch` exists locally:

```text
checkout status.yml.branch
```

### Dirty Repo, Already On Expected Branch

If the selected repo has uncommitted changes and is already on `status.yml.branch`:

```text
prepare succeeds
no checkout or branch creation is needed
dirty state is not stored
```

### Dirty Repo, Different Branch

If the selected repo has uncommitted changes and is not on `status.yml.branch`:

```text
prepare stops before switching
```

Prepare must not:

- stash changes
- commit changes
- discard changes
- move changes to another branch
- force checkout

### Non-Git Repo Or Folder

If a selected repo/folder is not a git repo:

```text
prepare succeeds and records skipped_not_git
```

Example storage:

```yaml
execution:
  version: 1
  branch: change/260607-eac5-task-prepare-workflow
  repos:
    docs:
      path: docs
      mode: workspace
      branch: change/260607-eac5-task-prepare-workflow
      state: skipped
      branch_status: skipped_not_git
      prepared_at: "2026-06-07T09:00:00.000Z"
      verified_at: "2026-06-07T09:00:00.000Z"
```

## Status Storage

Prepare stores durable readiness under `status.yml.execution`.

Top-level `status.yml.branch` remains the canonical desired branch.

`status.yml.execution.branch` is a snapshot of the branch used for readiness records. If it differs from top-level `status.yml.branch`, execution readiness is stale.

### Storage Shape

```yaml
execution:
  version: 1
  branch: change/<change-id>
  repos:
    <repo-id>:
      path: <relative path or .>
      mode: <repo | workspace>
      branch: change/<change-id>
      state: <prepared | skipped>
      branch_status: <created | checked_out | already_active | skipped_not_git>
      prepared_head: <git sha, omitted when not git>
      prepared_at: <iso timestamp>
      verified_at: <iso timestamp>
```

### Workspace Example

```yaml
version: 1
id: 260607-eac5-task-prepare-workflow
slug: task-prepare-workflow
title: Task Prepare Workflow
type: feat
stage: prd
branch: change/260607-eac5-task-prepare-workflow
created_at: "2026-06-07T08:58:42.259Z"
updated_at: "2026-06-07T09:00:00.000Z"
execution:
  version: 1
  branch: change/260607-eac5-task-prepare-workflow
  repos:
    api:
      path: api
      mode: workspace
      branch: change/260607-eac5-task-prepare-workflow
      state: prepared
      branch_status: created
      prepared_head: abc123
      prepared_at: "2026-06-07T09:00:00.000Z"
      verified_at: "2026-06-07T09:00:00.000Z"
    web:
      path: web
      mode: workspace
      branch: change/260607-eac5-task-prepare-workflow
      state: prepared
      branch_status: checked_out
      prepared_head: def456
      prepared_at: "2026-06-07T09:05:00.000Z"
      verified_at: "2026-06-07T09:05:00.000Z"
    docs:
      path: docs
      mode: workspace
      branch: change/260607-eac5-task-prepare-workflow
      state: skipped
      branch_status: skipped_not_git
      prepared_at: "2026-06-07T09:06:00.000Z"
      verified_at: "2026-06-07T09:06:00.000Z"
```

### Timestamp Semantics

- `prepared_at`: first time Weave established readiness for this repo and branch.
- `verified_at`: latest time Weave confirmed readiness for this repo and branch.

When prepare re-runs for a repo already recorded for the same branch:

- preserve `prepared_at`
- update `verified_at`
- update `prepared_head` to current HEAD if applicable
- update `branch_status` to reflect the latest prepare action

### Preservation Rules

- Preserve existing `execution.repos` records across different prepare selections.
- `/weave-prepare backend` should not remove prior `/weave-prepare frontend` records.
- `/weave-prepare frontend` should not remove prior `/weave-prepare backend` records.
- `/weave-prepare all` should update selected referenced repos and preserve existing records.
- Do not store `last_prepare` in v1.
- Do not store selector-specific `preparations` in v1.
- Do not store dirty state in v1.

### Stale Readiness

Readiness is stale when:

```text
status.yml.execution.branch != status.yml.branch
```

On the next prepare, Weave should:

- treat existing readiness as stale
- use top-level `status.yml.branch` as canonical
- update `execution.branch`
- overwrite or refresh per-repo readiness for the selected repos

Live git remains authoritative at prepare time.

## User Workflows

### Workflow: Backend Engineer Prepares Backend Repos

1. Backend engineer runs `/weave-prepare backend`.
2. The skill invokes `weave task prepare --scope backend --json`.
3. Weave finds backend-scoped `T#` tasks case-insensitively.
4. Weave derives referenced repos from those tasks.
5. Weave prepares those repos on `status.yml.branch`.
6. Weave records readiness under `status.yml.execution.repos`.
7. The skill summarizes which repos were prepared or skipped.

### Workflow: Frontend Engineer Prepares Later

1. Frontend engineer runs `/weave-prepare frontend`.
2. Weave prepares frontend task repos.
3. Weave preserves previously prepared backend repo records.
4. Frontend and backend engineers can prepare independently without per-repo task artifacts.

### Workflow: User Prepares Specific Tasks

1. User runs `/weave-prepare T2 T5`.
2. Weave reads only `T2` and `T5`.
3. Weave prepares the union of repos referenced by those tasks.

### Workflow: User Prepares All Task-Relevant Repos

1. User runs `/weave-prepare all`.
2. Weave reads every `T#` task in `tasks.md`.
3. Weave prepares every repo referenced by those tasks.
4. Registered repos not referenced by any `T#` task are not touched.

### Workflow: No-Argument Invocation

1. User runs `/weave-prepare`.
2. The skill reads tasks enough to identify available scopes and task ids.
3. The skill asks which selector to use.
4. The user chooses `all`, a scope, or task ids.
5. The skill invokes the matching CLI command.

## Functional Requirements

- Add `weave task prepare` as a CLI command.
- Add `/weave-prepare` as an agent/slash-command workflow.
- `weave task prepare` must support explicit task ids.
- `weave task prepare` must support multiple explicit task ids.
- `weave task prepare` must support `--scope <scope>`.
- `weave task prepare` must support `--all`.
- Scope matching must be case-insensitive.
- Prepare must be status-agnostic across selected `T#` tasks.
- Prepare must derive repos from selected tasks' `Primary repo` and `Repos` metadata.
- In workspace mode, prepare must stop and ask/report when selected task repo metadata is missing or ambiguous.
- In repo mode, prepare must default missing or ambiguous repo metadata to the repo root.
- In workspace mode, prepare must require artifact-root branch alignment with top-level `status.yml.branch`.
- Prepare must not auto-switch the artifact-root branch.
- Prepare must create missing sub-repo change branches from the repo's current clean branch.
- Prepare must checkout existing sub-repo change branches when the repo is clean.
- Prepare must allow dirty selected repos that are already on `status.yml.branch`.
- Prepare must stop before switching dirty selected repos that are not on `status.yml.branch`.
- Prepare must not stash, commit, discard, move, push, or open PRs.
- Prepare must record non-git selected repos/folders as `branch_status: skipped_not_git` and `state: skipped`.
- Prepare must persist per-repo readiness in `status.yml.execution.repos`.
- Prepare must preserve existing `execution.repos` records across different selectors.
- Prepare must treat `execution.branch != status.yml.branch` as stale readiness.
- Prepare must not persist dirty state.
- Prepare must not persist `last_prepare`.
- Prepare must not persist selector-specific preparation records.

## Acceptance Criteria

- [ ] `/weave-prepare` is available as an agent/slash-command workflow.
- [ ] `weave task prepare` is available as a CLI command.
- [ ] `/weave-prepare` with no arguments asks the user what to prepare and suggests scopes, task ids, and `all`.
- [ ] `weave task prepare T1 T3` prepares repos referenced by `T1` and `T3`.
- [ ] `weave task prepare --scope backend` prepares repos referenced by backend-scoped tasks using case-insensitive scope matching.
- [ ] `weave task prepare --all` prepares repos referenced by all `T#` tasks, not all registered repos.
- [ ] Prepare includes selected tasks regardless of task status.
- [ ] Repo mode defaults missing task repo metadata to the repo root.
- [ ] Workspace mode stops when selected task repo metadata is missing or ambiguous.
- [ ] Workspace mode stops when the artifact root branch does not match top-level `status.yml.branch`.
- [ ] Workspace mode creates a missing selected sub-repo change branch from the repo's current clean branch.
- [ ] Workspace mode checks out an existing selected sub-repo change branch when clean.
- [ ] Dirty selected repo already on expected branch succeeds without storing dirty state.
- [ ] Dirty selected repo on a different branch stops before branch movement.
- [ ] Non-git selected repo/folder records `state: skipped` and `branch_status: skipped_not_git`.
- [ ] `status.yml.execution.repos` stores `state`, `branch_status`, `prepared_at`, and `verified_at`.
- [ ] Re-running prepare for another selector preserves existing repo readiness records.
- [ ] `execution.branch != status.yml.branch` is treated as stale readiness.
- [ ] Prepare never commits, pushes, opens PRs, stashes, discards, or moves changes.

## Edge Cases

- **No `tasks.md` exists**: prepare should report that task metadata is unavailable and ask the user to run `weave-issues` first.
- **No matching task ids**: prepare should report missing task ids and avoid branch changes.
- **No scope matches**: prepare should report no matching scope tasks and avoid branch changes.
- **Task has `Repos: None` in workspace mode**: stop and ask if the selected task appears implementation-specific but has no repo mapping.
- **Task references an unknown workspace repo id**: stop and ask the user to fix task metadata or workspace registration.
- **Registered workspace repo path is missing**: stop and report the missing path.
- **Artifact root is not a git repo**: allow prepare to proceed where possible but report that artifact-root branch alignment could not be checked.
- **Selected implementation repo is not git**: record `skipped_not_git` and continue.
- **Branch exists but checkout fails**: stop and report the git failure.
- **Existing `execution.repos` contains repos not selected this run**: preserve those records.
- **Existing `execution.branch` differs from top-level `branch`**: treat readiness as stale and refresh for selected repos.
- **Scope label differs by case**: match case-insensitively and preserve original task labels in output.

## Rollout Considerations

This feature adds a new command and new optional `status.yml.execution` metadata. Existing changes without `execution` metadata remain valid.

No migration is required. `status.yml.execution` is created only when prepare runs.

Existing `tasks.md` files may lack repo metadata. In repo mode, prepare can still use the repo root. In workspace mode, users should regenerate or clarify tasks so selected tasks carry repo mapping.

## Open Questions

None for PRD scope. Future execution behavior, commit/push behavior, worktree mode, and remote branch publishing are intentionally deferred.

## Revision History

- 2026-06-07: Initial detailed PRD captured from task prepare exploration discussion.
