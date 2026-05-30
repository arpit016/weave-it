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

# Lane-Aware Session-Only Capture Architecture

## Summary

Add lane-aware session-only capture by revising the canonical `weave-capture` Agent Skill and related user-facing documentation. This should remain a skill-driven behavior change, not a new compiled capture command.

The compiled CLI already owns the deterministic state needed by capture: workspace resolution, active change lookup, and current artifact context lookup. The capture skill owns the semantic work: interpreting the invocation, summarizing the discussion, writing session notes, and deciding whether to update a live artifact.

The main implementation is to split `weave-capture` into two explicit behavior paths: bare `weave-capture` keeps the existing session-plus-artifact-update behavior, while `weave-capture session [exploration|prd|architecture]` writes only a lane-aware session note.

## PRD Context

Source PRD: `wiki/changes/260531-ugsy-add-lane-aware-session-only-capture/prd.md`

The PRD requires an opt-in session-only mode that preserves discussion context without creating or updating `exploration.md`, `prd.md`, or `architecture.md`. It also requires session-only captures to remain active-change scoped, lane-aware, resume-only, and backward-compatible with existing bare `weave-capture` behavior.

Product non-goals that shape the design:

- no standalone captures outside an active change
- no default change to bare `weave-capture`
- no promotion command
- no raw transcript storage
- no artifact review or approval lifecycle changes

## Current System

`weave-capture` is currently an Agent Skill template, not a compiled CLI command. The template tells the agent to:

- run `weave workspace --json`
- run `weave change current --json`
- resolve an artifact target directly or through `weave artifact current --json`
- create `wiki/changes/<change-id>/sessions/`
- write a structured session note
- create or merge durable content into `exploration.md`, `prd.md`, or `architecture.md`

The CLI already has `artifact current` support through `src/lib/artifact-context.ts`. It validates current artifact context against the active change and reports `source: "session"` or `source: "none"`. This is enough for the session-only lane-resolution requirement.

Canonical skills live under `templates/skills/*/SKILL.md`. Repo-installed copies under `.agents/skills` and `.claude/skills` are expected to match the templates. opencode slash commands are lightweight wrappers under `templates/opencode/commands` and already pass invocation arguments through as `Context: $ARGUMENTS`.

Tests in `tests/agent-skills.test.ts` assert important text in the canonical capture skill, installed-copy alignment, and opencode wrapper installation.

## Proposed Architecture

### Capture Skill Behavior

Revise `templates/skills/weave-capture/SKILL.md` to define two modes:

- artifact capture: the existing bare `weave-capture` flow
- session-only capture: `weave-capture session [exploration|prd|architecture]`

The skill should parse invocation context semantically. It should not require a new compiled CLI parser.

For artifact capture, preserve existing target and prerequisite behavior. Missing live artifacts can be created only according to the existing target rules.

For session-only capture:

- require a valid active change
- use explicit lane when provided
- otherwise use valid current artifact context
- ask for a lane if no valid lane can be resolved
- create `sessions/` if missing
- write the structured session note
- do not create or update `exploration.md`, `prd.md`, or `architecture.md`
- report that no live artifact was updated

### Filename Format

Update future session filename guidance from:

```text
yyyy-mm-dd-<4-char-id>-<artifact>.md
```

to:

```text
YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md
```

Existing session files remain valid. This is a forward-only convention change for new captures.

The skill should still instruct the agent to use a 4-character lowercase alphanumeric id and retry on filename collision.

### Documentation and Installed Copies

Update the canonical capture skill first, then copy it to:

- `.agents/skills/weave-capture/SKILL.md`
- `.claude/skills/weave-capture/SKILL.md`

Update the opencode wrapper description to describe current behavior more accurately. The existing `Context: $ARGUMENTS` passthrough is enough for `/weave-capture session prd`.

Update README skill documentation to show:

- bare capture for artifact-updating capture
- `weave-capture session`
- `weave-capture session prd`

### Tests

Update `tests/agent-skills.test.ts` assertions for the canonical capture skill:

- includes `weave-capture session`
- includes explicit lane examples
- includes the sortable filename format
- includes the no-live-artifact-update behavior
- keeps assertions for raw transcript avoidance, live artifact preservation in regular capture, and completion output

If opencode wrapper text changes, update wrapper install assertions accordingly.

## Data Flow

### Regular Artifact Capture

1. User invokes bare `weave-capture`.
2. Skill resolves workspace and current change.
3. Skill resolves artifact target from explicit target or current artifact context.
4. Skill writes a structured session note.
5. Skill creates or updates the selected live artifact according to existing prerequisite rules.
6. Skill reports both the session note and updated artifact.

### Session-Only Capture

1. User invokes `weave-capture session` or `weave-capture session <lane>`.
2. Skill resolves workspace and current change.
3. Skill resolves lane from explicit invocation or valid current artifact context.
4. Skill writes a structured lane-aware session note.
5. Skill writes `None; session-only capture` or equivalent under `Live Artifact Updates Applied`.
6. Skill skips all live artifact writes.
7. Skill reports the captured session and explicitly says no artifact was updated.

## Architecture Decisions

### Keep Capture Agent-Owned

Decision: Do not add a compiled `weave capture` command in v1.

Rationale: Capture currently depends on conversational synthesis, which is agent work. The CLI already provides the deterministic context needed by the skill.

Consequences: Behavior quality depends on skill instructions and agent compliance, but this matches existing Weave architecture and avoids duplicated capture logic.

### Reuse Existing Artifact Context

Decision: Use existing `weave artifact current --json` output for lane resolution.

Rationale: It already validates that stored artifact context points to the active change.

Consequences: No session-state schema change is required.

### Keep Session Files Lane-Aware Without New Metadata

Decision: Keep using `*-<artifact>.md` session files for both regular and session-only captures.

Rationale: Existing resume skills already search `sessions/*-exploration.md`, `sessions/*-prd.md`, and `sessions/*-architecture.md`.

Consequences: Session-only state must be visible in the file contents and completion response rather than filename metadata.

### Change Filename Convention Forward Only

Decision: Use sortable timestamp filenames for new captures while treating old filenames as valid.

Rationale: The PRD asks for same-day chronological sorting, but existing files should not be migrated or invalidated.

Consequences: Tests should assert new guidance, while reader skills should continue accepting historical names.

## Rejected Alternatives

### Add A Compiled Capture Command

Rejected because the compiled CLI cannot summarize the current conversation or decide what belongs in a structured session note. It would either duplicate agent behavior or still need agent-side synthesis.

This could become viable if Weave later introduces a structured machine-readable capture input format.

### Create A Separate `weave-session` Skill

Rejected because the PRD chooses `weave-capture session` and keeps capture behavior in one discoverable place.

It could become viable if session-only capture grows into a larger standalone workflow.

### Add A `-session` Filename Suffix

Rejected because the PRD selected same artifact suffix filenames and lane-aware resume behavior.

It could become viable if future tools need to distinguish session-only notes without reading file contents.

## Constraints and Tradeoffs

- This change is mainly text-driven skill behavior, so tests validate canonical instructions rather than executable capture logic.
- The current built `dist` CLI may lag source during development; use source CLI via `npm run dev -- artifact ...` when artifact commands are needed locally.
- Existing installed skill copies must remain aligned with canonical templates.
- Existing session files use the older date-only filename shape and must remain valid resume context.
- Session-only captures rely on the agent receiving invocation arguments through skill context or command wrapper context.

## Integration Points

- `templates/skills/weave-capture/SKILL.md`: canonical behavior contract.
- `.agents/skills/weave-capture/SKILL.md` and `.claude/skills/weave-capture/SKILL.md`: repo-installed copies that should match the template.
- `templates/opencode/commands/weave-capture.md`: slash-command wrapper; keep `Context: $ARGUMENTS`.
- `README.md`: user-facing skill usage.
- `tests/agent-skills.test.ts`: canonical skill, installed-copy, and opencode wrapper assertions.

No new TypeScript library or CLI API is required for v1.

## Rollout and Migration

Roll out as a backward-compatible template and documentation update.

No migration is required for existing change folders or existing session files. Old session filenames remain valid. Bare `weave-capture` behavior remains artifact-updating.

Users with modified installed skills are protected by existing agent skill update behavior. They can use `weave agent diff`, `weave agent update`, or `weave agent reset` depending on whether they want to preserve local edits.

## Observability and Operations

No runtime metrics or alerts are required.

Operational visibility is through files and command output:

- session-only notes explicitly state that no live artifact updates were applied
- completion response reports the captured session and no artifact update
- git diff shows only session note output for session-only captures

## Testing Strategy

Unit-level tests should cover canonical skill text and installation behavior:

- capture skill includes session-only invocation examples
- capture skill preserves regular artifact capture behavior
- capture skill documents no live artifact updates for session-only mode
- capture skill documents the new sortable filename format
- installed `.agents` and `.claude` capture skills match the template
- opencode wrapper still passes context arguments and any updated description is asserted

Run:

```bash
npm run test
npm run typecheck
npm run build
```

## Security and Data Integrity

Session-only capture should not store raw transcripts. It should keep the existing structured-summary rule.

No new permissions or sensitive data handling paths are introduced. The key data-integrity boundary is that session-only capture must not modify live artifacts or artifact lifecycle metadata.

## Implementation Risks

- Risk: Agent interprets `weave-capture session` as regular capture and updates an artifact.
  Impact: Unwanted canonical artifact changes.
  Mitigation: Put session-only mode early in the skill workflow and explicitly separate completion responses.

- Risk: Tests only assert text presence and cannot prove runtime agent behavior.
  Impact: Behavior depends on instruction clarity.
  Mitigation: Use direct, redundant wording in the skill and include concrete examples.

- Risk: Mixed filename formats confuse readers.
  Impact: Session folder has old and new names.
  Mitigation: Treat new format as forward-only and keep all existing glob patterns artifact-suffix based.

## Assumptions

- Invocation context such as `$weave-capture session prd` or `/weave-capture session prd` is visible to the agent through the existing skill or wrapper flow.
- No compiled CLI support is needed for mode parsing in v1.
- Existing resume skills can continue reading session-only notes through current artifact-suffix glob patterns.

## Open Technical Questions

None.

## Product Questions Raised by Technical Design

None.

## Revision History

- 2026-05-31: Initial architecture generated from `prd.md` and codebase review.
