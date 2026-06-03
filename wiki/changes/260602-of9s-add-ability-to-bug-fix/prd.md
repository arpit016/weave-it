---
artifact: prd
status: draft
owner: product
created_at: 2026-06-02T15:30:00.000Z
updated_at: 2026-06-02T15:30:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Bug Fix Workflow PRD

## Problem Statement

Weave users need a clear way to handle bugs without forcing every bug through the full exploration -> PRD -> architecture -> issues pipeline.

Two common situations are being conflated today:

- A QA bug found while a feature is still in development.
- A bug reported after release or after enough time has passed that current behavior may have changed.

The current flow does not distinguish these cases clearly enough. Active-change bugs can get blended into planned work, while later bugs risk being treated like fresh feature discovery even though the right input is current state, not old history. That creates unnecessary ceremony, makes the wrong artifact feel authoritative, and slows down support, QA, PM, and engineering collaboration.

## Goals

- Distinguish active-change QA bugs from post-release or old-context bugs.
- Keep active QA bugs inside the active change and track them explicitly.
- Allow post-release bugs to start as standalone fix changes without requiring exploration by default.
- Make the first artifact for fix changes the right one for diagnosis and implementation.
- Preserve current behavior for feature-style changes.
- Make it obvious which skill to use for each bug scenario.

## Non-Goals

- Do not add a new dedicated bug-investigation skill.
- Do not add a new artifact type.
- Do not require every bug to produce exploration, PRD, architecture, and tasks.
- Do not model parent/child subchanges for active bugs in v1.
- Do not change the meaning of historical change artifacts as provenance.

## Actors

- QA, support, or PM user reporting a bug.
- Engineering user diagnosing and fixing a bug.
- Agent using `weave-issues`, `weave-architect`, `weave-prd`, `weave-explore`, `weave-next`, `weave-new`, `weave-clarify`, and `weave-knowledge`.
- Existing change as historical provenance.

## Current Behavior

Today, `weave change new` scaffolds a new change as if it were a feature exploration:

- `status.yml`
- `exploration.md`
- `sessions/`

It also starts the change at `stage: exploration` and makes exploration the current artifact context.

That works for feature discovery, but it creates the wrong default for fix work. For post-release bugs, the user often already has enough symptom context to start diagnosis or implementation, and scaffolding exploration makes it look like product discovery is the first required step.

Current skill behavior already has some of the right building blocks:

- `weave-issues` owns local `tasks.md` creation and reconciliation.
- `weave-prd` and `weave-architect` do not require upstream artifacts when their context is sufficient.
- `weave-next` is already type-aware, but its generic exploration-first fallback does not fit standalone fixes.
- `weave-knowledge` already supports durable behavior updates and no-impact closure.

## Proposed Product Behavior

Weave should support two bug workflows:

1. Active-change QA bugs stay inside the active change and are tracked in `tasks.md` as QA findings.
2. Post-release or old-context bugs become standalone `type: fix` changes that start from current truth.

For non-feature changes:

- `weave change new --type <non-feature>` should create `status.yml` and `sessions/`, but not default `exploration.md`.
- The initial `status.yml.stage` should be `started`, meaning the change exists but no durable artifact lane has been reached yet.
- The first real artifact should be created by the skill that fits the work: `weave-architect`, `weave-issues`, or `weave-prd` if expected behavior is unclear.
- `weave change new --type fix` should use a fix-oriented RCA template in `weave-architect` with sections such as Bug Context, Observed Behavior, Expected Behavior, Reproduction, Root Cause Analysis, Investigation Plan, Affected Systems, Fix Strategy, Regression Tests, Risks And Rollout, and Open Technical Questions.

For active QA bugs:

- `weave-issues` should capture the bug as a QA finding inside `tasks.md`.
- Implementation tasks should remain normal `T#` tasks and can link back to a `QF#` finding.
- If the bug changes product behavior, users should update the PRD or exploration.
- If the bug changes technical design, users should update architecture.

## User Workflows

### Workflow: QA finds a bug in an active change

1. QA or PM reports the bug against the active change.
2. User runs `weave-issues` with the bug context.
3. System records a QA finding in `tasks.md`.
4. If needed, system creates or links a normal implementation task.
5. If the bug changes expected behavior, user runs `weave-clarify prd` or `weave-explore`.
6. If the bug changes technical approach, user runs `weave-clarify architecture` or `weave-architect`.

### Workflow: Support, PM, or QA reports a bug after release

1. User starts a standalone fix with `weave-new "<bug title>" --type fix`.
2. System creates a change with `status.yml`, `sessions/`, and `stage: started`.
3. User runs `weave-architect` with the symptom, repro, and context.
4. System records RCA or investigation notes in `architecture.md`.
5. User runs `weave-issues` to break the fix into local tasks.
6. User runs `weave-knowledge` after implementation to record durable behavior change or no-impact closure.

### Workflow: A post-release bug has unclear expected behavior

1. User starts a standalone fix with `weave-new --type fix`.
2. User runs `weave-prd` or `weave-explore` only if the bug changes or clarifies expected behavior.
3. User runs `weave-architect` if technical diagnosis is still needed.
4. User runs `weave-issues` after the desired behavior and fix approach are clear.

## User Stories

1. As a QA user, I want active-change bugs recorded as QA findings, so that they stay visible without creating a separate change.
2. As a PM or support user, I want to report an old bug as a standalone fix change, so that I do not reopen stale feature artifacts.
3. As an engineer, I want post-release bugs to start from current truth, so that I can diagnose the current system instead of relying on old history.
4. As an engineer, I want root cause analysis to live in architecture for fix work, so that the diagnosis and fix strategy are preserved in one place.
5. As a user, I want `weave-next` to route me to the right skill for fix work, so that I do not have to guess the workflow.
6. As a user, I want fix changes to avoid scaffold-only exploration by default, so that bug work starts with the artifact that is actually needed.
7. As a user, I want durable behavior changes to be reflected in current knowledge after a fix, so that future work uses current truth.

## Functional Requirements

- The system should distinguish active QA bugs from post-release or old-context bugs.
- The system should allow active QA bugs to be recorded in `tasks.md` as QA findings.
- The system should allow standalone non-feature changes to start without `exploration.md`.
- The system should set `status.yml.stage` to `started` for non-feature changes that have not reached a durable artifact lane.
- The system should not treat `started` as an artifact lane.
- The system should let `weave-architect` own RCA and investigation for fix changes.
- The system should let `weave-issues` own implementation task breakdown for fix changes.
- The system should let `weave-prd` and `weave-explore` participate only when a bug changes or clarifies expected behavior.
- The system should let `weave-knowledge` close the loop after a bug fix.
- The system should keep feature-style change behavior intact.

## Permissions and Access Control

No new permissions model is required.

Any user who can work on the active change can report active QA bugs, start fix changes, and use the relevant Weave skills to update the appropriate artifacts.

## States and Lifecycle

Relevant stages:

- `started`: the change exists, but no durable artifact lane has been reached yet.
- `exploration`: exploration is the first durable lane for feature-style changes.
- `prd`: product requirements have been established or revised.
- `architecture`: diagnosis, RCA, or engineering design has been established or revised.
- `issues`: local implementation tasks have been established or revised.

For non-feature changes:

- `started -> architecture` when the fix work is first captured as diagnosis or RCA.
- `started -> prd` when the bug changes or clarifies expected behavior.
- `started -> issues` when the fix is obvious enough to go straight to task breakdown.

Invalid transition:

- `started` should not be treated as `exploration`.

For active QA bugs inside an in-flight change:

- The active change stays active.
- QA findings may accumulate in `tasks.md`.
- Upstream artifacts are updated only if the bug changes product or technical decisions.

## Notifications and Visibility

Users should see clear guidance about which skill to use:

- `weave-issues` for active QA findings and implementation tasks.
- `weave-architect` for post-release bug diagnosis and RCA.
- `weave-prd` or `weave-explore` only when the bug changes expected behavior or scope.
- `weave-knowledge` after a fix is implemented.

Status output should make `started` visible so users understand that a fix change exists even before a durable artifact lane has been reached.

## Edge Cases

- A bug is reported against an active change but actually changes product behavior.
- A bug is reported against an active change but actually invalidates technical design.
- A post-release bug is obvious enough that it can skip exploration and PRD.
- A post-release bug has unclear expected behavior and needs PRD or exploration before architecture.
- A post-release bug is purely a defect with no durable behavior impact and should end in `weave-knowledge none`.
- Existing feature changes continue to scaffold `exploration.md` and start at `stage: exploration`.
- Older changes without `started` remain readable.

## Acceptance Criteria

- [ ] Active QA bugs can be recorded in `tasks.md` as QA findings.
- [ ] Active QA bugs can link to normal implementation tasks.
- [ ] Post-release bugs can start as standalone non-feature changes.
- [ ] Non-feature changes do not scaffold `exploration.md` by default.
- [ ] Non-feature changes start at `stage: started`.
- [ ] `weave-architect` can be the first real artifact for a non-feature change.
- [ ] `weave-issues` can be the first real artifact for a non-feature change when the bug is already clear.
- [ ] `weave-prd` and `weave-explore` remain available only when expected behavior is unclear.
- [ ] `weave-knowledge` can record durable behavior change or no-impact closure after a fix.
- [ ] Existing feature-style change behavior remains unchanged.

## Rollout Considerations

This should be backward compatible for existing feature changes.

The main rollout concern is user guidance:

- docs and skill contracts should explain when to use each skill for active QA bugs versus post-release bugs
- examples should show the difference between `weave-issues` QA findings and standalone `fix` changes
- users should understand `started` as a valid non-artifact stage for non-feature changes

No migration or backfill is required for existing change folders.

## Analytics and Success Metrics

Success can be judged qualitatively by:

- fewer post-release bugs being routed through unnecessary exploration
- clearer separation between active QA findings and standalone fix changes
- fewer cases where exploration scaffolding misleads users on fix work
- better use of `weave-architect` for RCA and `weave-issues` for implementation tasks
- fewer support or QA bug reports needing manual clarification about which skill to use

## Revision History

- 2026-06-02: Initial PRD generated from `exploration.md` and session captures.
- 2026-06-02: Clarified that `stage: started` applies to all non-feature change types and that `weave-architect` should use a fix-oriented RCA template for `type: fix`.

## Assumptions

- `stage: started` applies to every non-feature change type, including `fix`, `refactor`, `docs`, `test`, `ci`, and `chore`.
- No new dedicated bug-investigation skill is introduced in v1.
- No new artifact type is introduced.
- Old feature artifacts remain provenance, not current truth, for post-release bugs.
- “Skill template within the PRD” means user-facing workflow guidance and invocation examples, not a literal copy of agent skill files.

## Open Questions

- What exact shape should the `tasks.md` QA Findings section take?
- What exact shape should fix-oriented `architecture.md` take?
- Should documentation include separate examples for CS-reported, PM-reported, and QA-reported old bugs?

## Out of Scope

- A new `weave-investigate` skill.
- A parent/child change model for active QA bugs.
- A new artifact type for bugs.
- External issue tracker publishing.
- A migration of existing historical changes to the new fix workflow.

## Further Notes

The bug workflow should be easy to explain in one sentence:

Active QA bug: `weave-issues`.

Old bug: `weave-new --type fix`, then `weave-architect`, then `weave-issues`, then `weave-knowledge`.

For fix work, `weave-architect` should capture the bug context and RCA using the fix-oriented sections rather than a feature-style architecture template.
