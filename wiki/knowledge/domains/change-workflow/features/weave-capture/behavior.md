# weave-capture

## Purpose

`weave-capture` captures the current discussion into the active Weave change without storing a raw transcript. It runs in two modes:

- **Artifact capture** (bare `weave-capture`): creates a structured session note, promotes pending session context for the selected lane, and merges durable content into the corresponding live artifact (`exploration.md`, `prd.md`, or `architecture.md`).
- **Session-only capture** (`weave-capture session [exploration|prd|architecture]`): creates a lane-aware structured session note only, never updating live artifacts.

`weave-capture` is the only v1 flow that promotes pending session-only context into live artifacts.

## Current Behavior

Step order:

1. Discover session and active change via `weave workspace --json` and `weave change current --json`.
2. Resolve capture mode (artifact vs session-only) and resolve the lane.
3. **Defensive Lane Verification** (see below). If the resolved lane and conversation substance disagree, stop and ask the user to confirm the lane before any write.
4. Identify the active change folder, ensure `sessions/` exists, generate a timestamped session filename `YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md`.
5. Write the structured session note with `artifact`, `capture_mode`, and `captured_at` frontmatter and the standard section list (Summary, Decisions Made, Options Considered, Rejected Approaches, User Preferences, Agent Recommendations, Unresolved Points, Live Artifact Updates Applied, Next Resume Point).
6. For artifact-capture mode, merge durable content into the selected live artifact (preserving template structure and lifecycle frontmatter); apply the Lifecycle Staleness Verification Protocol before calling `weave change progress <lane>`.
7. For session-only mode, skip step 6 entirely; do not call lifecycle progress.

## Defensive Lane Verification

Before any write (session note or live artifact), `weave-capture` compares the resolved lane against the dominant subject of the conversation being captured:

- `exploration`: product discovery and stress-tested requirements.
- `prd`: user-facing requirements, acceptance criteria, scope, open questions.
- `architecture`: engineering design, module boundaries, tradeoffs, technical risks.

When the resolved lane (from explicit user input, `weave artifact current --json`, or `weave-capture session <lane>`) and the dominant subject clearly disagree, capture stops and asks the user:

```text
Stored artifact context is <lane>, but the conversation reads as <observed-lane>.
Capture this into: <lane> (keep stored context), <observed-lane> (switch), or another lane?
```

The user's reply becomes the resolved lane for the rest of the invocation. The skill never silently overrides the stored context. When the lane and the conversation are aligned, or when the conversation is too short or mixed to judge, the skill proceeds with the resolved lane without asking.

This step is a defensive recovery for a missed lane-commit upstream: if a plan-mode-required skill (`weave-explore`, `weave-architect` — see [Plan Mode Guard](../../domain-wide/plan-mode-guard.md)) was invoked outside Plan Mode and skipped its `weave artifact current set <lane>` call, or if any other design-discussion skill failed to commit the lane, the stored context drifts. The next `weave-capture` catches the drift here.

## Behavioral Rules

- Session-only capture must not create or update `exploration.md`, `prd.md`, or `architecture.md`.
- Session-only capture does not require the selected live artifact to exist and does not enforce upstream prerequisite artifacts.
- Artifact capture must not create `exploration.md`, `prd.md`, or `architecture.md` without a valid active change, valid target context, and enough selected-lane context. When the artifact does not exist, all matching lane session notes are considered; when it exists, only session notes newer than `updated_at` are considered.
- The capture session file is a continuation aid; live artifacts remain the durable current truth.
- `weave-capture` never reads cross-lane session notes (e.g. a PRD capture does not consider exploration sessions).
- The raw conversation transcript is never copied or stored.

## Integrations And Side Effects

- After a successful artifact-capture write, `weave-capture` calls `weave change progress <lane> --source <ids>` honoring the Lifecycle Staleness Verification Protocol: it may pass `--no-invalidate` or `--invalidate=<lanes>` based on content-sync verification, and may follow up with `weave change clear-stale <lane> --reason ...` for previously-stale dependents now in sync.
- Session-only mode never calls lifecycle progress.
- Both modes surface notices from the discovery commands per the `# Surface Weave Notices` contract.

## Source Anchors

- Canonical skill: `templates/skills/weave-capture/SKILL.md`
- Installed copies: `.agents/skills/weave-capture/SKILL.md`, `.claude/skills/weave-capture/SKILL.md`
- Opencode wrapper: `templates/opencode/commands/weave-capture.md`
- Plan Mode Protocol companion: `templates/skills/weave-prd/SKILL.md`, `templates/skills/weave-architect/SKILL.md`, `templates/skills/weave-clarify/SKILL.md`, `templates/skills/weave-explore/SKILL.md`
- Lifecycle CLI: `src/commands/change.ts` (`weave change progress`, `weave change clear-stale`)
- Tests: `tests/agent-skills.test.ts` (defensive verification anchors, byte-identity of embedded protocol blocks)

## Change History

- 2026-06-03 (change `260603-piln-npm-and-skill-versioning-and-updates`): added the `# Defensive Lane Verification` step (lane vs conversation-substance comparison with explicit user ask on mismatch); embedded the byte-identical `# Lifecycle Staleness Verification` and `# Surface Weave Notices` blocks.

## Open Questions

- Whether to expose lane-mismatch ambiguity decisions in `wiki/changes/<change-id>/sessions/*.md` (current behavior: only the resolved lane is recorded, not the prompt-and-answer).
