# Plan Mode Guard

## Purpose

Force the two plan-mode-required design-discussion skills (`weave-explore`, `weave-architect`) into Plan Mode at entry, and make their explicit lane target behavior clear. Skills that are not plan-mode-required (`weave-prd`, `weave-clarify`, all non-design-discussion skills) do not carry the guard.

## Current Behavior

`weave-explore` and `weave-architect` open with a byte-identical `# Plan Mode Guard` section. The guard does three things:

1. Refuses entry when the host harness exposes a collaboration mode and the current mode is not Plan Mode. The skill stops with: `This skill must run in Plan Mode. Switch to Plan Mode, then invoke <skill-name> again.`
2. Declares the explicit lane target: in Plan Mode, the skill resolves the active branch-derived change and treats `<lane>` as the target lane without writing local artifact lane state.
3. Forbids repo-tracked artifact writes inside Plan Mode. The skill produces the plan, decisions, and proposed artifact changes for user approval; actual artifact writes happen only after the user exits Plan Mode and asks to implement the plan.

The Tier 1 discovery commands in each skill remain the concrete WHERE-in-the-flow marker for active change resolution; the guard owns the Plan Mode and no-write rationale.

## Why Only Two Skills

| Skill | Plan-mode-required? | Lane-entry semantics | Notes |
|---|---|---|---|
| `weave-explore` | yes | enters/resumes the exploration lane; can be resumed mid-conversation by `weave-capture`/`weave-next` | uses explicit exploration target context |
| `weave-architect` | yes | enters/resumes the architecture lane; same resumption pattern | read-only thinking partner; durable architecture writes happen later through `weave-capture` or structural changes through `weave-clarify` |
| `weave-prd` | no — Agent Mode | enters the PRD lane and writes `prd.md` directly | uses explicit `prd.md` target context |
| `weave-clarify` | no — Agent Mode | amends one named artifact (`<target>` is a one-shot argument) and exits | does not enter a lane in the resumption sense; calls `weave change progress <target>` at the end; does not need the lane-commit |
| Other 5 skills | no | not design-discussion | guard does not apply |

The narrow scope is enforced by tests: `EXPECTED_PLAN_MODE_GUARD` byte-identity assertion across `weave-explore` and `weave-architect` only, and a non-presence assertion against the other shipped skills.

## Behavioral Rules

- The guard text is byte-identical across the two skills modulo `<lane>` (`exploration` / `architecture`) and `<skill-name>` (`weave-explore` / `weave-architect`) substitution. Drift is prevented by `EXPECTED_PLAN_MODE_GUARD` in `src/lib/skill-template-checks.ts`.
- The guard is a prose contract addressed to the agent; the CLI does not enforce mode, block writes, or validate the selected lane.
- Guarded skills do not write local session state for artifact lane routing.
- `weave-architect` remains plan-mode-required but is read-only: it gathers context, interviews, and returns architecture dissection in chat; it does not create, edit, or progress architecture artifacts.
- Skills that do not carry the guard follow their own entry semantics: `weave-prd` and `weave-clarify` run in Agent Mode with explicit targets; the other non-design skills (`weave-new`, `weave-next`, `weave-knowledge`, `weave-capture`) have no lane-entry semantics that require the guard.

## Defensive Companion: weave-capture

`weave-capture` carries a separate `# Defensive Lane Verification` step (see [features/weave-capture/behavior.md](../features/weave-capture/behavior.md)) that detects when the explicit selected lane disagrees with the conversation substance.

## Source Anchors

- Canonical guard text: `EXPECTED_PLAN_MODE_GUARD` in `src/lib/skill-template-checks.ts`
- Skills carrying the guard: `templates/skills/weave-explore/SKILL.md`, `templates/skills/weave-architect/SKILL.md`
- Skills explicitly NOT carrying the guard: every other `templates/skills/<name>/SKILL.md`
- Companion safety net: `templates/skills/weave-capture/SKILL.md` (`# Defensive Lane Verification` section)
- Tests: `tests/agent-skills.test.ts` ("embeds the Plan Mode Guard verbatim in weave-explore and weave-architect only", "does not embed the Plan Mode Guard in skills that are not plan-mode-required")

## Change History

- 2026-06-03 (change `260603-piln-npm-and-skill-versioning-and-updates`): initial design landed a two-phase `# Plan Mode Protocol` in all four design-discussion skills, deferring `weave artifact current set` until post-acceptance Phase 2. That design collided with the pre-existing Plan Mode Guard in `weave-explore` and `weave-architect` and inverted the actually-correct rule. Recovery (QF1/T12 in the same change): the Plan Mode Protocol was removed from all four skills; the Plan Mode Guard was strengthened to explicitly authorize `weave artifact current set <lane>` in Plan Mode (because it writes session state only); the guard was kept on exactly the two plan-mode-required skills (`weave-explore`, `weave-architect`); `weave-prd` and `weave-clarify` were confirmed as Agent Mode skills and left without the guard.
- 2026-06-06 (change `260606-k0l6-architecture-folder`): `weave-architect` stayed plan-mode-required but became read-only; architecture persistence moved to `weave-capture`, and structural architecture changes are handled by `weave-clarify`.
- 2026-06-11 (change `260610-l397-removing-local-cache`): removed local artifact lane commits from the guard. Guarded skills now resolve the branch-derived active change and use explicit lane targets.

## Open Questions

- None at this time.
