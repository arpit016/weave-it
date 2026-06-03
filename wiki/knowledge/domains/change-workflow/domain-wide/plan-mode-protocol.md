# Plan Mode Protocol

## Purpose

Reliably set per-skill artifact context (`weave artifact current set <lane>`) across every supported agent harness, including those that block filesystem-write tool calls in plan/ask/read-only collaboration modes.

## Background

Every supported agent harness (Claude, Cursor, Codex, opencode) has at least one collaboration mode that blocks mutations: plan mode, ask mode, read-only mode. Design-discussion skills want to invoke `weave artifact current set <lane>` as their first action so subsequent skills (`weave-capture`, `weave-next`) can resume in the correct lane. A naive "always call set on entry" pattern silently fails inside plan mode, leaving stored artifact context out of sync with the conversation lane.

## Current Behavior

Four design-discussion skills embed a byte-identical `# Plan Mode Protocol` section with the lane substituted in:

- `weave-explore` (lane: `exploration`)
- `weave-prd` (lane: `prd`)
- `weave-architect` (lane: `architecture`)
- `weave-clarify` (lane: `<target>`, resolved at runtime from the user's clarification target)

The protocol is a two-phase agent contract; the CLI itself is not aware of it.

### Phase 1: harness blocks mutations (plan/ask/read-only mode)

The agent:

1. Does NOT invoke `weave artifact current set <lane>`.
2. Declares the target lane at the top of the plan output: `Lane: <lane>`.
3. Ends the plan output with the exact directive: `On plan acceptance, the first action will be: weave artifact current set <lane> --json`.

### Phase 2: harness allows mutations (Agent Mode after plan acceptance, or direct Agent Mode entry)

The agent:

1. Makes `weave artifact current set <lane> --json` its FIRST tool call.
2. Proceeds with the rest of the skill's discovery and work.

The two phases are explicit so the agent does not have to detect mode programmatically; the harness's mode transitions drive the phase, and the protocol prose tells the agent what to do in each.

## Behavioral Rules

- The protocol applies only to the four design-discussion skills above; `weave-new`, `weave-next`, `weave-issues`, `weave-knowledge`, `weave-propagate`, and `weave-capture` are explicitly excluded.
- The protocol text is byte-identical across the four skills modulo the `<lane>` placeholder substitution. Drift is prevented by a test against `EXPECTED_PLAN_MODE_PROTOCOL` in `src/lib/skill-template-checks.ts`.
- `weave-clarify` substitutes `<target>` (not a fixed lane) because the user picks the lane to clarify at invocation time.
- No CLI flag, env var, or programmatic API is part of the protocol. It is a pure prose contract addressed to the agent.

## Defensive Companion: weave-capture

`weave-capture` does not carry the Plan Mode Protocol itself (capture is not a design-discussion skill and runs in Agent Mode by design). Instead it carries a `# Defensive Lane Verification` step that detects when the stored artifact context drifts from the conversation substance (see [features/weave-capture/behavior.md](../features/weave-capture/behavior.md)). Together they form the recovery path when an agent skips Phase 2 anyway.

## Source Anchors

- Skill contract source: `EXPECTED_PLAN_MODE_PROTOCOL` in `src/lib/skill-template-checks.ts`
- Templates embedding the protocol: `templates/skills/weave-explore/SKILL.md`, `templates/skills/weave-prd/SKILL.md`, `templates/skills/weave-architect/SKILL.md`, `templates/skills/weave-clarify/SKILL.md`
- Companion: `templates/skills/weave-capture/SKILL.md` (`# Defensive Lane Verification` section)
- Tests: `tests/agent-skills.test.ts` (byte-identity and non-presence in excluded skills)

## Change History

- 2026-06-03 (change `260603-piln-npm-and-skill-versioning-and-updates`): protocol introduced as byte-identical prose in the four design-discussion skills; companion `# Defensive Lane Verification` step added to `weave-capture`; byte-identity test added to prevent drift.

## Open Questions

- Whether to also embed the protocol in `weave-explore`'s sibling for new-change creation (`weave-new`) once exploration patterns evolve. v1 explicitly scopes to the four design-discussion skills.
