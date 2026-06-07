---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-07T09:18:07.000Z
updated_at: 2026-06-07T15:07:00.000Z
source: architecture
---

# Tasks: Task Prepare Workflow

## Source Context

- PRD: `wiki/changes/260607-eac5-task-prepare-workflow/prd.md`
- Architecture: `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md`
- Sessions: `wiki/changes/260607-eac5-task-prepare-workflow/sessions/20260607-085905-p7q4-exploration.md`, `wiki/changes/260607-eac5-task-prepare-workflow/sessions/20260607-085906-k8m2-prd.md`, `wiki/changes/260607-eac5-task-prepare-workflow/sessions/20260607-090657-c4n8-architecture.md`
- Codebase: `src/cli.ts`, `src/commands/change.ts`, `src/commands/artifact.ts`, `src/lib/changes.ts`, `src/lib/artifact-context.ts`, `src/lib/artifact-metadata.ts`, `src/lib/git.ts`, `src/lib/workspace-mode.ts`, `src/lib/workspace-repos.ts`, `src/lib/agent-skills.ts`, `templates/skills/*/SKILL.md`, `templates/opencode/commands/*.md`, `tests/changes.test.ts`, `tests/agent-skills.test.ts`, `tests/init.test.ts`
- External references: None
- Local references: None

## Coverage Review

PRD coverage:

- Covered: `/weave-prepare`, `weave task prepare`, task id/scope/all selectors, no-argument skill prompt, status-agnostic task selection, repo mode default-to-root behavior, workspace repo derivation, artifact-root branch alignment, branch creation/checkout safety, dirty/non-git handling, `status.yml.execution.repos` storage, stale readiness, and non-goals around execution/commit/push/PR/stash.

Architecture coverage:

- Covered: command/module layout, task parser, repo derivation, active change/mode resolution, two-phase preflight/apply, git helper additions, status writer rules, JSON result shape, skill/opencode packaging, existing change command boundaries, risks, and test plan.

PRD/Architecture sync:

- In sync: both artifacts define prepare as local branch readiness only, keep task selection derived from `tasks.md`, preserve top-level `status.yml.branch` as canonical, store readiness in `status.yml.execution.repos`, and defer execution/publish/worktree behavior.

Additional finding coverage:

- Covered: observed artifact context bug where `weave artifact current set architecture` stores `architecture.md` instead of folder-mode `architecture/index.md` after the architecture artifact is captured in folder mode. The `weave-architect` skill wording was also inspected and is not contradictory: it forbids repo-tracked artifact writes but explicitly allows setting local artifact lane session state.

## Local Tracking Status

External issue publishing status: not used. This change tracks implementation locally in this file.

## Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified
- `not_tested`: implementation appears complete, but automated verification could not be completed
- `invalid`: no longer applies after source context changed

## Active Task Index

| ID | Status | Type | Scope | Primary repo | Repos | Title | Blocked by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | done | AFK | cli | `weave-it` | `weave-it` | Resolve prepare selections from `tasks.md` | None |
| T2 | done | AFK | cli | `weave-it` | `weave-it` | Prepare repo-mode task branches | T1 |
| T3 | done | AFK | cli | `weave-it` | `weave-it` | Prepare workspace task repo branches safely | T1, T2 |
| T4 | done | AFK | cli | `weave-it` | `weave-it` | Expose `weave task prepare` command UX | T1, T2, T3 |
| T5 | done | AFK | agent | `weave-it` | `weave-it` | Add `/weave-prepare` skill and opencode wrapper | T4 |
| T6 | done | AFK | cli | `weave-it` | `weave-it` | Fix folder-mode architecture artifact context path | None |
| T7 | done | AFK | tests/docs | `weave-it` | `weave-it` | Lock prepare workflow with tests and knowledge | T1, T2, T3, T4, T5, T6 |

## T1: Resolve prepare selections from `tasks.md`

Status: done

Type: AFK

Scope: cli

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#task-parser`, `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#repo-derivation`

Coordination: Provides shared task parsing and repo derivation used by CLI and skill behavior.

Blocked by: None - can start immediately

User stories covered: backend engineer, frontend engineer, full-stack engineer, agent using `/weave-prepare`

Origin: none

Related finding: none

### What to build

Add `src/lib/tasks.ts` with parsing and selection behavior for prepare. It should parse `T#` detail sections from `tasks.md`, ignore `QF#` and `R#` sections for prepare v1, and expose selector helpers for explicit task ids, scope, and all.

The parser should extract at least task id, title, status, type, scope, primary repo, and repos. Scope matching should be case-insensitive while preserving the original task labels in returned summaries. Selection must be status-agnostic.

Repo derivation should union `Primary repo` and `Repos`, de-duplicate in stable order, and treat `None`, blanks, and non-concrete placeholders as absent values. It should not derive repo ids from `Repo Involvement` in v1.

### Acceptance Criteria

- [x] `src/lib/tasks.ts` parses `## T#: <title>` detail sections from `tasks.md`.
- [x] The parser extracts `Status`, `Type`, `Scope`, `Primary repo`, and `Repos` fields.
- [x] Explicit task id selection supports one or more ids and fails when any requested id is missing.
- [x] Scope selection matches `Scope` case-insensitively.
- [x] `all` selection returns all parsed `T#` tasks regardless of task status.
- [x] Repo derivation unions `Primary repo` and `Repos` with stable de-duplication.
- [x] `QF#` and `R#` entries are ignored as prepare targets.

### Verification

- Automated tests: `tests/tasks.test.ts`; covered parser extraction, explicit ids, missing ids, case-insensitive scope, all status-agnostic selection, stable repo derivation, and ignoring `QF#`/`R#` sections.
- Verification run: `npm run typecheck && npm test && npm run build` passed on 2026-06-07.

## T2: Prepare repo-mode task branches

Status: done

Type: AFK

Scope: cli

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#active-change-and-mode-resolution`, `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#status-storage-writer`

Coordination: Builds the single-repo path before workspace branch preparation reuses the same active-change and status writer flow.

Blocked by: T1

User stories covered: full-stack engineer, agent using `/weave-prepare`

Origin: none

Related finding: none

### What to build

Add the initial `src/lib/task-prepare.ts` behavior for repo mode. It should resolve the active change using the existing cwd-dispatched change model, verify that a git artifact root is on `status.yml.branch`, default missing or ambiguous task repo metadata to the repo root, and write root readiness under `status.yml.execution.repos`.

Expose or add a narrow active-change helper in `src/lib/changes.ts` so task prepare does not duplicate private change resolution logic. Keep this helper small and aligned with `currentChange` behavior.

Repo mode should block when the artifact root is a git repo with detached HEAD, unknown current branch, or a branch different from `status.yml.branch`. If the artifact root is not git, it may record skipped or report branch alignment could not be checked according to the architecture.

### Acceptance Criteria

- [x] Task prepare can resolve the active change and artifact root in repo mode.
- [x] Missing or ambiguous repo metadata defaults to the repo root in repo mode.
- [x] Artifact-root branch mismatch blocks prepare.
- [x] Detached HEAD or unknown current branch blocks prepare for git roots.
- [x] Successful repo-mode prepare writes `status.yml.execution.version`, `execution.branch`, and `execution.repos.root`.
- [x] Re-running repo-mode prepare preserves `prepared_at` and updates `verified_at`.

### Verification

- Automated tests: `tests/task-prepare.test.ts`; covered repo-mode root readiness, missing metadata defaulting to root, non-git skipped root, timestamp preservation, branch mismatch blocking, and no-matching-scope blocker behavior.
- Verification run: `npm run typecheck && npm test && npm run build` passed on 2026-06-07.

## T3: Prepare workspace task repo branches safely

Status: done

Type: AFK

Scope: cli

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#branch-preflight-and-apply-flow`, `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#git-helper-additions`, `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#status-storage-writer`

Coordination: Extends T2's prepare orchestration to workspace registered implementation repos.

Blocked by: T1, T2

User stories covered: backend engineer, frontend engineer, full-stack engineer, agent using `/weave-prepare`

Origin: none

Related finding: none

### What to build

Extend task prepare for workspace mode. It should read `.weave/workspace.yml`, resolve selected task repo ids to registered repo paths, require artifact-root branch alignment, and prepare only selected task-referenced repos.

Implement the two-phase preflight/apply algorithm. Preflight every selected repo before moving any branch. Block on missing paths, unknown repo ids, missing or ambiguous selected task repo metadata, dirty repos on a different branch, detached HEAD, or unknown current branch. Allow dirty repos already on `status.yml.branch` because no branch movement is needed.

Extend `src/lib/git.ts` with reusable helpers for current branch, dirty state, branch existence, checkout, branch creation, and current head. Non-git selected repos/folders should record `state: skipped` and `branch_status: skipped_not_git`.

### Acceptance Criteria

- [x] Workspace mode derives selected implementation repos from task metadata.
- [x] Workspace mode blocks when selected task repo metadata is missing or ambiguous.
- [x] Workspace mode blocks unknown workspace repo ids and missing registered paths.
- [x] Artifact-root branch mismatch blocks before implementation repo actions.
- [x] Preflight blocks all branch movement if any selected repo has a blocker.
- [x] Clean repos with missing change branches create `status.yml.branch` from the current branch.
- [x] Clean repos with existing change branches check out `status.yml.branch`.
- [x] Dirty repos already on `status.yml.branch` succeed without storing dirty state.
- [x] Dirty repos on other branches block before switching.
- [x] Detached HEAD or unknown current branch blocks for git repos.
- [x] Non-git selected repos/folders record `state: skipped` and `branch_status: skipped_not_git`.
- [x] Existing `execution.repos` records not selected in the current run are preserved when `execution.branch` matches top-level `branch`.
- [x] `execution.branch != status.yml.branch` is treated as stale readiness and selected repos are refreshed for the current branch.

### Verification

- Automated tests: `tests/task-prepare.test.ts`; covered workspace repo derivation, missing metadata blocking, branch creation, existing branch checkout, dirty expected-branch success, dirty other-branch blocking before movement, non-git skipped records, and preserving prior `execution.repos` entries.
- Verification run: `npm run typecheck && npm test && npm run build` passed on 2026-06-07.

## T4: Expose `weave task prepare` command UX

Status: done

Type: AFK

Scope: cli

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#cli-command-design`, `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#json-result-shape`

Coordination: Wraps the prepare library in the user-facing deterministic CLI.

Blocked by: T1, T2, T3

User stories covered: backend engineer, frontend engineer, full-stack engineer, agent using `/weave-prepare`

Origin: none

Related finding: none

### What to build

Add `src/commands/task.ts` and register it from `src/cli.ts`. The command should expose `weave task prepare T1 T3`, `weave task prepare --scope backend`, `weave task prepare --all`, and `--json`.

Validate selector modes strictly: exactly one selector mode is required, explicit task ids cannot be combined with `--scope` or `--all`, and `--scope` cannot be combined with `--all`. No-argument CLI usage should return a deterministic helpful error instead of prompting.

Return text and JSON summaries that include the active change, selector, selected tasks, selected repos, per-repo branch actions, skipped non-git repos, and blockers. Blockers should produce a non-zero CLI exit through the repo's existing command error pattern.

### Acceptance Criteria

- [x] `weave task prepare T1 T3` is registered and invokes task id selection.
- [x] `weave task prepare --scope backend` is registered and invokes scope selection.
- [x] `weave task prepare --all` is registered and invokes all selection.
- [x] Invalid selector combinations fail with clear errors.
- [x] No-argument CLI usage fails with a clear selector message.
- [x] `--json` returns selected tasks, repos, branch actions, skipped entries, and blockers.
- [x] Text output is concise and useful for users.
- [x] `src/cli.ts` registers `taskCommand()`.

### Verification

- Automated tests: `tests/task-prepare.test.ts`; covered `weave task prepare --help`, no-selector JSON error, JSON result shape through library calls, and registered selector options.
- Verification run: `npm run typecheck && npm test && npm run build` passed on 2026-06-07.

## T5: Add `/weave-prepare` skill and opencode wrapper

Status: done

Type: AFK

Scope: agent

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#/weave-prepare-skill`

Coordination: Depends on CLI UX so the skill can delegate deterministic behavior to the command.

Blocked by: T4

User stories covered: agent using `/weave-prepare`, backend engineer, frontend engineer, full-stack engineer

Origin: none

Related finding: none

### What to build

Add the canonical `templates/skills/weave-prepare/SKILL.md` and opencode wrapper `templates/opencode/commands/weave-prepare.md`. The skill should resolve the active change, read `tasks.md` when needed for no-argument suggestions, map arguments to the correct CLI selector, invoke `weave task prepare ... --json`, and summarize prepared, skipped, or blocked repos.

The no-argument skill flow should ask the user what to prepare and suggest available scopes, task ids, and `all`. The skill must explicitly state that prepare does not implement, verify, commit, push, open PRs, stash, discard, or move dirty changes.

Update checked-in installed copies if this repo expects them to remain present and aligned.

### Acceptance Criteria

- [x] `templates/skills/weave-prepare/SKILL.md` exists with correct frontmatter and workflow.
- [x] The skill maps `all` to `weave task prepare --all --json`.
- [x] The skill maps task ids such as `T1 T3` to `weave task prepare T1 T3 --json`.
- [x] The skill maps a single non-task, non-`all` argument to `weave task prepare --scope <value> --json`.
- [x] The skill asks for a selector when invoked without arguments and suggests scopes, task ids, and `all`.
- [x] `templates/opencode/commands/weave-prepare.md` exists and loads the `weave-prepare` skill.
- [x] Installed checked-in copies are added or updated if required by repository conventions.

### Verification

- Automated tests: `tests/agent-skills.test.ts`; covered bundled `weave-prepare` skill content, checked-in installed copies, opencode wrapper installation, manifest entries, and command wrapper content.
- Verification run: `npm run typecheck && npm test && npm run build` passed on 2026-06-07.

## T6: Fix folder-mode architecture artifact context path

Status: done

Type: AFK

Scope: cli

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md`

Coordination: Fixes a related architecture-lane routing defect observed while capturing this change.

Blocked by: None - can start immediately

User stories covered: agent using `/weave-prepare`, maintainers using `weave-architect`

Origin: qa_finding

Related finding: QF1

### What to build

Fix artifact context path resolution so `weave artifact current set architecture` records the actual folder-mode architecture entry point when `architecture/index.md` exists.

The current implementation in `src/lib/artifact-context.ts` uses `artifactFileName("architecture")`, which always resolves to `architecture.md`. That makes the active artifact path misleading after `weave-capture` creates folder-mode architecture at `architecture/index.md`.

The fix should preserve existing behavior for exploration and PRD. For architecture, prefer `wiki/changes/<change-id>/architecture/index.md` when it exists, otherwise fall back to `wiki/changes/<change-id>/architecture.md` or the existing default path as appropriate. Align tests with folder-mode architecture behavior.

Do not change the `weave-architect` skill wording unless implementation discovers a real mismatch. The canonical and installed skill copies already say that `weave artifact current set architecture --json` writes local Weave session state only and is allowed despite the skill's repo-tracked artifact read-only constraint.

### Acceptance Criteria

- [x] `weave artifact current set architecture --json` stores `architecture/index.md` when folder-mode architecture exists.
- [x] Legacy `architecture.md` remains supported when folder mode does not exist.
- [x] Exploration and PRD artifact context paths are unchanged.
- [x] The current artifact output no longer reports `architecture.md` for a folder-mode architecture change.
- [x] Tests cover folder-mode and legacy architecture artifact context paths.
- [x] `weave-architect` skill wording is left unchanged or only clarified if implementation discovers an actual contradiction.

### Verification

- Automated tests: `tests/changes.test.ts`; covered folder-mode architecture context storing `architecture/index.md` and legacy mode storing `architecture.md`.
- Verification run: `npm run typecheck && npm test && npm run build` passed on 2026-06-07.

## T7: Lock prepare workflow with tests and knowledge

Status: done

Type: AFK

Scope: tests/docs

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md#test-plan`

Coordination: Final cross-cutting verification and durable knowledge update after implementation slices land.

Blocked by: T1, T2, T3, T4, T5, T6

User stories covered: backend engineer, frontend engineer, full-stack engineer, agent using `/weave-prepare`, future execution agent

Origin: none

Related finding: none

### What to build

Complete the test suite and current-state knowledge update for the prepare workflow. This task should consolidate any remaining behavior assertions not covered in earlier slices and update knowledge docs so future agents understand `weave task prepare`, `/weave-prepare`, repo/workspace mode differences, and `status.yml.execution.repos` semantics.

Run the repository's standard verification commands and record results in this task's verification notes during implementation.

### Acceptance Criteria

- [x] Parser, repo mode, workspace mode, branch safety, status storage, CLI UX, skill packaging, and artifact-context bug coverage are all represented in tests.
- [x] Current-state knowledge documents the prepare workflow and non-goals.
- [x] Knowledge delta for this change records durable behavior changes and source evidence.
- [x] `npm run typecheck` passes.
- [x] `npm test` passes.
- [x] `npm run build` passes or any failure is documented with cause.
- [x] `weave change knowledge updated` or equivalent knowledge freshness command is run after the knowledge update.

### Verification

- Automated tests: `npm run typecheck`, `npm test`, and `npm run build` passed on 2026-06-07.
- Knowledge update: wrote `wiki/changes/260607-eac5-task-prepare-workflow/knowledge-delta.md`, updated `wiki/knowledge/domains/change-workflow/features/weave-prepare/behavior.md`, related knowledge indexes, and marked knowledge `updated` with `weave change knowledge updated`.

## QA Findings

Finding Status Legend:

- `new`: reported but not yet triaged
- `accepted`: triaged and accepted as a real defect
- `fixed`: implementation believed to address the defect
- `verified`: fix confirmed by re-test
- `duplicate`: already covered by another finding
- `not_reproducible`: could not be reproduced
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |
| QF1 | verified | medium | user/code inspection | T6 | `weave artifact current set architecture` records `architecture.md` even when folder-mode architecture uses `architecture/index.md`. |

## QF1: Folder-mode architecture artifact context path is wrong

Status: verified

Severity: medium

Source: user report and code inspection

Related Task: T6

### Observed Behavior

After folder-mode architecture was created for this change, `weave artifact current set architecture --json` reported:

```text
Path: wiki/changes/260607-eac5-task-prepare-workflow/architecture.md
```

The live artifact is actually:

```text
wiki/changes/260607-eac5-task-prepare-workflow/architecture/index.md
```

### Expected Behavior

The active artifact context should point to the actual architecture entry point when folder mode exists.

### Reproduction

1. Create or capture folder-mode architecture at `architecture/index.md`.
2. Run `weave artifact current set architecture --json`.
3. Inspect the reported/stored path.

### Artifact Impact

This can mislead skills that rely on the active artifact path while still setting the lane to `architecture`.

### Skill Wording Check

The canonical `templates/skills/weave-architect/SKILL.md` and installed copies under `.agents/` and `.claude/` are not contradictory. They describe `weave-architect` as read-only for repo-tracked artifacts, then explicitly state that `weave artifact current set architecture --json` writes local Weave session state only and is allowed.

## Refactors

Refactor Status Legend:

- `proposed`: identified but not yet accepted
- `accepted`: agreed to do as part of this change
- `deferred`: logged for later; no `T#` yet
- `done`: completed and verified behavior-preserving
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Invalid Tasks

None.

## Verification

- `npm run typecheck` passed.
- `npm test` passed: 15 test files, 184 tests.
- `npm run build` passed.
