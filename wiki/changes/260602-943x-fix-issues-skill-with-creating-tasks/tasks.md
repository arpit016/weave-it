---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-01T20:10:31.000Z
updated_at: 2026-06-01T20:19:00.000Z
source: architecture.md
---

# Tasks: Fix Issues Skill With Creating `tasks.md` Locally

## Source Context

- PRD: `wiki/changes/260602-943x-fix-issues-skill-with-creating-tasks/prd.md`
- Architecture: `wiki/changes/260602-943x-fix-issues-skill-with-creating-tasks/architecture.md`
- Current skill template: `templates/skills/weave-issues/SKILL.md`
- Installed skill copies: `.agents/skills/weave-issues/SKILL.md`, `.claude/skills/weave-issues/SKILL.md`
- Opencode wrapper: `templates/opencode/commands/weave-issues.md`
- Docs/tests: `README.md`, `tests/agent-skills.test.ts`

## Local Tracking Status

External issue publishing status: not used. This change intentionally tracks implementation locally in this file.

## Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified
- `not_tested`: implementation appears complete, but automated verification could not be completed
- `invalid`: no longer applies after source context changed

## Active Task Index

| ID | Status | Type | Title | Blocked by |
| --- | --- | --- | --- | --- |
| T1 | done | AFK | Rewrite `weave-issues` around local `tasks.md` creation | None |
| T2 | done | AFK | Add reconciliation rules for existing `tasks.md` | T1 |
| T3 | done | AFK | Clarify source context and lifecycle progress | T1 |
| T4 | done | AFK | Add test-suite-aware verification guidance | T1 |
| T5 | done | AFK | Align installed surfaces, README, and skill tests | T1, T2, T3, T4 |

## T1: Rewrite `weave-issues` Around Local `tasks.md` Creation

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 1, 2, 7

### What to build

Revise the canonical `weave-issues` skill so its primary output is a preview-approved local task breakdown in `wiki/changes/<change-id>/tasks.md`, not external issue tracker publication.

The skill should keep the existing context-gathering and vertical-slice review flow, but replace tracker publishing with local task-file creation. It should define the canonical `tasks.md` shape, status vocabulary, initial `todo` status behavior, and completion response expectations.

### Acceptance Criteria

- [x] The canonical skill describes local `tasks.md` creation as the active workflow.
- [x] The skill no longer instructs agents to publish approved slices to an external issue tracker.
- [x] The skill requires preview and explicit user approval before writing `tasks.md`.
- [x] The skill defines the canonical `tasks.md` sections: frontmatter, source context, local tracking status, status legend, active task index, task details, invalid tasks, and verification.
- [x] The skill defines statuses `todo`, `in_progress`, `blocked`, `done`, `not_tested`, and `invalid`.
- [x] The skill states that newly generated tasks start as `todo` unless a real blocker is known.
- [x] The skill instructs agents not to create `issues.md`.

### Verification

- Automated tests: `npm run test`
- Manual check: inspected the revised skill text to confirm local task creation replaced tracker publishing.

## T2: Add Reconciliation Rules For Existing `tasks.md`

Status: done

Type: AFK

Blocked by: T1

User stories covered: 2, 3, 4

### What to build

Extend `weave-issues` guidance for reruns when `tasks.md` already exists. The skill should read the current task file and current source context, propose a reconciliation, preserve meaningful progress, and only write after user approval.

Obsolete tasks should be moved out of the active index and listed in an `Invalid Tasks` section with reasons. The skill should not delete obsolete history or reuse invalidated task IDs.

### Acceptance Criteria

- [x] The skill reads existing `tasks.md` before proposing changes on rerun.
- [x] The skill preserves statuses and checked acceptance criteria when task intent still maps cleanly.
- [x] The skill keeps stable IDs for unchanged task intent.
- [x] The skill assigns new IDs to new tasks.
- [x] The skill does not reuse invalidated task IDs.
- [x] The skill marks obsolete tasks as `invalid` instead of deleting them.
- [x] The skill removes invalid tasks from the active task index.
- [x] The skill lists invalid tasks in a separate section with reasons.
- [x] The skill requires preview and approval before writing reconciled `tasks.md`.

### Verification

- Automated tests: `npm run test`
- Manual check: reviewed the skill for clear first-run versus rerun behavior.

## T3: Clarify Source Context And Lifecycle Progress

Status: done

Type: AFK

Blocked by: T1

User stories covered: 5, 6

### What to build

Update `weave-issues` guidance so local paths and external issue references are treated as source context for `tasks.md`, not as tracker outputs or new lifecycle source IDs.

Lifecycle progress should use the existing Weave source ID set only: `exploration`, `prd`, `architecture`, `discussion`, `sessions`, and `codebase`. Concrete local paths or external references used during task generation should be recorded in the `tasks.md` source context section.

### Acceptance Criteria

- [x] The skill allows local paths and external issue references as source context.
- [x] The skill explicitly forbids publishing, closing, commenting on, labeling, or otherwise mutating external issue trackers.
- [x] The skill documents that concrete external/local references belong in `tasks.md` source context.
- [x] The skill does not introduce lifecycle sources such as `external`, `reference`, or `local_path`.
- [x] The skill calls `weave change progress issues` only with existing supported source IDs.
- [x] The skill explains how to choose sources based on the context that informed `tasks.md`.

### Verification

- Automated tests: `npm run test`
- Manual check: confirmed no external tracker mutation instructions remain.

## T4: Add Test-Suite-Aware Verification Guidance

Status: done

Type: AFK

Blocked by: T1

User stories covered: 7, 8

### What to build

Add verification guidance to `weave-issues` so generated tasks are appropriate for repositories with and without automated tests.

The skill should instruct agents to inspect repo test conventions before drafting verification expectations. If a usable test base exists, code-affecting tasks should include automated test expectations and commands. If no usable test base exists, tasks should include explicit manual or smoke checks. The `not_tested` status should be documented as implementer-applied after execution, not assigned during generation.

### Acceptance Criteria

- [x] The skill tells agents to inspect repo test commands, test folders, and existing test helpers.
- [x] The skill requires automated test expectations for code-affecting tasks when a usable test base exists.
- [x] The skill requires manual or smoke verification expectations when no usable test base exists.
- [x] The skill states missing tests should not block task generation by itself.
- [x] The skill does not require strict test-first TDD wording.
- [x] The skill defines `not_tested` as implementer-applied status vocabulary.
- [x] The skill explicitly says `weave-issues` should not assign `not_tested` to newly generated tasks.

### Verification

- Automated tests: `npm run test`
- Manual check: confirmed generated-task wording does not imply execution-time verification outcomes.

## T5: Align Installed Surfaces, README, And Skill Tests

Status: done

Type: AFK

Blocked by: T1, T2, T3, T4

User stories covered: 1, 2, 3, 4, 5, 6, 7, 8

### What to build

Propagate the revised `weave-issues` behavior to installed skill copies, opencode wrapper text, README descriptions/examples, and test assertions.

This slice should make shipped templates and repo-installed behavior match, while keeping installation and skill-discovery tests passing.

### Acceptance Criteria

- [x] `.agents/skills/weave-issues/SKILL.md` matches the canonical template.
- [x] `.claude/skills/weave-issues/SKILL.md` matches the canonical template.
- [x] `templates/opencode/commands/weave-issues.md` describes local task breakdown accurately.
- [x] README skill list describes `weave-issues` as local `tasks.md` task breakdown/reconciliation.
- [x] README examples no longer imply external issue publishing.
- [x] `tests/agent-skills.test.ts` asserts the updated local-only behavior.
- [x] Tests assert installed-copy and opencode wrapper alignment.
- [x] Tests no longer expect architecture-only progress guidance when the new skill text supports actual existing source IDs.

### Verification

- [x] `npm run test`
- [x] `npm run typecheck`
- [x] `npm run build`

## Invalid Tasks

None.

## Verification

- [x] `npm run test`
- [x] `npm run typecheck`
- [x] `npm run build`
