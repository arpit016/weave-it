# weave-prepare

## Purpose

`weave-prepare` and `weave task prepare` prepare local branches for implementation tasks in an active Weave change. The workflow bridges the canonical `tasks.md` artifact to implementation repo branch readiness, especially in workspace mode where the artifact root and implementation repos are different git checkouts.

## Current Behavior

The deterministic CLI surface is:

```bash
weave task prepare T1 T3 [--json]
weave task prepare --scope <scope> [--json]
weave task prepare --all [--json]
```

The opencode slash wrapper `/weave-prepare` loads the `weave-prepare` skill. The skill resolves the active Weave context, asks for a selector when invoked without arguments, maps user intent to exactly one CLI invocation, and summarizes prepared, skipped, or blocked repos.

Prepare is branch-readiness-only. It does not implement tasks, run verification, update task statuses, commit, push, open PRs, stash, discard changes, or create remote branches.

## Domain Model

Selection modes:

- explicit task ids: `T1`, `T1 T3`
- scope: `--scope backend`, matched case-insensitively against each task's `Scope`
- all: `--all`, meaning all parsed `T#` tasks in `tasks.md`

Task parsing uses `## T#: <title>` detail sections in `wiki/changes/<change-id>/tasks.md`. It extracts `Status`, `Type`, `Scope`, `Primary repo`, and `Repos`. It ignores `QF#` QA findings and `R#` refactor entries as prepare targets.

Repo derivation uses the stable union of `Primary repo` and comma-separated `Repos`. `None`, blank values, `n/a`, `not applicable`, and `-` are ignored. `Repo Involvement` remains guidance only and is not used for branch preparation.

## Behavioral Rules

- Exactly one selector mode is required at the CLI. Invalid combinations and no-argument CLI usage fail with a clear error.
- Selection is status-agnostic. Tasks with statuses such as `todo`, `done`, `not_tested`, or `invalid` are still eligible when selected.
- A missing explicit task id fails before branch changes.
- A scope with no matching tasks reports a blocker and avoids branch changes.
- In repo mode, selected tasks map to synthetic repo id `root` at path `.`. Missing or ambiguous repo metadata defaults to the repo root.
- In workspace mode, selected tasks must name concrete registered repo ids. Missing task repo metadata, unknown repo ids, and missing registered paths block prepare.
- `status.yml.branch` is the canonical desired branch. `status.yml.execution.branch` is a readiness snapshot and is stale if it differs from top-level `branch`.
- Prepare uses a two-phase preflight/apply flow. If any selected repo has a blocker, no selected repo branch is moved.
- A git repo already on the expected branch succeeds even when dirty because no branch movement is needed.
- A dirty git repo on another branch blocks. Prepare never stashes, commits, discards, or force-checkouts dirty work.
- Clean git repos checkout the expected branch if it exists locally, or create it from the current branch if it is missing.
- Detached HEAD or unknown current branch blocks for git repos.
- Non-git selected repos/folders succeed with `state: skipped` and `branch_status: skipped_not_git`.

## Status Storage

Successful prepare writes durable branch readiness under `wiki/changes/<change-id>/status.yml`:

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

Re-running prepare for a repo on the same branch preserves `prepared_at`, refreshes `verified_at`, updates `prepared_head` when available, and preserves unrelated `execution.repos` entries from other prepare selections. Prepare does not store dirty state, selector-specific preparation history, or `last_prepare`.

## Integrations And Side Effects

- `src/commands/task.ts` exposes the `weave task prepare` command group.
- `src/lib/tasks.ts` parses and selects `T#` tasks.
- `src/lib/task-prepare.ts` orchestrates active change resolution, workspace repo lookup, git preflight/apply, and `status.yml.execution` writes.
- `templates/skills/weave-prepare/SKILL.md` and `templates/opencode/commands/weave-prepare.md` provide agent and slash-command UX.
- `weave change new` and `weave change switch` remain scoped to the resolved artifact root; they do not prepare workspace implementation repos.

## Source Anchors

- CLI command: `src/commands/task.ts`
- Task parsing: `src/lib/tasks.ts`
- Prepare orchestration and storage: `src/lib/task-prepare.ts`
- Git helpers: `src/lib/git.ts`
- Active change context helper: `src/lib/changes.ts` (`activeChangeContext`)
- Skill and wrapper: `templates/skills/weave-prepare/SKILL.md`, `templates/opencode/commands/weave-prepare.md`
- Installed copies: `.agents/skills/weave-prepare/SKILL.md`, `.claude/skills/weave-prepare/SKILL.md`, `.opencode/commands/weave-prepare.md`
- Tests: `tests/tasks.test.ts`, `tests/task-prepare.test.ts`, `tests/agent-skills.test.ts`

## Change History

- 2026-06-07 (change `260607-eac5-task-prepare-workflow`): introduced `weave task prepare` and `/weave-prepare`, task selector parsing, repo/workspace branch safety, two-phase preflight/apply, non-git skipped records, durable `status.yml.execution.repos` readiness storage, and packaging tests.

## Open Questions

- Future task execution, publish, remote branch creation, and PR workflows remain out of scope.
