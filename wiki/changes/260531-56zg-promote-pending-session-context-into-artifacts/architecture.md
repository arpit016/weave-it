---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-05-31T06:47:33.000Z
updated_at: 2026-05-31T06:47:33.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md
---

# Promote Pending Session Context Into Artifacts Architecture

## Summary

Implement pending session promotion as a mostly skill-driven workflow change with one deterministic metadata change in the CLI. Bare `weave-capture` remains agent-owned, but its instructions should explicitly promote relevant pending lane session notes into the selected live artifact.

The compiled CLI should not gain a new capture command in v1. Its main responsibility is to generate new artifact frontmatter with UTC ISO `created_at` and `updated_at` values through the existing `artifactFrontmatter(...)` helper. Skill templates should own the session note shape, pending-session cutoff rules, and artifact merge behavior.

Downstream skills and `weave-next` should not scan for pending session context in v1. This keeps token cost bounded and preserves the existing canonical-artifact workflow.

## PRD Context

Source PRD: `wiki/changes/260531-56zg-promote-pending-session-context-into-artifacts/prd.md`

The PRD requires:

- session-only notes to remain non-canonical until bare `weave-capture` updates the live artifact
- bare `weave-capture` to consider all lane sessions when the artifact is missing
- bare `weave-capture` to consider only lane sessions newer than artifact `updated_at` when the artifact exists
- new artifact frontmatter to use ISO timestamps
- new session notes to include `artifact`, `capture_mode`, and ISO `captured_at`
- no per-session promotion status
- no downstream pending-session scans or hard stops in v1

## Current System

`weave-capture` is an Agent Skill template, not a compiled CLI command. It instructs the agent to resolve workspace and active change context, create a structured session note, and optionally update `exploration.md`, `prd.md`, or `architecture.md`.

The CLI already owns deterministic context and metadata pieces:

- active workspace and current change resolution
- artifact context resolution through `weave artifact current`
- change lifecycle progress through `weave change progress`
- artifact frontmatter generation for CLI-created artifacts through `src/lib/artifact-metadata.ts`

`artifactFrontmatter(...)` currently formats artifact `created_at` and `updated_at` as date-only strings. `status.yml`, local session state, and artifact context already use ISO timestamps elsewhere.

The repository validates skill behavior primarily through text assertions in `tests/agent-skills.test.ts`. Installed `.agents` and `.claude` skill copies are expected to match canonical templates under `templates/skills`.

## Proposed Architecture

### Metadata Helper

Update `artifactFrontmatter(...)` so generated artifact frontmatter uses `now.toISOString()` for both `created_at` and `updated_at`.

Keep the public options shape unchanged. No new helper is required unless later implementation reveals duplicated timestamp formatting in multiple modules.

### Capture Skill Contract

Revise the canonical `weave-capture` skill to add a pending-session promotion step in artifact capture mode:

- identify the selected lane from explicit target or current artifact context
- read relevant prior session notes for that lane
- if the live artifact is missing, consider all lane session notes
- if the live artifact exists, consider lane session notes newer than artifact `updated_at`
- use `captured_at` first, filename timestamp second, and conservative inclusion for ambiguous legacy notes
- merge only durable artifact-relevant context into the live artifact

Session-only capture remains unchanged in behavior: it writes a session note and does not create or update live artifacts.

### Session Note Metadata

New session notes should keep the filesystem-safe filename:

```text
YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md
```

Add YAML frontmatter to new session notes:

```yaml
artifact: exploration
capture_mode: session-only
captured_at: 2026-05-31T06:07:41.000Z
```

Regular artifact-capture session notes should use `capture_mode: artifact`.

### Skill Template Alignment

Update artifact-writing skill templates so they use ISO timestamp language for created or revised artifact frontmatter. This includes `weave-prd`, `weave-architect`, `weave-capture`, and `weave-clarify`.

Do not add pending-session checks to `weave-prd`, `weave-architect`, `weave-issues`, or `weave-next`.

## Data Flow

### Session-Only Capture

1. User invokes `weave-capture session` or `weave-capture session <lane>`.
2. Agent resolves workspace, current change, and lane.
3. Agent writes a session note with `capture_mode: session-only` and `captured_at`.
4. Agent does not create or update live artifacts.
5. Agent does not call lifecycle progress.

### Artifact Capture With Missing Artifact

1. User invokes bare `weave-capture`.
2. Agent resolves selected artifact lane.
3. Agent finds the live artifact is missing.
4. Agent reads all matching lane session notes.
5. Agent writes the new session note with `capture_mode: artifact`.
6. Agent creates the live artifact from current discussion plus durable lane session context.
7. Agent calls `weave change progress <lane> --json`.

### Artifact Capture With Existing Artifact

1. User invokes bare `weave-capture`.
2. Agent resolves selected artifact lane.
3. Agent reads the existing live artifact and its `updated_at`.
4. Agent reads matching lane session notes newer than the artifact cutoff.
5. Agent writes the new session note with `capture_mode: artifact`.
6. Agent merges durable current discussion and pending session context into the artifact.
7. Agent updates artifact `updated_at` and calls lifecycle progress.

## Architecture Decisions

### Keep Capture Agent-Owned

Decision: Do not add a compiled `weave capture` command in v1.

Rationale: Capture requires conversational synthesis, conflict judgment, and artifact-specific merging that already live in agent skill behavior.

Consequences: Tests validate instruction contracts rather than executable capture logic, and behavior depends on skill clarity.

### Use ISO Artifact Metadata

Decision: `artifactFrontmatter(...)` should emit UTC ISO timestamps through `Date.toISOString()`.

Rationale: Date-only artifact timestamps cannot reliably distinguish same-day session captures from artifact updates.

Consequences: New artifacts get more precise timestamps. Existing date-only artifacts remain valid and must be handled conservatively by skill instructions.

### Use Session Frontmatter For Exact Capture Time

Decision: New session notes should include `captured_at` and `capture_mode` frontmatter while keeping the existing safe filename format.

Rationale: Raw ISO filenames are less portable and harder to scan; frontmatter is the right place for exact machine-comparable time.

Consequences: Agents can compare `captured_at` to artifact `updated_at`; old notes without frontmatter still need fallback behavior.

### Keep Downstream Skills Artifact-Canonical

Decision: Do not add pending-session scans or hard stops to downstream skills or `weave-next` in v1.

Rationale: Repeated audits across every lane increase token use and complexity. The user explicitly chose to keep this use case for the future.

Consequences: Users must run bare `weave-capture` when they want session-only context promoted. Downstream skills continue to trust canonical artifacts.

## Rejected Alternatives

### Per-Session Promotion Status

Rejected because artifact `updated_at` plus session `captured_at` gives a simpler cutoff rule without mutating historical session notes.

It may become viable if Weave later needs a dashboard or deterministic machine workflow for unpromoted notes.

### Raw ISO Timestamps In Filenames

Rejected because colons and timezone punctuation are less portable and less pleasant in filenames.

The safe filename plus ISO frontmatter gives both scanability and precise comparison.

### Downstream Hard Stops

Rejected for v1 because every downstream skill would need to read prior-lane sessions and reason about pending context, increasing token cost and workflow friction.

This can be revisited later if users frequently forget to promote session-only notes before downstream work.

## Constraints and Tradeoffs

- Capture behavior remains text-driven skill behavior, so tests assert canonical instructions.
- ISO timestamp output changes generated artifact frontmatter expectations in tests.
- Existing artifacts with date-only timestamps should not be migrated automatically.
- Legacy session notes remain valid but may be included conservatively when timestamp comparison is ambiguous.
- This change should not alter `status.yml` lifecycle timestamp handling, which already uses ISO timestamps.

## Integration Points

- `src/lib/artifact-metadata.ts`: change generated artifact frontmatter timestamp format.
- `templates/skills/weave-capture/SKILL.md`: add pending-session promotion and session frontmatter rules.
- `templates/skills/weave-prd/SKILL.md`, `templates/skills/weave-architect/SKILL.md`, and `templates/skills/weave-clarify/SKILL.md`: update timestamp guidance for artifact frontmatter.
- `.agents/skills` and `.claude/skills`: keep installed copies aligned with templates.
- `README.md`: explain pending session context and bare-capture promotion.
- `tests/agent-skills.test.ts` and `tests/changes.test.ts`: update expected contracts.

No new TypeScript CLI command, session-state schema, or status.yml schema is required.

## Rollout and Migration

Roll out as a backward-compatible template and metadata-generation update.

No migration is required for existing change folders, artifacts, or session notes. Existing date-only artifact timestamps remain acceptable. New generated artifacts and agent-created artifact revisions should use ISO timestamps going forward.

Rollback is straightforward: restore date-only `artifactFrontmatter(...)` output and revert skill/docs changes. Existing ISO timestamps should remain readable because artifact timestamps are stored as strings.

## Observability and Operations

No runtime metrics or alerts are required.

Operational visibility is file-based:

- session note frontmatter shows `capture_mode` and `captured_at`
- artifact frontmatter shows precise `updated_at`
- `weave-capture` completion output should report both session and updated artifact for artifact capture

## Testing Strategy

Update tests for deterministic code behavior:

- new `createChange` exploration frontmatter uses ISO `created_at` and `updated_at`
- status lifecycle tests continue to expect ISO values

Update skill contract tests:

- `weave-capture` documents pending-session promotion for missing and existing artifacts
- `weave-capture` documents `captured_at`, `capture_mode`, and ISO artifact cutoffs
- `weave-capture` preserves session-only no-artifact-update behavior
- PRD, architecture, and clarify skills document ISO artifact frontmatter
- downstream skills do not gain pending-session hard-stop requirements
- installed `.agents` and `.claude` skill copies match templates

Run:

```bash
npm run test
npm run typecheck
npm run build
```

## Security and Data Integrity

The change does not introduce new permissions, network calls, or sensitive data storage.

The main data integrity rule is that session-only notes remain non-canonical until bare capture updates a live artifact. The live artifact remains the source downstream workflows should trust.

Structured session notes must continue to avoid raw transcript storage.

## Implementation Risks

- Risk: Agents omit pending sessions during bare capture.
  Impact: Durable context remains outside the live artifact.
  Mitigation: Put the pending-session read step directly in the artifact capture workflow and add explicit skill tests.

- Risk: Date-only legacy artifact timestamps cause ambiguous comparisons.
  Impact: Agents may include more session notes than strictly necessary.
  Mitigation: Document conservative inclusion for ambiguous legacy cases.

- Risk: ISO timestamp expectations break existing tests.
  Impact: Test failures during implementation.
  Mitigation: Update tests intentionally and keep status timestamp behavior unchanged.

- Risk: Skill copies drift from templates.
  Impact: Different agents receive different capture behavior.
  Mitigation: Preserve installed-copy alignment tests and update all copies together.

## Assumptions

- `Date.toISOString()` is acceptable as the canonical precise timestamp format.
- Skill instructions are the correct v1 home for capture promotion logic.
- Existing date-only artifact timestamps and legacy session files are rare enough that conservative inclusion is acceptable.
- Avoiding downstream pending-session audits is a deliberate v1 product constraint.

## Open Technical Questions

None.

## Product Questions Raised by Technical Design

None.

## Revision History

- 2026-05-31: Initial architecture generated from `prd.md` and codebase review.
