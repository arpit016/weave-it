---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-06-01T15:01:59.000Z
updated_at: 2026-06-01T15:01:59.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md
---

# Source-Aware Artifact Lifecycle Architecture

## Context

Weave currently treats artifact lifecycle as a mostly linear pipeline:

```text
exploration -> prd -> architecture -> issues
```

That model is encoded in both skill instructions and CLI lifecycle logic. It is useful for feature work, but too rigid for fixes, refactors, docs, tests, CI, chores, and future tech-debt style changes where `architecture.md`, direct issue planning, or a short technical note may be the right first artifact.

The desired model is that artifact lanes are independently creatable, and lifecycle stale state reflects actual source dependencies instead of lane order.

## Current Implementation

The main lifecycle implementation lives in `src/lib/changes.ts`.

- `changeStages` defines `exploration`, `prd`, `architecture`, and `issues`.
- `progressChange` reads `status.yml`, computes reached stages, clears stale state for the progressed lane, then marks later reached lanes stale by fixed stage order.
- `readReachedStages` currently calls `addReachedThrough`, so `architecture.md` implies `exploration` and `prd` were reached.
- `hasIssueEvidence` detects `tasks.md` or issue references in change artifacts.
- `formatStaleLines` prints stale lane summaries without source relationship context.

The command surface lives in `src/commands/change.ts`. The `progress` command currently accepts a lane, target, and JSON output flag, but no source flags.

Artifact frontmatter is produced by `src/lib/artifact-metadata.ts`. It currently emits a single `source` field only.

Skill templates and installed copies encode hard prerequisites and old stale guidance:

- `weave-prd` requires usable `exploration.md`.
- `weave-architect` requires `prd.md`.
- `weave-capture` only creates missing PRD from usable exploration and missing architecture from usable PRD.
- `weave-next` recommends forward progress through the fixed pipeline and earliest stale lane.
- `weave-issues` and `weave-clarify` mention stale behavior in PRD/architecture terms.

Tests lock these contracts in `tests/changes.test.ts` and `tests/agent-skills.test.ts`.

## Technical Goals

- Allow PRD and architecture lifecycle progress without implying upstream lanes were created or reached.
- Track artifact dependencies in `status.yml`, not in new artifact frontmatter.
- Preserve the existing `source` frontmatter field as display/backward-compatible context.
- Preserve the existing `stale` shape where possible.
- Make stale invalidation transitive across actual artifact dependencies.
- Keep `weave change progress` as the lifecycle command.
- Keep the first implementation lighter than a full stage state machine.

## Status Metadata Design

Add a CLI-owned artifact dependency graph to `status.yml`:

```yaml
artifacts:
  prd:
    sources:
      - exploration
      - sessions
    updated_at: "2026-06-01T15:01:59.000Z"
  architecture:
    sources:
      - prd
      - codebase
    updated_at: "2026-06-01T15:01:59.000Z"
  issues:
    sources:
      - architecture
    updated_at: "2026-06-01T15:01:59.000Z"
```

Use artifact IDs, not filenames, as source IDs.

Accepted v1 source IDs:

- `exploration`
- `prd`
- `architecture`
- `discussion`
- `sessions`
- `codebase`

`issues` remains a lane and graph key, but is not a general source ID in v1.

Artifact IDs create dependency edges. External sources such as `discussion`, `sessions`, and `codebase` are provenance only; they do not cause artifact-to-artifact stale invalidation.

## Progress Command Design

Extend `weave change progress <lane>` with repeatable source flags:

```bash
weave change progress architecture --source prd --source codebase --json
```

Implementation shape:

- Add `sources?: ArtifactSourceId[]` to `ProgressChangeOptions`.
- Add a repeated `--source <source>` option in `src/commands/change.ts`.
- Validate all source IDs before mutating `status.yml`.
- Deduplicate sources while preserving order.
- Record the progressed lane under `status.yml.artifacts[stage]`.
- For `issues`, when no explicit source is supplied and substantive `architecture.md` exists, default sources to `[architecture]`.
- When no source is supplied and no default applies, record an empty source list and return a visible note in command output and JSON.

The no-source behavior matters because old skill versions may call `weave change progress architecture --json` until the templates are updated. That should not fail, but it also should not silently invent dependencies.

## Stale Invalidation Design

Replace lane-order stale marking with graph traversal.

When progressing source lane `X`:

1. Clear stale state for `X`.
2. Persist or update `artifacts[X]` with the provided source list and timestamp.
3. Build a graph from artifact-lane dependencies in `status.yml.artifacts`.
4. Find all transitive dependents of `X`.
5. Mark those dependents stale with the existing metadata shape:

```yaml
stale:
  architecture:
    invalidated_by: prd
    invalidated_at: "2026-06-01T15:01:59.000Z"
```

Only lanes that actually depend on `X` should become stale. For example:

- PRD-backed architecture with sources `[prd, codebase]` becomes stale when PRD progresses.
- Direct architecture with sources `[discussion, codebase]` does not become stale when PRD progresses.
- Issues with sources `[architecture]` become stale when architecture progresses.
- If issues depend on architecture and architecture depends on PRD, PRD progress marks both architecture and issues stale through transitive traversal.

Keep the existing `invalidated_by` field pointing at the lane that was progressed, not the nearest intermediate dependency. That keeps output simple and compatible with the current stale metadata shape.

## Stage Semantics

Keep `status.yml.stage` as a rough orientation field in v1, but stop treating it as proof that skipped upstream artifacts exist.

Implementation recommendation:

- Compute `stage` from the existing stage and the progressed lane using the current stage ordering.
- Do not call `readReachedStages` in a way that uses artifact existence to add upstream lanes.
- Direct architecture progress may move `stage` to `architecture`, but should not create PRD stale state or imply PRD exists.

This keeps existing command output recognizable while removing the incorrect prerequisite inference.

## Backward Compatibility

Existing changes may have only artifact frontmatter `source`. They should remain readable.

Recommended compatibility behavior:

- `artifactFrontmatter(...)` keeps emitting `source`.
- `artifactFrontmatter(...)` does not emit new `sources`.
- `readChangeMetadata` tolerates missing `artifacts`.
- Existing `stale` metadata continues to parse.
- If `status.yml.artifacts` is missing, lifecycle progress starts the graph from an empty object.
- Existing artifact frontmatter `source` can be used for display and future migration, but the new deterministic stale behavior should rely on `status.yml.artifacts`.

The exploration and PRD artifacts created during this change currently include `sources` frontmatter from an earlier decision. That metadata is not part of the target architecture and should not be emitted by updated skills.

## Skill Updates

Update both template skills and installed copies.

`weave-prd`:

- Remove the hard requirement for usable `exploration.md`.
- Prefer exploration when present and useful.
- Use same-lane sessions, current discussion, and interview when product context is insufficient.
- Call progress with sources that match actual context, such as `--source exploration --source sessions`.

`weave-architect`:

- Remove the hard requirement for `prd.md`.
- Prefer PRD when present and useful.
- Use architecture sessions, current discussion, codebase inspection, and interview when PRD is missing or thin.
- Call progress with `--source prd --source codebase` when PRD-backed, or `--source discussion --source codebase` for direct technical design.

`weave-capture`:

- Allow direct missing PRD or architecture creation when selected-lane context is sufficient.
- Remove prerequisite-only creation rules for missing PRD and architecture.
- Pass source flags based on the context merged into the live artifact.

`weave-next`:

- Recommend by change type, existing artifacts, current artifact context, and source-aware stale state.
- Present the pipeline as guidance for feature-style work, not a mandatory path for every change type.

`weave-issues`:

- Use source-aware stale state instead of assuming architecture is stale whenever PRD changed.
- When generating issue/task evidence from architecture, record lifecycle progress with `--source architecture`.

`weave-clarify`:

- Update follow-up stale wording to align with source-aware dependencies.
- Pass source flags when progress is called after an artifact clarification.

## CLI Implementation Plan

1. Add source ID types and parsers in `src/lib/changes.ts`.
2. Extend status parsing to include `artifacts` metadata while preserving unknown status fields.
3. Extend `ProgressChangeOptions` and `ProgressChangeResult` with source and note data.
4. Update `progressChange` to write `status.yml.artifacts[stage]`.
5. Replace fixed downstream invalidation with transitive dependent traversal.
6. Stop using `readReachedStages` for stale invalidation and upstream lane inference.
7. Add the repeatable `--source` option in `src/commands/change.ts`.
8. Update human output to include a no-source note when dependencies are empty by explicit absence.
9. Keep JSON output backward compatible by adding fields rather than removing existing ones.

## Test Plan

Add or update lifecycle tests for:

- Direct architecture progress without PRD does not imply PRD/exploration reached.
- PRD progress only marks architecture stale when architecture sources include `prd`.
- Direct architecture sources `[discussion, codebase]` are not stale after PRD progress.
- Transitive invalidation marks issues stale when PRD invalidates architecture and issues depend on architecture.
- Progress with no source records empty dependencies and returns a visible note.
- Unknown source IDs fail before writing `status.yml`.
- Issues progress defaults to `[architecture]` when architecture exists and no source is passed.
- Existing status files without `artifacts` continue to parse.

Add or update skill contract tests for:

- `weave-prd` no longer asserts a hard exploration prerequisite.
- `weave-architect` no longer asserts a hard PRD prerequisite.
- `weave-capture` no longer requires upstream artifacts to create missing PRD/architecture when selected-lane context is sufficient.
- Skills mention source-aware progress commands.
- Skills do not require or emit new `sources` frontmatter.
- `weave-next` uses type-aware and source-aware recommendations.

Run:

```bash
npm run test
npm run typecheck
npm run build
```

## Risks

- Old skill copies may call progress without sources until all templates and installed copies are updated. The no-source note mitigates silent dependency loss.
- `stage` can still be misread as a completed pipeline. Documentation must describe it as orientation only.
- Existing manually edited artifacts cannot deterministically update lifecycle state in v1.
- Source-aware stale depends on skills passing accurate source IDs.

## Open Technical Questions

- Should this change normalize the already-created exploration and PRD frontmatter that includes `sources`, or leave it as harmless historical metadata?
- Should `weave-next` recommend PRD for every `feat` without PRD, or only when product behavior remains unclear?
- Should status output eventually show dependency source relationships alongside stale lanes?

## Revision History

- 2026-06-01: Initial architecture generated from PRD, codebase review, and architecture planning discussion.
