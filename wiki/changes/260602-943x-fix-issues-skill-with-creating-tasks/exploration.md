---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-01T19:03:35.384Z
updated_at: 2026-06-01T19:54:37.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Fix Issues Skill With Creating Tasks Md Locally

## Topic

Fix issues skill with creating tasks.md locally

## Current Understanding

`weave-issues` should produce local implementation task breakdowns in `wiki/changes/<change-id>/tasks.md` rather than publishing to an external issue tracker. The skill name and lifecycle lane remain `weave-issues` / `issues`; `tasks.md` is the durable local artifact for issue/task breakdown evidence.

The local workflow should preserve tracer-bullet or vertical-slice thinking, but it should be pragmatic about repository testing maturity. When a target repo has a usable test base, code-affecting tasks should include relevant automated test expectations. When no usable test base exists, missing automated tests should not block task generation; generated tasks should include explicit manual or smoke verification expectations instead.

`weave-issues` owns task breakdown structure, source-context reconciliation, status vocabulary, and verification expectations. Implementers own execution-time task status updates.

## Open Questions

- Exact `tasks.md` wording and section order for testing and verification still need to be finalized.
- The user may have additional `weave-issues` concerns before the full plan is locked.

## Decisions

- Keep `tasks.md` as the local file for issue/task breakdowns. Do not introduce `issues.md`.
- Keep `issues` as a lifecycle lane, not an artifact context.
- Make `weave-issues` local-only for outputs. It should not publish to, close, comment on, label, or otherwise mutate external issue trackers.
- External issue URLs, issue numbers, or paths may be used as source context when the user provides them, but output still goes to local `tasks.md`.
- Allow task generation from any sufficiently concrete plan or context, including PRD, architecture, implementation plan, spec, sessions, discussion, codebase findings, local paths, or external issue references.
- Record lifecycle progress for `issues` after successful local task creation or reconciliation using the actual sources that informed `tasks.md`.
- Always preview proposed `tasks.md` creation or reconciliation and wait for explicit user approval before writing.
- On rerun, `weave-issues` should read existing `tasks.md` and current source artifacts/context, then decide whether to update, refresh, add, or mark tasks invalid.
- Preserve existing task progress when prior tasks still map cleanly to the refreshed breakdown.
- Use `invalid` for tasks that no longer apply after source context changes; do not delete them.
- Remove `invalid` tasks from the active task index and place them in a separate invalid-tasks section with reasons.
- Do not make `weave-issues` the day-to-day status updater. Implementers update task statuses and acceptance checkboxes directly in `tasks.md`.
- `weave-issues` should inspect the target repo for existing test infrastructure before drafting tasks.
- Missing automated tests should not be a hard blocker for generating local tasks.
- If a usable test base exists, code-affecting vertical slices should include relevant automated test expectations and verification commands.
- If no usable test base exists, generated tasks should include explicit manual or smoke verification expectations.
- Frame the guidance as vertical-slice completeness, not strict test-first TDD.
- Add `not_tested` as local task-tracking vocabulary, but do not assign it to newly generated tasks.
- Implementers apply `not_tested` later when implementation appears complete but automated verification could not be completed.
- Newly generated tasks should start as `todo` unless a real blocker is already known.

## Scenarios

### Scenario: First Local Task Breakdown

A user runs `weave-issues` for a change with a concrete PRD, architecture, implementation plan, spec, or referenced issue context. The skill drafts vertical-slice tasks, quizzes the user on granularity and blockers, previews the local `tasks.md`, and writes it only after approval.

### Scenario: Existing Tasks Need Reconciliation

A user reruns `weave-issues` after source context changes. The skill reads existing `tasks.md`, preserves progress for tasks whose intent still maps cleanly, updates changed tasks, adds new tasks with new IDs, and marks obsolete tasks as `invalid` in a separate invalid-tasks section.

### Scenario: External Issue Reference As Input

A user passes an external issue URL or issue number. The skill reads that material as source context when available, then generates or reconciles local `tasks.md`. It does not mutate the external issue tracker.

### Scenario: Repo Has A Test Suite

A code-affecting task targets a repo with established test commands and conventions. The generated task includes relevant automated test expectations and the verification command an implementer should run.

### Scenario: Repo Has No Usable Test Suite

A code-affecting task targets a repo without usable automated test infrastructure. The generated task remains actionable and starts as `todo`, with explicit manual or smoke verification expectations. It is not marked `not_tested` until an implementer later determines that automated verification could not be completed.

## Existing Behavior

Current `weave-issues` guidance is tracker-oriented. It drafts vertical slices, asks the user to approve the breakdown, publishes issues to an external issue tracker, and then records lifecycle progress.

The current vertical-slice rule says each slice should cover all layers including tests, but it does not define behavior for repositories without an existing test suite.

Existing Weave lifecycle behavior already treats populated `tasks.md` as issue-breakdown evidence. Prior Weave context also records that `issues` is a lifecycle lane rather than a live artifact context.

## PRD Readiness

Ready for PRD.
