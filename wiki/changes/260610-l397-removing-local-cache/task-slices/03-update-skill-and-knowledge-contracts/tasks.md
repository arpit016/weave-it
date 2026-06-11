---
artifact: tasks
slice: 03-update-skill-and-knowledge-contracts
status: draft
owner: engineering
created_at: 2026-06-10T19:18:40.000Z
updated_at: 2026-06-10T19:18:40.000Z
source: architecture
---

# Tasks: Update Skill And Knowledge Contracts

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
| T1 | todo | hitl | weave-it | | Update bundled skill templates for explicit capture targets | None |
| T2 | todo | hitl | weave-it | | Update knowledge docs for branch-derived routing | T1 |
| T3 | todo | hitl | weave-it | | Verify skill and knowledge contract consistency | T2 |

## weave-it

### T1: Update bundled skill templates for explicit capture targets

Status: todo
Owner:
Repos: weave-it
Execution: hitl
Blocked by: None
Files:
- `templates/skills/weave-explore/SKILL.md` (M)
- `templates/skills/weave-prd/SKILL.md` (M)
- `templates/skills/weave-architect/SKILL.md` (M)
- `templates/skills/weave-capture/SKILL.md` (M)
- `templates/skills/weave-next/SKILL.md` (M)
- `src/lib/skill-template-checks.ts` (M)
- `tests/agent-skills.test.ts` (M)

### What to build

Remove all bundled skill instructions that call or read `weave artifact current`. Update capture and next-step guidance to rely on explicit targets, active branch-derived change, artifacts, sessions, and `status.yml`.

### Acceptance Criteria

- [ ] No bundled skill template contains `weave artifact current set`.
- [ ] No bundled skill template uses `weave artifact current --json` for lane routing.
- [ ] `weave-capture` explicitly asks for a target when none is provided.
- [ ] `weave-architect` remains read-only and recommends `weave-capture architecture` for persistence.
- [ ] `tests/agent-skills.test.ts` asserts the new template contract.

### Verification

- Automated tests: `npm run test -- tests/agent-skills.test.ts`
- Automated tests: `npm run typecheck`
- Manual/smoke check: search bundled skill templates for `weave artifact current` and confirm no routing references remain.

### T2: Update knowledge docs for branch-derived routing

Status: todo
Owner:
Repos: weave-it
Execution: hitl
Blocked by: T1
Files:
- `wiki/knowledge/domains/change-workflow/domain-wide/change-creation-and-stages.md` (M)
- `wiki/knowledge/domains/change-workflow/features/weave-capture/behavior.md` (M)
- `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md` (M)
- `wiki/knowledge/domains/change-workflow/domain-wide/workspace-aware-skill-context.md` (M)
- `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md` (M)

### What to build

Update current-state docs so they describe git-required change creation, workspace-root branch authority, explicit capture targets, removed artifact current commands, and ignored legacy session routing fields.

### Acceptance Criteria

- [ ] Change creation docs say `weave change new` requires git and no longer records local active change or artifact lane state.
- [ ] Capture docs remove stored artifact-context lookup as a routing step.
- [ ] Architect docs remove lane-commit commands.
- [ ] Workspace-aware docs state workspace root branch is active-change authority in workspace mode.
- [ ] CLI command reference no longer documents `weave artifact current` as supported behavior.

### Verification

- Automated tests: `npm run test -- tests/agent-skills.test.ts`
- Manual/smoke check: search knowledge docs for `weave artifact current`, `current_artifact`, and `current_change` and confirm any remaining mentions are historical or legacy-context-only.

### T3: Verify skill and knowledge contract consistency

Status: todo
Owner:
Repos: weave-it
Execution: hitl
Blocked by: T2
Files:
- `tests/agent-skills.test.ts` (M)
- `wiki/knowledge/domains/change-workflow/features/weave-capture/behavior.md` (M)

### What to build

Run template and documentation checks after skill and knowledge updates. Fix any mismatches between implemented behavior, PRD, architecture, and tests.

### Acceptance Criteria

- [ ] Skill tests pass.
- [ ] Full typecheck passes after template-check updates.
- [ ] No current-state knowledge doc presents stored local routing state as authoritative.

### Verification

- Automated tests: `npm run typecheck`
- Automated tests: `npm run test -- tests/agent-skills.test.ts`
- Automated tests: `npm run test`

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

Not run yet.
