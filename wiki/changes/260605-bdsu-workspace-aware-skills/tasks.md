---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-04T19:59:23.000Z
updated_at: 2026-06-04T20:04:24.000Z
source: prd.md
---

# Tasks: Workspace-aware skills

## Source Context

- PRD: `wiki/changes/260605-bdsu-workspace-aware-skills/prd.md`
- Architecture: not used; template-text-only chore
- Codebase: `templates/skills/*.md`, `src/lib/workspace-mode.ts`, `src/lib/show-workspace.ts`, `src/lib/changes.ts`
- Local references: `.cursor/plans/workspace-aware_skills_b22a8b55.plan.md`
- External references: none

## Local Tracking Status

External issue publishing status: not used. This change tracks implementation locally in this file.

## Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified
- `not_tested`: implementation appears complete, but automated verification could not be completed
- `invalid`: no longer applies after source context changed

## Active Task Index

| ID | Status | Type | Title | Blocked by |
| --- | --- | --- | --- | --- |
| T1 | done | AFK | Update weave-explore context wording | None |
| T2 | done | AFK | Update weave-prd context wording | T1 |
| T3 | done | AFK | Update weave-architect context wording | T1 |
| T4 | done | AFK | Update weave-clarify context wording | T1 |
| T5 | done | AFK | Sanity pass remaining skill templates | T1 |
| T6 | done | AFK | Verify template changes and lifecycle | T1, T2, T3, T4, T5 |

## T1: Update weave-explore context wording

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: None

Origin: none

Related finding: none

### What to build

Update `templates/skills/weave-explore/SKILL.md` so its discovery phase uses the cwd-dispatched workspace-or-repo context from `weave workspace --json`. In workspace mode, the workspace root is the single exploration/change context and `repos[]` are implementation locations. In repo mode, session folders remain the boundary.

### Acceptance Criteria

- [x] The skill no longer treats `folders[]` as the only exploration boundary.
- [x] The skill explains workspace-root ownership of change artifacts in workspace mode.
- [x] The old "every folder in the session" language is replaced with mode-aware context language.

### Verification

- Automated tests: covered by T6 full suite.
- Manual/smoke check: read the Resolve Context section and confirm it makes sense when `workspace != null` and `folders: []`.

## T2: Update weave-prd context wording

Status: done

Type: AFK

Blocked by: T1

User stories covered: None

Origin: none

Related finding: none

### What to build

Update `templates/skills/weave-prd/SKILL.md` so context loading, change-folder identification, relevance guidance, and completion language distinguish workspace mode's single root context from repo mode's possible multiple session folders.

### Acceptance Criteria

- [x] The skill uses the cwd-dispatched workspace-or-repo context as the boundary.
- [x] The skill identifies `wiki/changes/<change-id>/` under the resolved context, not "each relevant workspace folder."
- [x] The completion response only lists multiple PRDs for multiple repo-mode contexts, not for workspace-mode sub-repos.

### Verification

- Automated tests: covered by T6 full suite.
- Manual/smoke check: inspect the Resolve Context and Completion Response sections.

## T3: Update weave-architect context wording

Status: done

Type: AFK

Blocked by: T1

User stories covered: None

Origin: none

Related finding: none

### What to build

Update `templates/skills/weave-architect/SKILL.md` using the same cwd-dispatched context model as `weave-prd`, including completion language for multiple repo-mode contexts versus the single workspace-mode context.

### Acceptance Criteria

- [x] The skill uses the cwd-dispatched workspace-or-repo context as the boundary.
- [x] The skill identifies the change folder under the resolved context.
- [x] The completion response does not imply workspace sub-repos are separate architecture artifact targets.

### Verification

- Automated tests: covered by T6 full suite.
- Manual/smoke check: inspect the Resolve Context and Completion Response sections.

## T4: Update weave-clarify context wording

Status: done

Type: AFK

Blocked by: T1

User stories covered: None

Origin: none

Related finding: none

### What to build

Update `templates/skills/weave-clarify/SKILL.md` so clarification work targets the resolved workspace or repo context. In workspace mode, clarify one artifact in the workspace root change; in repo mode, preserve the existing session-folder framing.

### Acceptance Criteria

- [x] The skill uses the cwd-dispatched workspace-or-repo context as the boundary.
- [x] "Relevant workspace folder" language is removed.
- [x] The skill keeps its single-artifact clarification behavior unchanged.

### Verification

- Automated tests: covered by T6 full suite.
- Manual/smoke check: inspect the Resolve Context and Target Artifact sections.

## T5: Sanity pass remaining skill templates

Status: done

Type: AFK

Blocked by: T1

User stories covered: None

Origin: none

Related finding: none

### What to build

Review `templates/skills/weave-capture/SKILL.md`, `templates/skills/weave-knowledge/SKILL.md`, `templates/skills/weave-issues/SKILL.md`, `templates/skills/weave-new/SKILL.md`, and `templates/skills/weave-next/SKILL.md` for stale workspace-folder iteration assumptions. Only edit if a real incompatibility is found.

### Acceptance Criteria

- [x] No remaining skill tells agents to treat workspace-mode `folders[]` as the source of truth.
- [x] `weave-new` and `weave-next` remain the reference wording for workspace mode.
- [x] No unnecessary template churn is introduced.

### Verification

- Automated tests: covered by T6 full suite.
- Manual/smoke check: grep the skill templates for stale "workspace folder" and "returned folders" assumptions.

## T6: Verify template changes and lifecycle

Status: done

Type: AFK

Blocked by: T1, T2, T3, T4, T5

User stories covered: None

Origin: none

Related finding: none

### What to build

Run the existing verification suite and skill diff/status checks. Record knowledge delta for the skill template behavior, mark knowledge updated, and progress the issues lane.

### Acceptance Criteria

- [x] `npm test` passes.
- [x] Skill diff/status output is inspected for expected template/install state.
- [x] `knowledge-delta.md` records the durable template behavior change.
- [x] `weave change knowledge updated` records knowledge state.
- [x] `weave change progress issues` records task lifecycle progress.

### Verification

- Automated tests: `npm test`
- Manual/smoke check: `npm run dev -- skills diff --agent all` or the closest supported local command; `npm run dev -- change status --json`

## QA Findings

Finding Status Legend:

- `new`: reported but not yet triaged
- `accepted`: triaged and accepted as a real defect
- `fixed`: implementation believed to address the defect
- `verified`: fix confirmed by re-test
- `duplicate`: already covered by another finding
- `not_reproducible`: could not be reproduced
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

Refactor Status Legend:

- `proposed`: identified but not yet accepted
- `accepted`: agreed to do as part of this change
- `deferred`: logged for later; no `T#` yet
- `done`: completed and verified behavior-preserving
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |
| R1 | deferred | `src/lib/session-state.ts` | None | Fresh-clone workspace users who run `weave change new` before `weave init` get a local session folder with `kind: "app"` even though committed truth is workspace mode. Cosmetic follow-up; not part of this template-text change. |

## Invalid Tasks

None.

## Verification

- `npm test`: 147 passed (2026-06-04)
- `npm run dev -- agent diff all`: no differences across installed agent skill copies and opencode commands (2026-06-04)
- `npm run dev -- change progress issues --source prd --source codebase --json`: passed; change is at `stage: issues` (2026-06-04)
- `npm run dev -- change knowledge updated ... --json`: passed after issues progression; knowledge status is `updated` (2026-06-04)
