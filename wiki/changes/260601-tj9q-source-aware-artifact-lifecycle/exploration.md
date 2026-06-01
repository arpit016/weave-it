---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-01T14:35:48.982Z
updated_at: 2026-06-01T14:35:57.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Source Aware Artifact Lifecycle

## Topic

Source-aware artifact lifecycle

## Current Understanding

Weave currently treats the artifact workflow as a mostly linear sequence:

```text
exploration -> prd -> architecture -> issues
```

That pipeline is useful for many feature changes, but it is too strict as a universal model. Future change types such as bug fix, tech debt, refactor, docs, tests, CI, and chores often do not need `prd.md`. For those changes, the useful planning artifact may be `architecture.md`, direct issue/task breakdown, or a focused technical note.

The desired model is artifact-oriented and change-type-aware:

- Features may still prefer exploration and PRD before architecture.
- Bug fixes, refactors, and tech debt may proceed directly to architecture or issues.
- PRD and architecture artifacts should be independently creatable.
- Missing upstream artifacts should not block the selected artifact lane.
- Skills should use upstream artifacts when present, but should fall back to same-lane sessions, current discussion, codebase or product context, and focused interview questions when upstream context is absent or thin.

Lifecycle stale tracking should also stop assuming fixed lane order. Today, `weave change progress` treats later artifact evidence as implying earlier lanes were reached, so `architecture.md` implies PRD and exploration. That becomes wrong when architecture can be created directly.

Stale tracking should become source-aware. Artifacts should keep `source` for backward-compatible display, while `status.yml.artifacts` stores the structured dependency graph used by lifecycle logic. Artifact sources such as `exploration`, `prd`, or `architecture` should appear only when the target artifact actually depended on that lane. Non-artifact sources such as `discussion`, `sessions`, and `codebase` can record direct creation context.

## Open Questions

- Should this change add `tech-debt` as a first-class change type, or should that be a follow-up?
- What exact source vocabulary should v1 support beyond file paths?
- Should source-aware stale support transitive dependency invalidation in v1, or only direct dependencies plus issue/task evidence?
- Should `weave change progress` keep its current name when it becomes source-aware rather than lane-order-based?
- How should `stage` be described once skipped upstream artifacts are allowed?

## Decisions

- Remove the universal constraint that `prd.md` requires usable `exploration.md`.
- Remove the universal constraint that `architecture.md` requires `prd.md`.
- Keep the artifact pipeline as guidance, not a hard prerequisite chain.
- Make change type influence expected artifacts and `weave-next` recommendations.
- `weave-prd` should use `exploration.md` when present, but should interview the user when product context is missing or insufficient.
- `weave-architect` should use `prd.md` when present, but should use architecture sessions, current discussion, codebase inspection, and interview when PRD is missing or insufficient.
- `weave-capture` artifact mode should be able to create missing PRD or architecture artifacts without upstream prerequisites when current discussion/session context is sufficient.
- Add source graph metadata in `status.yml.artifacts` while preserving existing artifact `source`.
- Use actual artifact source dependencies to decide stale markers.
- Do not treat direct `architecture.md` as evidence that `prd.md` exists or was reached.

## Scenarios

### Scenario: Feature follows the full artifact pipeline

A user starts a feature change with unclear product behavior.

`weave-next` should recommend exploration or PRD work before architecture when that is the most useful next artifact. The full pipeline remains valid for this kind of change.

### Scenario: Bug fix starts with architecture

A user starts a bug fix where the useful work is technical diagnosis and implementation approach.

The user can run `weave-architect` without creating `prd.md`. The architecture skill uses current discussion, architecture session notes, codebase inspection, and focused technical interview questions to create a standalone `architecture.md`.

### Scenario: Refactor skips PRD

A user starts a refactor or tech-debt change with no product behavior change.

The system should not require product discovery or PRD. It should recommend architecture or issues depending on whether the technical direction is already clear.

### Scenario: Direct architecture does not depend on PRD

A user creates `architecture.md` directly and lifecycle progress records:

```yaml
artifacts:
  architecture:
    sources:
      - discussion
      - codebase
```

If `prd.md` is later created or revised, the architecture should not be marked stale because it did not declare `prd` as a source.

### Scenario: PRD-backed architecture becomes stale

A user creates `architecture.md` from an existing PRD and lifecycle progress records:

```yaml
artifacts:
  architecture:
    sources:
      - prd
      - codebase
```

If `prd.md` is later revised through a Weave-managed flow, the architecture should be marked stale because it declared PRD as an actual source.

### Scenario: Architecture changes after issues exist

A user has issue/task evidence generated from architecture. The architecture is then revised.

The system should mark issues or task breakdown stale because implementation slices likely depend on the architecture artifact.

## Existing Behavior

Current skill contracts encode a strict prerequisite chain:

- `weave-prd` stops when `exploration.md` is missing or unusable.
- `weave-architect` stops when `prd.md` is missing or too incomplete.
- `weave-capture` only creates missing `prd.md` from usable exploration and only creates missing `architecture.md` from usable PRD.
- `weave-next` recommends forward progress using a fixed pipeline.

Current CLI lifecycle behavior also encodes lane-order assumptions:

- `stage` is the highest reached lane.
- `stale` records downstream invalidation by lane order.
- `readReachedStages` treats `prd.md`, `architecture.md`, and issue evidence as implying all earlier lanes have been reached.
- `progressChange` marks reached downstream lanes stale without checking whether artifacts actually source from the changed artifact.

The affected implementation surfaces are:

- `weave-prd`, `weave-architect`, `weave-capture`, and `weave-next` skill templates
- `weave-issues` stale wording
- `weave-clarify` follow-up and lifecycle wording
- `src/lib/changes.ts` lifecycle progress and stale computation
- status metadata handling for artifact source graphs and display-only artifact `source`
- skill contract tests, lifecycle tests, installed skill copies, and README guidance

## PRD Readiness

Ready
