# Plan Mode Guard

## Purpose

Force the two plan-mode-required design-discussion skills (`weave-explore`, `weave-architect`) into Plan Mode at entry, and make their lane-commit behavior explicit. Skills that are not plan-mode-required (`weave-prd`, `weave-clarify`, all non-design-discussion skills) do not carry the guard.

## Current Behavior

`weave-explore` and `weave-architect` open with a byte-identical `# Plan Mode Guard` section. The guard does three things:

1. Refuses entry when the host harness exposes a collaboration mode and the current mode is not Plan Mode. The skill stops with: `This skill must run in Plan Mode. Switch to Plan Mode, then invoke <skill-name> again.`
2. Declares the lane-commit step: in Plan Mode, the skill commits the active artifact lane to local Weave session state via `weave artifact current set <lane> --json`. The guard is explicit that this call writes local session state only (not a repo-tracked artifact) and IS allowed in Plan Mode. The call must happen after the active Weave change is resolved and before any other discovery work.
3. Forbids repo-tracked artifact writes inside Plan Mode. The skill produces the plan, decisions, and proposed artifact changes for user approval; actual artifact writes happen only after the user exits Plan Mode and asks to implement the plan.

The `weave artifact current set <lane>` body call in each skill's discovery section remains as the concrete WHERE-in-the-flow marker; the guard owns the rationale (allowed in Plan Mode, why it's safe).

## Why Only Two Skills

| Skill | Plan-mode-required? | Lane-entry semantics | Notes |
|---|---|---|---|
| `weave-explore` | yes | enters/resumes the exploration lane; can be resumed mid-conversation by `weave-capture`/`weave-next` | needs the lane-commit so downstream skills resume in the right context |
| `weave-architect` | yes | enters/resumes the architecture lane; same resumption pattern | read-only thinking partner; durable architecture writes happen later through `weave-capture` or structural changes through `weave-clarify` |
| `weave-prd` | no — Agent Mode | enters the PRD lane and writes `prd.md` directly | already calls `weave artifact current set prd` in its body in Agent Mode where no guard is needed |
| `weave-clarify` | no — Agent Mode | amends one named artifact (`<target>` is a one-shot argument) and exits | does not enter a lane in the resumption sense; calls `weave change progress <target>` at the end; does not need the lane-commit |
| Other 5 skills | no | not design-discussion | guard does not apply |

The narrow scope is enforced by tests: `EXPECTED_PLAN_MODE_GUARD` byte-identity assertion across `weave-explore` and `weave-architect` only, and a non-presence assertion against the other shipped skills.

## Behavioral Rules

- The guard text is byte-identical across the two skills modulo `<lane>` (`exploration` / `architecture`) and `<skill-name>` (`weave-explore` / `weave-architect`) substitution. Drift is prevented by `EXPECTED_PLAN_MODE_GUARD` in `src/lib/skill-template-checks.ts`.
- The guard is a prose contract addressed to the agent; the CLI does not enforce mode, does not block writes, and does not validate that the lane was set.
- `weave artifact current set <lane> --json` writes only `.weave/session/<id>.yml` (local session state). It does not modify any repo-tracked file.
- `weave-architect` remains plan-mode-required but is read-only: it gathers context, interviews, and returns architecture dissection in chat; it does not create, edit, or progress architecture artifacts.
- Skills that do not carry the guard follow their own entry semantics: `weave-prd` and `weave-clarify` run in Agent Mode and call `weave artifact current set` (or its equivalent end-step) without ceremony; the other non-design skills (`weave-new`, `weave-next`, `weave-issues`, `weave-knowledge`, `weave-capture`) have no lane-entry semantics that require the guard.

## Defensive Companion: weave-capture

`weave-capture` carries a separate `# Defensive Lane Verification` step (see [features/weave-capture/behavior.md](../features/weave-capture/behavior.md)) that detects when stored artifact context disagrees with the conversation substance. This catches drift if the user invoked a guarded skill outside Plan Mode and bypassed the lane-commit anyway.

## Source Anchors

- Canonical guard text: `EXPECTED_PLAN_MODE_GUARD` in `src/lib/skill-template-checks.ts`
- Skills carrying the guard: `templates/skills/weave-explore/SKILL.md`, `templates/skills/weave-architect/SKILL.md`
- Skills explicitly NOT carrying the guard: every other `templates/skills/<name>/SKILL.md`
- Companion safety net: `templates/skills/weave-capture/SKILL.md` (`# Defensive Lane Verification` section)
- Tests: `tests/agent-skills.test.ts` ("embeds the Plan Mode Guard verbatim in weave-explore and weave-architect only", "does not embed the Plan Mode Guard in skills that are not plan-mode-required")

## Change History

- 2026-06-03 (change `260603-piln-npm-and-skill-versioning-and-updates`): initial design landed a two-phase `# Plan Mode Protocol` in all four design-discussion skills, deferring `weave artifact current set` until post-acceptance Phase 2. That design collided with the pre-existing Plan Mode Guard in `weave-explore` and `weave-architect` and inverted the actually-correct rule. Recovery (QF1/T12 in the same change): the Plan Mode Protocol was removed from all four skills; the Plan Mode Guard was strengthened to explicitly authorize `weave artifact current set <lane>` in Plan Mode (because it writes session state only); the guard was kept on exactly the two plan-mode-required skills (`weave-explore`, `weave-architect`); `weave-prd` and `weave-clarify` were confirmed as Agent Mode skills and left without the guard.
- 2026-06-06 (change `260606-k0l6-architecture-folder`): `weave-architect` stayed plan-mode-required but became read-only; architecture persistence moved to `weave-capture`, and structural architecture changes are handled by `weave-clarify`.

## Open Questions

- Whether the CLI should add a soft warning when a Tier 1 command runs and the active artifact context disagrees with what the most recent design-discussion skill should have set. Currently the only catch is `weave-capture`'s Defensive Lane Verification.
