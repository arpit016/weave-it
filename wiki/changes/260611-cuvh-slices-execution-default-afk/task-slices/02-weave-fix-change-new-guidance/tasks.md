---
artifact: tasks
slice: 02-weave-fix-change-new-guidance
status: draft
owner: engineering
created_at: 2026-06-11T18:42:00+05:30
updated_at: 2026-06-11T18:42:00+05:30
source: findings
---

# Tasks: Correct weave-fix change-creation guidance

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
| T1 | done | afk | weave-it | | Rewrite weave-fix step 2 across skill copies | None |

## weave-it

### T1: Rewrite weave-fix step 2 across skill copies

Status: done
Owner:
Repos: weave-it
Execution: afk
Blocked by: None
Files:
- templates/skills/weave-fix/SKILL.md (M)
- .agents/skills/weave-fix/SKILL.md (M)
- .claude/skills/weave-fix/SKILL.md (M)

### What to build

Replace the Single-Turn Flow step 2 line `Run \`weave new --type fix <slug>\`.`
in each present copy of the `weave-fix` skill with corrected guidance that:

1. Uses the real command: `weave change new "<title>" --type fix [--slug <slug>]`.
2. Reads the current branch first (e.g. `weave change current --json`) and only
   creates a new change when the current branch is NOT already a valid
   `change/<change-id>` fix branch. When it already is one, treat the invocation
   as re-invocation on the existing change (update `findings.md`, do not create).
3. States workspace-root authority: in workspace mode the change is created at
   and owned by the workspace root even when invoked from a registered sub-repo.

Apply to all three copies that exist (`templates/`, `.agents/`, `.claude/`) so
they stay in sync. Keep the rest of the Single-Turn Flow intact.

### Acceptance Criteria

- [x] No copy references `weave new --type fix`; the command reads `weave change new ... --type fix`.
- [x] Step 2 instructs a branch check first and skips creation when already on a valid `change/<id>` fix branch (re-invocation path).
- [x] Step 2 states workspace-root authority for change creation in workspace mode.

### Verification

- Automated tests: `rg -n "weave new --type fix" .agents/skills/weave-fix/SKILL.md .claude/skills/weave-fix/SKILL.md templates/skills/weave-fix/SKILL.md` returns no matches.
- Manual/smoke check: `rg -n "weave change new" templates/skills/weave-fix/SKILL.md` shows the corrected command in step 2.

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

T1: rewrote step 2 (line 45) in all three copies. Search confirms no remaining
`weave new --type fix` reference and the corrected `weave change new "<title>"
--type fix` command plus branch-awareness and workspace-root authority are
present in all three. Branch check refined per user direction to be structural:
if the current branch follows the `change/<change-id>` structure (an existing
change), continue on that change and write/update `findings.md`; otherwise
create a new change. Dropped the stricter "fix-type branch" qualifier so it
matches how Weave derives the active change from the branch.
