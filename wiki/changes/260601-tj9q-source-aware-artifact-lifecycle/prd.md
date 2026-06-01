---
artifact: prd
status: draft
owner: product
created_at: 2026-06-01T14:38:25.000Z
updated_at: 2026-06-01T14:38:25.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Source-Aware Artifact Lifecycle PRD

## Problem Statement

Weave currently models change artifacts as a mostly linear pipeline: exploration, PRD, architecture, then issues. That works for feature changes where product discovery naturally precedes technical design, but it is too rigid for bug fixes, refactors, tech debt, docs, tests, CI, chores, and other changes where a PRD is often unnecessary.

Users need to create the artifact that matches the work they are doing. For many technical changes, `architecture.md` or issue/task planning is the useful artifact, while forcing `exploration.md` or `prd.md` first adds ceremony and can produce low-value documents.

The same linear assumption also affects lifecycle status. Today, later artifact evidence implies earlier lanes were reached, so direct architecture creation implies PRD and exploration. Stale tracking also marks downstream lanes stale by fixed order rather than by actual artifact dependencies. Once artifacts are independently creatable, this can produce misleading status and stale recommendations.

## Goals

- Allow PRD and architecture artifacts to be created independently.
- Keep the full exploration-to-PRD-to-architecture flow available for feature-style work.
- Make change type influence recommended artifacts and next steps.
- Make stale tracking depend on actual artifact sources, not fixed lane order.
- Preserve backward compatibility for existing `source` metadata.
- Add structured `status.yml.artifacts` source metadata for dependency-aware lifecycle behavior.
- Keep Weave lighter than a full per-stage state machine.

## Non-Goals

- Do not require every change to produce every artifact.
- Do not remove existing artifact frontmatter review fields.
- Do not make manual file edits deterministically update lifecycle state in v1.
- Do not require PRD for bug fixes, refactors, tech debt, docs, tests, CI, or chores.
- Do not make downstream artifacts stale merely because an earlier lane exists or changed.

## Actors

- Weave user: chooses the artifact lane that fits the change.
- Product-oriented agent: creates or revises exploration and PRD artifacts.
- Engineering-oriented agent: creates or revises architecture and issue/task artifacts.
- Returning user or agent: uses status, artifact metadata, and `weave-next` to decide what to do next.

## Current Behavior

`weave-prd` requires usable `exploration.md`. If exploration is missing, blank, scaffold-only, or marked not ready, it stops and asks the user to run exploration first.

`weave-architect` requires `prd.md`. If PRD is missing or too incomplete, it stops and asks the user to revisit PRD first.

`weave-capture` artifact mode creates missing `prd.md` only from usable exploration and missing `architecture.md` only from usable PRD.

`weave-next` recommends forward progress using fixed pipeline rules.

`weave change progress` uses lane order for lifecycle behavior. It treats `stage` as the highest reached lane and uses downstream lane order to mark stale lanes. It also infers reached lanes from artifact evidence, so `architecture.md` implies PRD and exploration have been reached.

## Proposed Product Behavior

Weave should treat exploration, PRD, architecture, and issues as independent but related artifact lanes.

The full pipeline remains the recommended path when it fits the change, especially for feature work with uncertain product behavior. It should not be a universal prerequisite chain.

PRD creation should use `exploration.md` when available. If exploration is missing or thin, `weave-prd` should use same-lane session notes, current discussion, and product interview questions until the PRD can stand alone.

Architecture creation should use `prd.md` when available. If PRD is missing or thin, `weave-architect` should use architecture session notes, current discussion, codebase inspection, and technical interview questions until the architecture can stand alone.

Change status should record source dependencies:

```yaml
artifacts:
  architecture:
    sources:
      - prd
      - codebase
```

Artifact frontmatter `source` remains a backward-compatible display field. `status.yml.artifacts.<lane>.sources` becomes the structured list used by lifecycle logic. Artifact sources such as `exploration`, `prd`, and `architecture` should appear only when the artifact actually depended on that lane. External sources such as `discussion`, `sessions`, and `codebase` can record direct creation context.

Stale tracking should be source-aware. If status metadata records architecture sources including `prd`, then PRD changes can mark architecture stale. If architecture was created directly from discussion and codebase, later PRD changes should not stale architecture.

## User Workflows

### Workflow: Feature Uses The Full Pipeline

1. User starts a feature change.
2. User runs exploration to clarify product behavior.
3. User creates PRD from exploration.
4. User creates architecture from PRD and codebase context.
5. System records sources so PRD-backed architecture can become stale if PRD changes.

### Workflow: Bug Fix Starts With Architecture

1. User starts a bug fix.
2. User skips PRD because the work is technical diagnosis and implementation approach.
3. User runs `weave-architect`.
4. System creates `architecture.md` from current discussion, architecture sessions, codebase inspection, and interview.
5. `status.yml.artifacts.architecture.sources` records sources such as `discussion`, `sessions`, and `codebase`.
6. Later PRD creation or revision does not mark this architecture stale unless architecture sources include `prd`.

### Workflow: Refactor Or Tech Debt Skips Product Artifacts

1. User starts a refactor or tech-debt change with no intended product behavior change.
2. `weave-next` recommends architecture or issues based on existing context.
3. User creates architecture or task breakdown without being forced through PRD.
4. System preserves status as orientation but does not imply skipped upstream artifacts exist.

### Workflow: Source-Backed Staleness

1. User creates architecture from PRD with status sources `[prd, codebase]`.
2. User later revises PRD.
3. System marks architecture stale because architecture declared PRD as a source.
4. `weave-next` recommends refreshing architecture before implementation work.

### Workflow: Issue Evidence Depends On Architecture

1. User creates issues or `tasks.md` from architecture.
2. User later revises architecture.
3. System marks issue/task evidence stale.
4. Issue generation or implementation handoff warns the user before proceeding from stale work.

## User Stories

1. As a Weave user working on a feature, I want the full artifact pipeline to remain available, so that product and technical work can be sequenced when that is useful.
2. As a Weave user fixing a bug, I want to create architecture without PRD, so that I can capture technical diagnosis without product ceremony.
3. As a Weave user doing a refactor, I want PRD to be optional, so that I can document technical direction without inventing product requirements.
4. As a returning user, I want `weave-next` recommendations to account for change type, so that I see the most useful next artifact rather than a generic pipeline step.
5. As an agent, I want artifact sources to be explicit, so that I can decide whether one artifact depends on another.
6. As a user revising an artifact, I want only actual dependents marked stale, so that unrelated artifacts are not treated as invalid.
7. As a maintainer, I want existing artifacts with only `source` to keep working, so that old changes are not broken by the new metadata.

## Functional Requirements

- The system should allow `prd.md` creation when `exploration.md` is missing or not usable.
- The system should allow `architecture.md` creation when `prd.md` is missing or not usable.
- `weave-prd` should prefer `exploration.md` when it exists and is useful.
- `weave-prd` should interview when product context is insufficient to create a standalone PRD.
- `weave-architect` should prefer `prd.md` when it exists and is useful.
- `weave-architect` should use architecture sessions, current discussion, codebase context, and interview when PRD context is insufficient.
- `weave-capture` artifact mode should be able to create missing PRD or architecture artifacts without upstream prerequisites when enough lane-relevant context exists.
- New or revised artifacts should update the structured source graph in `status.yml.artifacts`.
- Existing `source` metadata should remain valid.
- Lifecycle stale marking should use actual artifact source dependencies.
- Direct architecture created without PRD should not imply PRD was reached.
- Direct architecture created without PRD should not become stale merely because PRD changes later.
- Architecture with status sources including `prd` should become stale when PRD changes.
- Issue/task evidence should become stale when its source architecture changes.
- `weave-next` should make type-aware and context-aware recommendations.

## Permissions and Access Control

No role-based permissions are required.

The behavior uses the same active workspace, active change, artifact context, and Weave-managed artifact write boundaries as the existing workflow.

## States and Lifecycle

`status.yml.stage` remains a change-level orientation signal in v1, but it should not be used to infer skipped upstream artifacts.

`status.yml.stale` remains useful when it reflects real source dependencies. Stale state should mean "this artifact or issue evidence depended on a changed source," not "this lane is later in a fixed pipeline."

Artifact frontmatter has separate artifact-level lifecycle metadata:

- `status`
- `reviewed_at`
- `approved_at`
- `approved_by`

These review fields are not part of source-aware stale tracking.

`status.yml.artifacts.<lane>.sources` should drive artifact dependency behavior:

- `exploration` can stale artifacts that list `exploration`.
- `prd` can stale artifacts that list `prd`.
- `architecture` can stale issue/task evidence and artifacts that list `architecture`.
- Non-file sources such as `discussion`, `sessions`, and `codebase` do not create artifact-to-artifact stale dependencies.

## Notifications and Visibility

No external notifications are required.

Visibility is file- and command-output based:

- artifact frontmatter shows display-only `source`
- `status.yml` shows the structured `artifacts` source graph and stale lanes
- `weave change status` continues to show stage and stale lanes when present
- `weave-next` explains why a stale recommendation exists, including the source relationship where known
- skill completion output should mention created or revised artifacts as it does today

## Edge Cases

- Existing status has no `artifacts`: start with an empty dependency graph.
- Existing artifacts have no frontmatter: treat sources as unknown and avoid broad stale assumptions.
- Artifact lists only external sources: do not mark it stale when unrelated artifact files change.
- Artifact lists `prd` and `codebase`: PRD changes can stale it; codebase edits do not deterministically update lifecycle in v1.
- PRD is created after direct architecture: do not stale architecture unless architecture status sources include `prd`.
- Architecture is revised after issue evidence exists: mark issue/task evidence stale.
- A feature change has no PRD yet: `weave-next` may recommend PRD when product behavior is unclear, but it should not present PRD as mandatory for all types.
- A fix or refactor has no PRD: `weave-next` may recommend architecture or issues as the primary path.
- `tech-debt` is not yet a supported change type: handle as a future open question unless added in this change.

## Acceptance Criteria

- [ ] `weave-prd` can create `prd.md` without usable `exploration.md` when enough product context can be gathered through sessions, current discussion, or interview.
- [ ] `weave-architect` can create `architecture.md` without `prd.md` when enough technical context can be gathered through sessions, current discussion, codebase inspection, or interview.
- [ ] `weave-capture` artifact mode can create missing PRD and architecture artifacts without upstream prerequisite artifacts when selected-lane context is sufficient.
- [ ] New or revised artifacts update `status.yml.artifacts` source metadata.
- [ ] Existing artifacts with only `source` remain valid.
- [ ] Direct architecture with no `prd` source does not imply PRD was reached.
- [ ] PRD changes do not mark architecture stale unless architecture status sources include `prd`.
- [ ] Architecture changes mark existing issue/task evidence stale.
- [ ] `weave-next` recommends next steps based on change type, current artifact context, existing artifacts, and stale source relationships.
- [ ] Skill contract tests no longer assert hard PRD or architecture prerequisites.
- [ ] Lifecycle tests cover source-aware stale behavior.

## Rollout Considerations

This is a backward-compatible workflow and metadata change.

Existing changes do not need migration. Changes without `status.yml.artifacts` should continue to work with an empty dependency graph. Existing stale state should remain readable.

Documentation should explain that the artifact pipeline is guidance, not a universal requirement. It should also explain how source-aware stale differs from lane-order stale.

## Analytics and Success Metrics

No runtime analytics are required for v1.

Success can be evaluated qualitatively:

- users can create architecture for fixes and refactors without creating PRDs
- `weave-next` gives less ceremony-heavy recommendations for non-feature changes
- stale warnings align with actual artifact dependencies
- existing changes remain readable and usable

## Revision History

- 2026-06-01: Initial PRD generated from `exploration.md` and exploration session context.

## Assumptions

- `status.yml.artifacts` is additive and backward compatible.
- `source` remains useful as a human-readable display field.
- `stage` can remain a rough orientation signal for this change.
- Source-aware stale should be implemented without introducing a full per-stage state machine.
- Non-file sources do not create deterministic artifact-to-artifact stale dependencies.

## Open Questions

- Should this change add `tech-debt` as a first-class change type?
- What exact non-file source vocabulary should v1 support?
- Should source-aware stale support transitive artifact dependency invalidation in v1?
- Should `weave change progress` keep its current name after the behavior becomes source-aware?
- How should docs describe `stage` once direct later-lane artifacts are allowed?

## Out of Scope

- Artifact approval workflows.
- Deterministic lifecycle updates from arbitrary manual edits.
- Runtime analytics.
- Migration of all historical artifacts to add source graph metadata.

## Further Notes

Primary implementation surfaces are the PRD, architecture, capture, next, issues, and clarify skill templates; lifecycle logic in `src/lib/changes.ts`; artifact metadata parsing; tests; installed skill copies; and README guidance.
