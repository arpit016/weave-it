---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-05-31
updated_at: 2026-05-31
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md
---

# Explicit Change Stage And Stale Downstream Artifacts Architecture

## Summary

This change makes `status.yml` the authoritative change-level lifecycle source for both highest reached lane and stale downstream state.

The implementation should add a deterministic CLI mutation path, `weave change progress <lane> --json`, and route all Weave-managed artifact-writing skills through it after successful writes. The command updates `stage`, clears stale state for the refreshed lane, and marks reached downstream lanes stale when an upstream lane changes.

The main affected systems are change metadata parsing and formatting, the `change` command group, canonical skill templates, installed skill copies, and lifecycle-related tests.

The key risk is preserving backward compatibility for existing changes that all still say `stage: exploration` even when `prd.md`, `architecture.md`, or `tasks.md` exists. The design handles that with lazy compatibility: missing `stale` means no stale lanes, and reached downstream lanes can be inferred from current stage or artifact evidence when computing invalidation.

## PRD Context

PRD path: `wiki/changes/260531-d6bx-explicit-change-stage-and-stale-downstream/prd.md`

This architecture supports these PRD goals:

- make `status.yml.stage` an explicit lifecycle value
- preserve highest reached lane in `stage`
- track downstream stale lanes in `status.yml`
- align lifecycle state with Weave-managed artifact writes
- make `weave-next` recommend stale rework before forward progress
- make `weave-issues` avoid silently creating issues from stale architecture

Product non-goals that shape this design:

- no manual edit inference in v1
- no implementation stage in v1
- no approval workflow changes
- no stale flags in artifact frontmatter
- no bulk migration of existing changes

The PRD left three open questions. The architecture resolves them as follows:

- stale shape: metadata map keyed by lane
- helper name: `weave change progress <lane> --json`
- stale marker metadata: include both `invalidated_by` and `invalidated_at`

## Current System

`weave change new` creates `wiki/changes/<change-id>/status.yml` from `statusTemplate` in `src/lib/changes.ts`. The template writes:

```yaml
stage: exploration
```

`readChangeMetadata` parses `status.yml` and falls back to `stage: exploration` when missing. `listChanges`, `currentChange`, `statusChange`, and `switchChange` expose the parsed stage through JSON result objects and human-readable output.

There is no current mutation path for `stage` after change creation. `src/commands/change.ts` exposes `new`, `list`, `current`, `status`, `switch`, and `propagate`, but no lifecycle advancement command.

Artifact context is separate local session state in `src/lib/artifact-context.ts`. It supports only `exploration`, `prd`, and `architecture`, which is correct because `issues` is not a live artifact context lane.

Skill templates currently own artifact synthesis and writing instructions. They intentionally avoid `status.yml` lifecycle changes because lifecycle behavior was previously undefined.

Existing tests in `tests/changes.test.ts` cover change creation, current/status behavior, switch behavior, and artifact context. `tests/agent-skills.test.ts` verifies canonical skill content and installed skill alignment.

## Proposed Architecture

Add lifecycle support inside the change domain rather than artifact context.

Define a small ordered lifecycle model:

```text
exploration -> prd -> architecture -> issues
```

Use these TypeScript shapes conceptually:

```ts
type ChangeStage = "exploration" | "prd" | "architecture" | "issues";

interface StaleLaneMetadata {
  invalidated_by: ChangeStage;
  invalidated_at: string;
}

type StaleLanes = Partial<Record<ChangeStage, StaleLaneMetadata>>;
```

Extend parsed change metadata with optional stale state. Unknown or absent stale values should parse as empty. Unknown stage values should continue to behave as `exploration` for compatibility, but implementation should preserve valid existing metadata when writing.

Add `progressChange` behavior under `src/lib/changes.ts` and expose it as:

```bash
weave change progress <lane> --json
```

The command should:

- resolve the active change in one target
- validate `<lane>` against the lifecycle stages
- read the target `status.yml`
- update `stage` to the max of existing stage and progressed lane
- clear stale state for the progressed lane
- mark reached downstream lanes stale with `invalidated_by: <lane>` and `invalidated_at: now.toISOString()`
- write only `status.yml`
- return updated change metadata in JSON and human output

Reached downstream lanes should be computed from stage order plus artifact evidence. This is required for old changes whose status still says `stage: exploration`. Evidence should include:

- `prd.md` exists and is substantive for `prd`
- `architecture.md` exists and is substantive for `architecture`
- populated `tasks.md` or obvious issue evidence for `issues`

The helper should not inspect arbitrary git history or timestamps.

Update `weave change current` and `weave change status` to include stale state. Human output should add a concise line such as:

```text
Stale: architecture (invalidated by prd), issues (invalidated by prd)
```

When no lanes are stale, omit the line or show `Stale: none` consistently. JSON output should include the structured `stale` map.

Update canonical skill templates and installed copies so artifact-writing flows call the helper after successful live artifact writes:

- exploration writes call `weave change progress exploration --json`
- PRD writes call `weave change progress prd --json`
- architecture writes call `weave change progress architecture --json`
- issue/task creation calls `weave change progress issues --json`

Session-only capture must not call the progress helper.

## Data Flow

Artifact-writing lane flow:

1. User invokes a lane skill.
2. Skill resolves active change and target artifact.
3. Skill writes or updates the live artifact.
4. Skill invokes `weave change progress <lane> --json`.
5. CLI reads `status.yml`.
6. CLI advances stage, clears the current lane stale marker, and marks reached downstream lanes stale.
7. CLI writes `status.yml`.
8. Later `weave-next`, `weave change status`, and `weave-issues` consume the structured lifecycle state.

Stale recommendation flow:

1. `weave-next` reads `status.yml`.
2. If stale lanes exist, it chooses the earliest stale lane by lifecycle order.
3. It recommends the matching skill before forward pipeline progress.

Issue generation flow:

1. `weave-issues` reads PRD, architecture, and status.
2. If `stale.architecture` exists, it warns and asks for explicit confirmation before continuing.
3. If confirmed and issues/tasks are created, it invokes `weave change progress issues --json`.

## Architecture Decisions

### CLI owns lifecycle mutation

Decision: Add `weave change progress <lane> --json` as the only lifecycle mutation interface.

Rationale: Skills are text instructions and should not duplicate YAML update logic. A CLI helper gives every agent integration the same stage and stale semantics.

Consequences: Artifact-writing skills gain one extra post-write command. Lifecycle bugs are isolated to the change command implementation.

### Stale state is a metadata map

Decision: Store stale state as a map keyed by lane with `invalidated_by` and `invalidated_at`.

Rationale: Operators and agents need to know which upstream lane invalidated downstream work and when it happened.

Consequences: The schema is slightly larger than a lane list but easier to explain and extend.

### Stage never automatically regresses

Decision: `stage` remains the highest reached lane.

Rationale: Regressing stage loses progress context. Stale state is the correct place to record required rework.

Consequences: Consumers must read both `stage` and `stale` to understand the change.

### Issues is a lifecycle lane, not an artifact context

Decision: Keep artifact context limited to `exploration`, `prd`, and `architecture`.

Rationale: There is no canonical `issues.md` artifact. Issue evidence may be `tasks.md`, external issue URLs, or issue references.

Consequences: `weave change progress issues --json` is valid, but `weave artifact current set issues` remains invalid.

### Stale architecture requires confirmation before issues

Decision: `weave-issues` should warn and require explicit confirmation when architecture is stale.

Rationale: The user chose warning with continuation over hard refusal. This prevents silent bad issue generation while preserving escape hatches.

Consequences: Fully autonomous issue generation should stop at the confirmation point when architecture is stale.

## Rejected Alternatives

### Lane list stale state

Rejected because it cannot explain what invalidated a lane or when.

It may become viable if status output needs only a minimal human checklist and no agent reasoning.

### Boolean map stale state

Rejected because it gives efficient lookup but still loses invalidation cause and timing.

It may become viable if stale metadata proves noisy and unused.

### `weave change stage`

Rejected because the helper does more than set stage. It also manages downstream invalidation and stale clearing.

It may become viable as an alias later, but should not be the primary v1 contract.

### `weave artifact progress`

Rejected because lifecycle state belongs to a change, not to local artifact context.

It may become viable only if artifact context grows into a durable artifact registry.

### Hard refusal in `weave-issues`

Rejected because the selected v1 behavior is warning with explicit continuation.

It may become viable if users repeatedly create bad issues from stale architecture despite warnings.

## Constraints and Tradeoffs

- The repo currently centralizes change metadata in `src/lib/changes.ts`; lifecycle parsing and writes should stay there.
- Existing changes are not migrated. Compatibility must happen lazily during reads and progress updates.
- Manual edits are not detected in v1, so lifecycle state is reliable only for Weave-managed artifact writes.
- Skill templates must be updated alongside installed `.agents` and `.claude` copies to keep tests and local behavior aligned.
- `weave change list` should stay compact; stale details belong in status/current/next.
- The implementation should avoid adding file timestamp inference because that would make behavior harder to explain and test.

## Integration Points

Internal interfaces:

- `src/lib/changes.ts`: parse, expose, and mutate lifecycle state.
- `src/commands/change.ts`: add `progress` subcommand and output handling.
- `templates/skills/*/SKILL.md`: document post-write lifecycle calls and stale-aware behavior.
- installed skill copies under `.agents/skills` and `.claude/skills`: keep aligned with templates.
- `templates/opencode/commands/*`: update only if wrapper behavior or wording needs lifecycle references.

File format:

```yaml
stage: issues
stale:
  architecture:
    invalidated_by: prd
    invalidated_at: "2026-05-31T04:06:16.000Z"
  issues:
    invalidated_by: prd
    invalidated_at: "2026-05-31T04:06:16.000Z"
```

Compatibility expectations:

- missing `stale` means no stale lanes
- missing `stage` means `exploration`
- valid existing status fields must be preserved when writing lifecycle updates

## Rollout and Migration

No bulk migration is required.

The rollout is lazy:

1. New code can read all existing changes.
2. The first Weave-managed artifact write for a change calls `weave change progress`.
3. That call writes modern lifecycle state to `status.yml`.

Rollback is straightforward because the file format remains YAML and existing readers ignore unknown fields. If needed, removing `stale` from `status.yml` returns old readers to prior behavior.

## Observability and Operations

There are no external metrics or dashboards in v1.

Operational visibility is command and file based:

- `status.yml` stores source-of-truth lifecycle state.
- `weave change status` surfaces stale lanes and causes.
- `weave-next` explains stale-first recommendations.
- `weave-issues` reports stale architecture before issue generation.

Expected failure modes:

- invalid lane argument: return a structured CLI error
- no active change: reuse existing active-change error behavior
- malformed `status.yml`: preserve current error behavior unless existing parsing already tolerates it
- write failure: fail the progress command and leave the artifact write intact

Support workflow:

- inspect `wiki/changes/<change-id>/status.yml`
- run `weave change status --json`
- rerun the appropriate lane skill to refresh stale state

## Testing Strategy

Unit tests in `tests/changes.test.ts` should cover:

- new changes still start with `stage: exploration`
- progress to `prd`, `architecture`, and `issues`
- stage does not regress when an earlier lane is refreshed
- upstream refresh marks reached downstream lanes stale
- refreshing a stale lane clears only that lane
- stale metadata includes `invalidated_by` and `invalidated_at`
- missing `stale` is parsed as empty
- older changes with artifact evidence are invalidated correctly

CLI tests should cover:

- `weave change progress <lane> --json`
- invalid lane rejection
- status/current JSON includes stale state
- human status/current output includes stale lanes when present

Skill tests in `tests/agent-skills.test.ts` should cover:

- canonical templates mention progress helper calls
- session-only capture does not mention progress mutation
- `weave-next` documents stale-first recommendation
- `weave-issues` documents stale architecture warning and confirmation
- installed skill copies remain aligned with templates

Verification commands:

```bash
npm run test
npm run typecheck
npm run build
```

## Security and Data Integrity

No new authentication or authorization boundary is introduced. Any actor that can write change artifacts can already write `status.yml`.

Data integrity invariants:

- `stage` must be one of the v1 lifecycle lanes
- stale keys must be lifecycle lanes
- stale `invalidated_by` must be a lifecycle lane
- stale `invalidated_at` must be an ISO timestamp generated by the CLI
- lifecycle progress must preserve unrelated status fields

The helper should avoid storing raw discussion, user transcript content, or sensitive data. Stale metadata contains only lane names and timestamps.

## Implementation Risks

### Risk: Skills and CLI drift

Impact: Agents may keep creating artifacts without lifecycle updates.

Mitigation: Update canonical templates, installed copies, and template tests in the same implementation.

### Risk: Existing mature changes still look unreached

Impact: Upstream refreshes may fail to mark downstream artifacts stale.

Mitigation: Use artifact evidence in addition to stored stage when computing reached lanes.

### Risk: Status output becomes noisy

Impact: Common commands become harder to scan.

Mitigation: Keep list output compact and show stale details mainly in status/current/next.

### Risk: Issue generation continues from stale architecture

Impact: Implementation tasks can be based on outdated design.

Mitigation: `weave-issues` must warn and require explicit confirmation before continuing.

## Assumptions

- `weave change progress` mutates only one resolved active target at a time in v1.
- `tasks.md` or obvious issue references are sufficient issue evidence for reached `issues` compatibility.
- Stale metadata should reflect the latest invalidating upstream lane.
- Manual file edits remain outside lifecycle tracking.
- Existing YAML formatting may change when `status.yml` is rewritten by the `yaml` package.

## Open Technical Questions

None.

## Product Questions Raised by Technical Design

None.

## Revision History

- 2026-05-31: Initial architecture generated from `prd.md`, codebase review, and architecture planning discussion.
