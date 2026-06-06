---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-06T22:39:39.000Z
updated_at: 2026-06-06T22:49:22.000Z
source: architecture
---

# Tasks: Workspace-Aware Issues

## Source Context

- PRD: `wiki/changes/260607-ycuo-workspace-aware-issues/prd.md`
- Architecture: `wiki/changes/260607-ycuo-workspace-aware-issues/architecture/index.md`
- Sessions: `wiki/changes/260607-ycuo-workspace-aware-issues/sessions/20260607-034515-k9m2-prd.md`, `wiki/changes/260607-ycuo-workspace-aware-issues/sessions/20260607-035352-r4q8-architecture.md`
- Codebase: `templates/skills/weave-issues/SKILL.md`, `.agents/skills/weave-issues/SKILL.md`, `.claude/skills/weave-issues/SKILL.md`, `templates/opencode/commands/weave-issues.md`, `tests/agent-skills.test.ts`, `wiki/knowledge/domains/change-workflow/features/weave-issues/behavior.md`
- External references: None
- Local references: None

## Coverage Review

PRD coverage:

- Covered: one canonical `tasks.md`, scoped `weave-issues` invocation semantics, tracer-bullet preservation for scoped tasks, `Scope: full-stack` when behavior crosses backend/frontend, repo and architecture metadata for future implementers, scoped rerun behavior, no rigid scope taxonomy, no per-repo task artifacts, no execution semantics.

Architecture coverage:

- Covered: exact `weave-issues` insertion points, canonical skill template edits, installed skill copy propagation, task template metadata, optional `Repo Involvement`, opencode wrapper decision, test assertions, knowledge update, and verification commands.

PRD/Architecture sync:

- In sync: both artifacts preserve one `tasks.md`, free-form scope labels, no new lifecycle lane, no per-repo task files, and no execution tracking. The architecture resolves the PRD open question by recommending `Repo Involvement` only for multi-repo and ambiguous-location tasks.

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

| ID | Status | Type | Scope | Primary repo | Repos | Title | Blocked by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | done | AFK | docs | `weave-it` | `weave-it` | Update canonical `weave-issues` scoped behavior | None |
| T2 | done | AFK | docs | `weave-it` | `weave-it` | Update canonical task template shape | T1 |
| T3 | done | AFK | docs | `weave-it` | `weave-it` | Propagate checked-in installed skill copies | T1, T2 |
| T4 | done | AFK | tests | `weave-it` | `weave-it` | Lock scope-aware behavior with tests | T1, T2, T3 |
| T5 | done | AFK | docs | `weave-it` | `weave-it` | Update current-state knowledge | T1, T2 |
| T6 | done | AFK | verification | `weave-it` | `weave-it` | Run verification and progress issues lane | T1, T2, T3, T4, T5 |

## T1: Update canonical `weave-issues` scoped behavior

Status: done

Type: AFK

Scope: docs

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-ycuo-workspace-aware-issues/architecture/index.md`

Coordination: None

Blocked by: None - can start immediately

User stories covered: backend engineer, frontend engineer, full-stack engineer, task-generating agent

Origin: none

Related finding: none

### What to build

Update `templates/skills/weave-issues/SKILL.md` with the exact architecture wording for scope handling and scoped tracer-bullet behavior.

This includes:

- `weave-issues <scope>` as a free-form planning and ownership label
- scope not being a repo, facet, technical layer, lifecycle lane, or artifact target
- scoped runs reading all relevant source context, not only same-named facets
- workspace `repos[]` as implementation-location evidence, not task artifact targets
- scoped tasks remaining tracer bullets, with bad/good backend/frontend/full-stack examples
- scoped runs being allowed to propose `Scope: full-stack`
- anti-rules for per-repo task files, per-repo statuses, rigid scope legends, and artificial backend/frontend splits

### Acceptance Criteria

- [x] `templates/skills/weave-issues/SKILL.md` documents `weave-issues <scope>` after `### 1. Gather Context`.
- [x] The skill states that scope is not a repo name, architecture facet name, technical layer, lifecycle lane, or artifact target.
- [x] The skill states scoped runs may propose `Scope: full-stack` tasks when behavior crosses backend/frontend boundaries.
- [x] The skill explains that scoped runs still read all relevant source context.
- [x] The skill includes bad/good scoped tracer-bullet examples.
- [x] The skill explicitly forbids `tasks/<repo>/tasks.md` and per-repo task artifacts.

### Verification

- Automated tests: covered by T4 assertions and T6 full verification.
- Manual/smoke check: updated `### 1. Gather Context`, `### 2. Explore The Codebase`, `### 4. Draft Vertical-Slice Tasks`, and `### 6. Write Or Reconcile Local tasks.md` sections inspected during implementation.

## T2: Update canonical task template shape

Status: done

Type: AFK

Scope: docs

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-ycuo-workspace-aware-issues/architecture/index.md`

Coordination: None

Blocked by: T1

User stories covered: task-generating agent, future implementing agent

Origin: none

Related finding: none

### What to build

Update the embedded `<tasks-template>` in `templates/skills/weave-issues/SKILL.md` so generated tasks carry scope and implementation-location metadata.

The active task index should include:

```md
| ID | Status | Type | Scope | Primary repo | Repos | Title | Blocked by |
```

Each `T#` detail should include:

```md
Scope: <backend | frontend | full-stack | user-provided label>
Primary repo: <repo id or workspace>
Repos: <repo ids, or None>
Architecture refs: <relevant architecture files/facets, or None>
Coordination: <none or concrete cross-scope note>
```

Multi-repo or ambiguous-location tasks should include optional `### Repo Involvement` guidance with repo role, likely code anchors, and likely test/verification anchors.

### Acceptance Criteria

- [x] The active task index in the template has `Scope`, `Primary repo`, and `Repos` columns.
- [x] Each `T#` template detail block includes `Scope`, `Primary repo`, `Repos`, `Architecture refs`, and `Coordination`.
- [x] Optional `### Repo Involvement` appears after `### What to build` and before `### Acceptance Criteria`.
- [x] `Repo Involvement` is documented as implementation guidance only, not subtask tracking.
- [x] `Repo Involvement` has no per-repo status column.

### Verification

- Automated tests: covered by T4 assertions and T6 full verification.
- Manual/smoke check: `<tasks-template>` inspected and confirmed to match the architecture placement guidance.

## T3: Propagate checked-in installed skill copies

Status: done

Type: AFK

Scope: docs

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-ycuo-workspace-aware-issues/architecture/index.md`

Coordination: None

Blocked by: T1, T2

User stories covered: task-generating agent

Origin: none

Related finding: none

### What to build

Copy the canonical `templates/skills/weave-issues/SKILL.md` content into checked-in installed copies:

- `.agents/skills/weave-issues/SKILL.md`
- `.claude/skills/weave-issues/SKILL.md`

Confirm `templates/opencode/commands/weave-issues.md` does not need a behavior change because it already passes `$ARGUMENTS` as context.

### Acceptance Criteria

- [x] `.agents/skills/weave-issues/SKILL.md` matches the canonical template.
- [x] `.claude/skills/weave-issues/SKILL.md` matches the canonical template.
- [x] Opencode command wrapper is left unchanged unless implementation discovers a concrete reason to update its description.
- [x] `.weave/agents.yml` is not hand-edited.

### Verification

- Automated tests: covered by existing installation/assertion tests and T6 full verification.
- Manual/smoke check: `cmp` confirmed installed copies match `templates/skills/weave-issues/SKILL.md`.

## T4: Lock scope-aware behavior with tests

Status: done

Type: AFK

Scope: tests

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-ycuo-workspace-aware-issues/architecture/index.md`

Coordination: None

Blocked by: T1, T2, T3

User stories covered: task-generating agent, maintainer

Origin: none

Related finding: none

### What to build

Add assertions near the existing `issuesSkill` checks in `tests/agent-skills.test.ts` for the new scoped behavior and template shape.

Assertions should cover:

- `If the user invokes `weave-issues <scope>``
- scope not being a repo/facet/layer/lane/artifact target
- scoped runs proposing `Scope: full-stack`
- new active task index columns
- `Architecture refs`
- `### Repo Involvement`
- `Repo Involvement` as implementation guidance only
- `Do not create `tasks/<repo>/tasks.md``

### Acceptance Criteria

- [x] `tests/agent-skills.test.ts` asserts the new scope argument wording.
- [x] The test asserts the new task index shape.
- [x] The test asserts `Architecture refs` and `Repo Involvement` wording.
- [x] The test asserts the per-repo task file anti-rule.
- [x] Test assertions do not over-constrain optional opencode wrapper wording.

### Verification

- Automated tests: `npm run test` passed in T6.
- Manual/smoke check: assertion placement inspected near the existing installed opencode `issuesSkill` checks.

## T5: Update current-state knowledge

Status: done

Type: AFK

Scope: docs

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-ycuo-workspace-aware-issues/architecture/index.md`

Coordination: None

Blocked by: T1, T2

User stories covered: maintainer

Origin: none

Related finding: none

### What to build

Update `wiki/knowledge/domains/change-workflow/features/weave-issues/behavior.md` to reflect the new current behavior after implementation.

Knowledge should mention:

- scope-aware task generation using free-form labels such as `backend`, `frontend`, and `full-stack`
- scope as planning/ownership metadata, not repo/facet/layer/lane/artifact target
- `T#` metadata fields for scope, primary repo, repos, architecture refs, and coordination
- optional `Repo Involvement` for multi-repo or ambiguous-location tasks
- scoped reruns preserving unrelated scope tasks and reconciling matching-scope tasks
- unchanged invariants: one `tasks.md`, same `issues` lane, no per-repo task artifacts

### Acceptance Criteria

- [x] Knowledge `Domain Model` reflects the new task index and `T#` metadata.
- [x] Knowledge `Behavioral Rules` covers scoped runs and scoped reruns.
- [x] Knowledge `Invariants` still states `tasks.md` is the only file `weave-issues` writes.
- [x] Change history records this change.

### Verification

- Automated tests: no direct knowledge test expected; covered by T6 full verification for repo health.
- Manual/smoke check: `weave-issues/behavior.md` read for consistency with the implemented skill text.

## T6: Run verification and progress issues lane

Status: done

Type: AFK

Scope: verification

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-ycuo-workspace-aware-issues/architecture/index.md`

Coordination: None

Blocked by: T1, T2, T3, T4, T5

User stories covered: all

Origin: none

Related finding: none

### What to build

Run verification after implementation and reconcile any failures caused by changed skill wording or installed copy expectations.

After successful verification, progress the `issues` lane with the sources that informed this task breakdown.

### Acceptance Criteria

- [x] `npm run typecheck` passes.
- [x] `npm run test` passes.
- [x] Skill template and installed copies are internally consistent.
- [x] Knowledge matches implemented behavior.
- [x] `weave change progress issues` records `prd`, `architecture`, and `codebase` as sources.

### Verification

- Automated tests: `npm run typecheck` passed; `npm run test` passed with 164 tests.
- Manual/smoke check: `npm run dev -- change status --json` passed after final issues progress with no notices.

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

None.

## Invalid Tasks

None.

## Verification

- `npm run typecheck`: passed (2026-06-06)
- `npm run test`: 13 test files passed, 164 tests passed (2026-06-06)
- `cmp -s templates/skills/weave-issues/SKILL.md .agents/skills/weave-issues/SKILL.md` and `.claude/skills/weave-issues/SKILL.md`: passed (2026-06-06)
- `npm run dev -- agent reset all weave-issues --json`: refreshed managed installed skill hashes after template propagation (2026-06-06)
- `npm run dev -- change status --json`: passed with `stage: issues` and no notices (2026-06-06)
