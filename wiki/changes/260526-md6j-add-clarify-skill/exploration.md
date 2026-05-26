# Add Clarify Skill

## Topic

Add a new `weave-clarify` skill for refining existing Weave change artifacts when scope, requirements, assumptions, or decisions change midstream.

## Current Understanding

Weave already has focused skills for creating and revising specific artifacts:

- `weave-explore` helps refine product requirements and discovery.
- `weave-prd` creates or revises `prd.md` from `exploration.md`.
- `weave-architect` creates or revises `architecture.md` from `prd.md` and technical context.

Users also need a dedicated clarification workflow for moments after an artifact already exists and the underlying truth changes. Examples include new requirements arriving, old requirements becoming invalid, scope expanding, scope narrowing, or an assumption needing explicit confirmation.

`weave-clarify` should be an interactive, user-invoked skill that updates one selected artifact at a time. It should support `exploration.md`, `prd.md`, and `architecture.md`.

When the user does not provide a target artifact, the skill should inspect the active change artifacts, identify which files appear likely to be affected, and ask the user which artifact to clarify first.

The skill should not cascade-write multiple artifacts in one invocation. After updating the selected artifact, it should report other artifacts that may also need clarification and ask the user to run `weave-clarify` against those files separately.

## Open Questions

None at this stage.

## Decisions

- Name the skill `weave-clarify`.
- Make v1 user-invoked and interactive only.
- Do not include an internal autonomous mode in v1.
- Support clarifying `exploration.md`, `prd.md`, and `architecture.md`.
- Update one selected artifact per invocation.
- If no target artifact is provided, inspect the active change artifacts and ask the user which artifact to clarify first.
- Do not cascade-write follow-up artifacts. Report likely affected artifacts and instruct the user to clarify them separately.
- Preserve still-valid artifact content when clarifying.
- Mark superseded, removed, or narrowed scope explicitly instead of silently deleting prior requirements or decisions.
- Record clarification history through the selected artifact's existing revision or audit-trail pattern.

## Scenarios

### Scenario: Scope expands after exploration

A user has an `exploration.md` for an active change. New requirements appear during conversation. The user invokes `weave-clarify exploration`. The skill asks focused questions, updates the exploration with the new scope, records any remaining open questions, and reports that `prd.md` may need clarification or regeneration afterward.

### Scenario: Scope narrows after PRD creation

A user has a `prd.md` that includes requirements that are no longer valid. The user invokes `weave-clarify prd`. The skill confirms the narrowed scope, moves removed behavior into non-goals or out-of-scope content where appropriate, records the superseded requirement, and reports whether `architecture.md` may now be stale.

### Scenario: Requirement is superseded

A user explains that a previous product requirement should be replaced by a new behavior. The skill updates the selected artifact to reflect the current requirement, preserves the fact that the prior requirement was superseded, and records the clarification so readers understand why the artifact changed.

### Scenario: Target artifact is unclear

A user invokes `weave-clarify` without naming an artifact. The skill reads the active change artifacts, determines whether the new clarification likely affects exploration, PRD, architecture, or multiple artifacts, then asks the user which single artifact to update first.

### Scenario: Architecture is impacted by PRD changes

A user clarifies product behavior in `prd.md` that may invalidate part of `architecture.md`. The skill updates only `prd.md`, then tells the user that `architecture.md` likely needs follow-up clarification with `weave-clarify architecture`.

## Existing Behavior

Current Weave skills can create and revise individual planning artifacts, but there is no dedicated skill for midstream artifact clarification across artifact types.

Today, users must choose between rerunning a generation-oriented skill or manually editing an artifact when requirements change. That makes it easy to overwrite still-valid context, silently remove old scope, miss follow-up artifacts, or leave PRD and architecture content inconsistent after scope changes.

## PRD Readiness

Ready
