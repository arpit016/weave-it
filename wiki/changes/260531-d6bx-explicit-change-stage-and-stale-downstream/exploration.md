---
artifact: exploration
status: draft
owner: product
created_at: 2026-05-31
updated_at: 2026-05-31
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Explicit Change Stage And Stale Downstream Artifacts

## Topic

Explicit change stage and stale downstream artifacts

## Current Understanding

`status.yml.stage` currently does not advance after change creation.

The observed behavior is systemic: every existing `wiki/changes/*/status.yml` has `stage: exploration`, even when a change has `prd.md`, `architecture.md`, and `tasks.md`. Source inspection confirms why:

- `weave change new` writes `stage: exploration`.
- `weave change list`, `current`, `status`, and `switch` read and display the stage.
- No current CLI command or lane skill updates `status.yml.stage` after PRD, architecture, or issue work.
- Several skills explicitly avoid modifying `status.yml` unless lifecycle behavior is intentionally defined.

The user wants `status.yml` to become an explicit change lifecycle source instead of stale display metadata.

The desired model is two-dimensional:

- `stage` records the highest reached Weave lane.
- `stale` records downstream lanes that must be revisited after an earlier artifact changes.

V1 stage values should match the existing Weave lane workflow:

```text
exploration -> prd -> architecture -> issues
```

`implementation` should not be added in v1 because Weave does not yet own the coding workflow.

When an earlier artifact changes after downstream work exists, Weave should not simply regress `stage`. Pure regression loses important progress context. Instead, `stage` should remain the highest reached lane and `stale` should mark the downstream lanes that need refresh.

## Open Questions

- What exact YAML shape should `status.yml.stale` use?
- Should a new CLI helper be named `weave change progress`, `weave change stage`, or something else?
- Should stale markers include only lane names, or also timestamps and invalidating lane names?

## Decisions

- `status.yml.stage` should be explicit lifecycle state, not derived-only progress.
- Stage values for v1 should be `exploration`, `prd`, `architecture`, and `issues`.
- Stage should mean the highest reached lane.
- `implementation` should be deferred until Weave owns an implementation workflow.
- `status.yml` should also store stale/downstream invalidation state.
- Stale state belongs in `status.yml`, not artifact frontmatter.
- Artifact frontmatter remains artifact-level review and approval metadata.
- Weave-managed artifact writes should update stage and stale state.
- Arbitrary manual file edits should not be inferred in v1.
- Revising an earlier lane should keep the highest reached stage and mark reached downstream lanes stale.
- Refreshing a stale lane should clear only that lane's stale marker.
- Downstream stale markers should remain until their own lanes are refreshed.
- `weave-next` should prioritize the earliest stale lane before recommending forward progress.
- `weave-issues` should warn or refuse when architecture is stale.
- This work should be tracked as a new Weave change, separate from lane-aware session-only capture.

## Scenarios

### Scenario: PRD is created after exploration

A user starts a change and generates `prd.md`.

The system advances `status.yml.stage` from `exploration` to `prd`.

### Scenario: Architecture and issues are created

A user generates `architecture.md`, then issue breakdown.

The system advances `stage` to `architecture`, then `issues`.

### Scenario: Exploration changes after issues exist

A change has reached `stage: issues`. The user revises `exploration.md`.

The system keeps:

```yaml
stage: issues
```

and marks downstream lanes stale:

```yaml
stale:
  prd:
    invalidated_by: exploration
  architecture:
    invalidated_by: exploration
  issues:
    invalidated_by: exploration
```

`weave-next` should recommend `weave-prd` because PRD is the earliest stale downstream lane.

### Scenario: PRD changes after architecture and issues exist

A change has reached `stage: issues`. The user revises `prd.md`.

The system marks `architecture` and `issues` stale. It does not mark `prd` stale because the PRD lane was just refreshed.

### Scenario: Architecture changes after issues exist

A change has reached `stage: issues`. The user revises `architecture.md`.

The system marks `issues` stale. `weave-next` should recommend `weave-issues` before implementation handoff.

### Scenario: Refreshing a stale lane

Architecture is stale because PRD changed. The user reruns `weave-architect`.

The system clears only the `architecture` stale marker. Any `issues` stale marker remains until `weave-issues` refreshes issue breakdown.

## Existing Behavior

`stage` is currently written only during change creation:

```yaml
stage: exploration
```

The stage is then read and shown by change listing/status commands, but nothing advances it.

Historical artifacts confirm the original intent was for status to include stage so users know whether a change is exploratory or ready for implementation. That intent was not completed because transition behavior was never designed.

Current skill behavior is intentionally conservative:

- `weave-prd` creates or revises `prd.md`, but does not edit `status.yml`.
- `weave-architect` creates or revises `architecture.md`, but does not edit `status.yml`.
- `weave-capture` explicitly says not to modify `status.yml` unless lifecycle updates are requested.
- `weave-clarify` says not to advance lifecycle or stage.
- `weave-issues` produces task/issue breakdown, but no current status advancement rule exists.

## PRD Readiness

Ready
