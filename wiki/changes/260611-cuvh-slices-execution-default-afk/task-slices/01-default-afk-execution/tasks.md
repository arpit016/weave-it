---
artifact: tasks
slice: 01-default-afk-execution
status: draft
owner: engineering
created_at: 2026-06-11T18:24:00+05:30
updated_at: 2026-06-11T18:24:00+05:30
source: findings
---

# Tasks: Default generated tasks to afk in weave-slices

## Status Legend

- `todo`: ready when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without listed blocker
- `done`: implemented and verified
- `not_tested`: implementation complete, automated verification incomplete
- `invalid`: no longer applies

## Active Task Index

| ID | Status | Execution | Repos | Owner | Title | Blocked by |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | done | afk | weave-it | | Flip Execution default to afk in weave-slices skill copies | None |

## weave-it

### T1: Flip Execution default to afk in weave-slices skill copies

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: None
Files:
- templates/skills/weave-slices/SKILL.md (M)
- .agents/skills/weave-slices/SKILL.md (M)
- .claude/skills/weave-slices/SKILL.md (M)

### What to build

In each present copy of the `weave-slices` skill, replace the two HITL-by-default
lines with AFK-by-default policy.

1. In Generation Rules, replace:

   `` `Execution:` defaults to `hitl`. Promote to `afk` only when fully spec'd in `contracts.md` and mechanical. ``

   with:

   `` `Execution:` defaults to `afk` for all generated tasks. Use `hitl` only when the user explicitly asks to mark a particular architecture area, slice, or task as human-in-the-loop. ``

2. In Verification Tasks, replace:

   `Mark it `Execution: hitl` unless the steps are fully mechanical.`

   with:

   - `Manual verification tasks are `afk` only when the steps are fully mechanical and can be performed by the agent in the available environment.`
   - `Mark manual verification as `hitl` when it requires a browser-only check, product judgment, visual approval, credentials, customer data, production access, or human acceptance.`

Apply to all three copies that exist (`templates/`, `.agents/`, `.claude/`) so they stay in sync.

### Acceptance Criteria

- [x] Generation Rules line in all present copies states AFK-by-default with HITL only on explicit user request.
- [x] Verification Tasks guidance in all present copies uses the two-bullet AFK/HITL manual-verification policy.
- [x] No remaining `Execution:` defaults to `hitl` wording in the affected copies.

### Verification

- Automated tests: `rg -n "Execution:\\\` defaults to \\\`hitl" .agents/skills/weave-slices/SKILL.md .claude/skills/weave-slices/SKILL.md templates/skills/weave-slices/SKILL.md` returns no matches.
- Manual/smoke check: `rg -n "defaults to \\\`afk\\\`" templates/skills/weave-slices/SKILL.md` shows the new line.

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

T1: edited lines 66 and 80-82 in all three copies (`templates/`, `.agents/`,
`.claude/`). Search confirms no remaining `Execution:` defaults to `hitl` /
`Mark it Execution: hitl` wording, and the new afk-default + two-bullet
manual-verification policy is present in all three.
