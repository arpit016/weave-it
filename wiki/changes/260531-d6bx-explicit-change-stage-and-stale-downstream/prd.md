---
artifact: prd
status: draft
owner: product
created_at: 2026-05-31
updated_at: 2026-05-31
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Explicit Change Stage And Stale Downstream Artifacts PRD

## Problem Statement

Weave users need `status.yml.stage` to reflect meaningful change lifecycle progress.

Today, every change starts with `stage: exploration`, and that value does not change after PRD, architecture, or issue work. This makes `weave change status`, `weave change list`, and follow-up tools less trustworthy because a change can have PRD, architecture, and tasks while still reporting the exploration stage.

Users also need a way to know when downstream artifacts are stale after an upstream artifact changes. If exploration or PRD is revised after architecture and issues exist, the later artifacts may no longer be valid. A single stage value cannot express both "how far this change has progressed" and "which downstream work must be revisited."

## Goals

- Make `status.yml.stage` an explicit lifecycle value.
- Preserve the highest reached Weave lane in `stage`.
- Track downstream stale lanes in `status.yml`.
- Keep lifecycle state aligned with Weave-managed artifact writes.
- Help `weave-next` recommend stale rework before forward progress.
- Help `weave-issues` avoid issue breakdown from stale architecture.
- Keep artifact frontmatter focused on artifact-level metadata.

## Non-Goals

- Do not infer lifecycle changes from arbitrary manual file edits in v1.
- Do not add an implementation stage in v1.
- Do not replace artifact frontmatter review or approval fields.
- Do not add artifact approval workflows.
- Do not remove `stage` from `status.yml`.
- Do not regress `stage` as the only way to express stale downstream work.

## Actors

- Developer or product user working through a Weave change.
- Agent running Weave lane skills.
- Future agent deciding what to do next.
- Engineer or reviewer checking change status before implementation work.

## Current Behavior

`weave change new` creates `status.yml` with:

```yaml
stage: exploration
```

The stage is displayed by `weave change list`, `weave change current`, `weave change status`, and `weave change switch`.

No current workflow advances the value. `weave-prd`, `weave-architect`, `weave-issues`, `weave-capture`, and `weave-clarify` do not update `status.yml.stage`.

The current model creates two user-facing problems:

- stage output is stale once a change has progressed past exploration
- downstream artifact invalidation is not represented when earlier artifacts change

## Proposed Product Behavior

`status.yml` should become the change-level lifecycle source for both reached stage and downstream stale state.

The v1 stage values should be:

```text
exploration
prd
architecture
issues
```

`stage` should mean the highest reached lane. It should advance when Weave-managed artifact work reaches a later lane and should not automatically move backward when an earlier artifact is revised.

`status.yml` should also record stale downstream lanes. When an earlier lane is revised after later lanes have been reached, downstream lanes should be marked stale. Follow-up tools should use stale state to recommend the earliest stale lane before recommending forward progress.

Example:

```yaml
stage: issues
stale:
  prd:
    invalidated_by: exploration
    invalidated_at: "2026-05-31T..."
  architecture:
    invalidated_by: exploration
    invalidated_at: "2026-05-31T..."
  issues:
    invalidated_by: exploration
    invalidated_at: "2026-05-31T..."
```

Refreshing a stale lane should clear only that lane. Downstream stale lanes should remain stale until their own lane workflow refreshes them.

## User Workflows

### Workflow: User Advances From Exploration To PRD

1. User starts a new change.
2. `status.yml.stage` starts as `exploration`.
3. User runs `weave-prd`.
4. System creates or revises `prd.md`.
5. System advances `stage` to `prd`.
6. System clears stale state for `prd` if present.

### Workflow: User Advances To Architecture And Issues

1. User runs `weave-architect`.
2. System creates or revises `architecture.md`.
3. System advances `stage` to `architecture`.
4. User runs `weave-issues`.
5. System creates or revises issue/task breakdown.
6. System advances `stage` to `issues`.

### Workflow: User Revises Exploration After Issues Exist

1. Change has reached `stage: issues`.
2. User revises `exploration.md` through a Weave-managed flow.
3. System keeps `stage: issues`.
4. System marks `prd`, `architecture`, and `issues` stale because exploration changed.
5. `weave-next` recommends `weave-prd` as the earliest stale lane.

### Workflow: User Refreshes A Stale Lane

1. `architecture` and `issues` are stale because PRD changed.
2. User runs `weave-architect`.
3. System refreshes `architecture.md`.
4. System clears the `architecture` stale marker.
5. System leaves `issues` stale until issue breakdown is refreshed.

## User Stories

1. As a developer, I want `weave change status` to show the highest reached lane, so that I can understand how far a change has progressed.
2. As a developer, I want downstream artifacts to be marked stale when upstream artifacts change, so that I do not implement from outdated plans.
3. As an agent, I want lifecycle state in `status.yml`, so that I can make consistent recommendations without rederiving progress from files every time.
4. As a user returning to work, I want `weave-next` to recommend stale rework before forward progress, so that I refresh the right artifact first.
5. As an engineer creating issues, I want issue breakdown to warn or stop when architecture is stale, so that implementation tickets are not based on invalid technical design.
6. As a maintainer, I want manual edits to remain out of scope for v1, so that lifecycle behavior is deterministic and tied to Weave workflows.

## Functional Requirements

- The system should support `exploration`, `prd`, `architecture`, and `issues` as v1 change stages.
- The system should keep `status.yml.stage` as the highest reached lane.
- The system should advance `stage` when a Weave-managed artifact write reaches a later lane.
- The system should not automatically regress `stage` when an earlier artifact is revised.
- The system should record stale downstream lanes in `status.yml`.
- The system should mark reached downstream lanes stale when an earlier lane is revised.
- The system should clear stale state for the lane that was just refreshed.
- The system should not clear downstream stale state until those downstream lanes are refreshed.
- The system should leave arbitrary manual file edits out of lifecycle tracking in v1.
- The system should keep artifact frontmatter separate from change-level lifecycle state.
- `weave-next` should prioritize the earliest stale lane over forward progress.
- `weave-issues` should warn or refuse when architecture is stale.
- Existing changes without stale state should continue to work.

## Permissions and Access Control

There are no role-based permissions in v1. Any actor or agent that can run Weave artifact-writing workflows in the repo can update lifecycle state as part of those workflows.

This change should not add artifact approval or review permissions.

## States and Lifecycle

Stage order:

```text
exploration -> prd -> architecture -> issues
```

Stage meaning:

- `exploration`: the change has been created and exploration is the highest reached lane
- `prd`: PRD work has been created or refreshed
- `architecture`: architecture work has been created or refreshed
- `issues`: issue or task breakdown has been created or refreshed

Stale meaning:

- a stale lane exists but should be revisited before downstream work is trusted
- stale lanes are caused by a Weave-managed write to an upstream lane
- stale markers are cleared lane-by-lane when each stale lane is refreshed

Invalid transitions:

- stage should not move backward automatically
- stage should not advance to `implementation` in v1
- stale downstream lanes should not be cleared by refreshing an upstream lane

## Notifications and Visibility

No external notifications are required.

Visibility should be file-based and command-output based:

- `status.yml` contains stage and stale state
- `weave change status` should surface stage and stale state clearly
- `weave-next` should explain stale state when it affects the recommendation
- issue generation should report stale architecture before creating tasks or external issues

## Edge Cases

- Existing `status.yml` has no `stale` field: treat it as no stale lanes.
- Existing `status.yml.stage` is missing: default to `exploration`.
- PRD is refreshed when stage is already `issues`: keep stage as `issues`, clear PRD stale state, and mark or keep architecture/issues stale as appropriate.
- Architecture is refreshed when issues are stale: clear architecture stale state only.
- A lane is refreshed when it was not stale: leave stale state unchanged except for downstream invalidation caused by the refresh.
- A downstream artifact does not exist yet: do not mark it stale just because an upstream lane changed.
- Manual file edit changes PRD outside a Weave workflow: lifecycle state is not automatically updated in v1.

## Acceptance Criteria

- [ ] New changes still start with `stage: exploration`.
- [ ] PRD work advances stage to `prd`.
- [ ] Architecture work advances stage to `architecture`.
- [ ] Issue breakdown advances stage to `issues`.
- [ ] Revising exploration after PRD exists marks PRD stale.
- [ ] Revising exploration after architecture/issues exist marks reached downstream lanes stale.
- [ ] Revising PRD after architecture/issues exist marks architecture/issues stale.
- [ ] Revising architecture after issues exist marks issues stale.
- [ ] Refreshing a stale lane clears only that lane.
- [ ] `weave change status` reports stale lanes.
- [ ] `weave-next` recommends the earliest stale lane before forward progress.
- [ ] `weave-issues` warns or refuses when architecture is stale.
- [ ] Existing changes without stale metadata remain readable.

## Rollout Considerations

This should be backward compatible for existing changes. Existing `status.yml` files without `stale` should be treated as having no stale lanes.

No bulk migration is required. Lifecycle fields should be updated as Weave-managed workflows touch each change.

Documentation should explain that manual edits do not automatically update lifecycle state in v1.

## Analytics and Success Metrics

No automated analytics are required in v1.

Success can be evaluated by:

- `weave change status` no longer showing every mature change as `exploration`
- `weave-next` recommending stale lane refreshes correctly
- issue breakdown no longer proceeding silently from stale architecture
- users understanding both highest reached stage and required rework from status output

## Revision History

- 2026-05-31: Initial PRD generated from `exploration.md`.

## Assumptions

- Weave-managed artifact writes are the only reliable v1 trigger for lifecycle updates.
- `issues` is the terminal v1 stage because implementation workflow is outside Weave's current ownership.
- Downstream lanes should be marked stale only when they have been reached or their artifacts exist.
- A deterministic CLI helper should own YAML updates so skills do not hand-edit lifecycle state independently.

## Open Questions

- What exact `status.yml.stale` YAML shape should be used?
- What should the lifecycle helper be named in the CLI?
- Should stale markers include both `invalidated_by` and `invalidated_at` in v1?

## Out of Scope

- Implementation stage.
- Approval and review workflows.
- Manual edit detection.
- Git timestamp or file timestamp inference.
- Bulk migration of existing changes.
- Artifact-frontmatter stale flags.

## Further Notes

This PRD intentionally treats stale state as product behavior because it changes what users and agents trust when resuming work. Architecture should decide the exact helper surface and YAML schema while preserving the user-facing lifecycle semantics above.
