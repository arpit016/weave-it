---
artifact: tasks
slice: 01-branch-derived-active-change
status: draft
owner: engineering
created_at: 2026-06-10T19:18:40.000Z
updated_at: 2026-06-10T19:18:40.000Z
source: architecture
---

# Tasks: Branch-Derived Active Change

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
| T1 | done | hitl | weave-it | | Add branch-only active change resolver | None |
| T2 | done | hitl | weave-it | | Wire active-change consumers and non-git creation refusal | T1 |
| T3 | done | hitl | weave-it | | Regression: session pointers no longer select active changes | T2 |
| T4 | done | hitl | weave-it | | Verify branch-derived lifecycle commands | T3 |

## weave-it

### T1: Add branch-only active change resolver

Status: done
Owner:
Repos: weave-it
Execution: hitl
Blocked by: None
Files:
- `src/lib/changes.ts` (M)
- `src/lib/session-state.ts` (M)

### What to build

Replace `currentContextForTarget(session, target, now, { saveInferred })` with a resolver that derives active change exclusively from the resolved root branch. Add a machine-readable resolution state for current/status results. Keep legacy session fields parseable but do not read or write `current_change` for routing.

### Acceptance Criteria

- [x] `currentChange` returns `source: "branch"` or equivalent for valid `change/<id>` branches.
- [x] Current/status target results expose `branch_active`, `no_active_change`, `invalid_active_branch`, or `non_git_no_active_change`.
- [x] Branch inference no longer writes `current_change` to the local session file.
- [x] Saved `current_change` mismatch handling is removed because session is no longer authoritative.

### Verification

- Automated tests: `npm run typecheck`
- Automated tests: `npm run test -- tests/changes.test.ts`
- Manual/smoke check: run `weave change current --json` on the active change branch and confirm the result identifies the branch-derived change.

Evidence:
- `npm run typecheck` passed.
- `npm run test -- tests/changes.test.ts tests/cli-change-progress.test.ts tests/cli-change-staleness.test.ts` passed.
- `npm run dev -- change current --json` returned `source: "branch"` and `resolution: "branch_active"`.

### T2: Wire active-change consumers and non-git creation refusal

Status: done
Owner:
Repos: weave-it
Execution: hitl
Blocked by: T1
Files:
- `src/lib/changes.ts` (M)
- `src/lib/doctor.ts` (M)
- `src/commands/slice.ts` (M)
- `src/lib/task-prepare.ts` (M)

### What to build

Update `listChanges`, `statusChange`, `activeChangeContext`, `progressChange`, `clearChangeStaleness`, `knowledgeChange`, `switchChange`, and doctor active-change reporting to use the branch-derived resolver. Make `createChange` fail before writing files when the resolved root is not a git repo.

### Acceptance Criteria

- [x] `weave change new` refuses non-git roots before creating `wiki/changes/<id>`.
- [x] `weave change switch <change>` no longer writes `current_change`; it activates by branch checkout/create.
- [x] `weave change progress`, `weave change knowledge`, `weave task prepare`, and `weave slice rollup` refuse to run when no branch-derived active change exists.
- [x] `weave doctor` does not report stale session pointers as active change.

### Verification

- Automated tests: `npm run test -- tests/changes.test.ts tests/cli-change-progress.test.ts tests/cli-change-staleness.test.ts`
- Automated tests: `npm run typecheck`
- Manual/smoke check: create a temp non-git Weave repo fixture and confirm `weave change new` fails without creating a change folder.

Evidence:
- `npm run typecheck` passed.
- `npm run test -- tests/changes.test.ts tests/cli-change-progress.test.ts tests/cli-change-staleness.test.ts` passed, including non-git refusal and branch-derived consumer regressions.
- `npm run dev -- change status --json` returned `source: "branch"` and `resolution: "branch_active"`.

### T3: Regression: session pointers no longer select active changes

Status: done
Owner:
Repos: weave-it
Execution: hitl
Blocked by: T2
Files:
- `tests/changes.test.ts` (M)
- `tests/cli-change-progress.test.ts` (M)
- `tests/cli-change-staleness.test.ts` (M)

### What to build

Replace tests that assert session-backed current state with branch-derived coverage. Add explicit regressions for stale `current_change` being ignored, branch winning over stale session state, invalid active branch handling, and non-git creation refusal.

### Acceptance Criteria

- [x] Tests no longer expect `source: "session"` or `source: "inferred_saved"` as active routing success.
- [x] Tests prove stale `current_change` is ignored on non-change branches.
- [x] Tests prove branch-derived change wins when local session points elsewhere.
- [x] Tests prove `change/<missing-id>` returns invalid active branch state.
- [x] Progress and staleness fixtures initialize git before creating changes.

### Verification

- Automated tests: `npm run test -- tests/changes.test.ts`
- Automated tests: `npm run test -- tests/cli-change-progress.test.ts tests/cli-change-staleness.test.ts`

Evidence:
- `npm run test -- tests/changes.test.ts tests/cli-change-progress.test.ts tests/cli-change-staleness.test.ts` passed.

### T4: Verify branch-derived lifecycle commands

Status: done
Owner:
Repos: weave-it
Execution: hitl
Blocked by: T3
Files:
- `src/lib/changes.ts` (M)
- `tests/changes.test.ts` (M)

### What to build

Run the slice-level verification and fix any regressions in branch-derived current/status/progress behavior. Confirm staleness behavior remains unchanged after active-change resolution changes.

### Acceptance Criteria

- [x] TypeScript passes.
- [x] Targeted change/progress/staleness tests pass.
- [x] No tests require active change recovery from local session state.
- [x] Staleness metadata remains written only through `status.yml` lifecycle commands.

### Verification

- Automated tests: `npm run typecheck`
- Automated tests: `npm run test -- tests/changes.test.ts tests/cli-change-progress.test.ts tests/cli-change-staleness.test.ts`

Evidence:
- `npm run typecheck` passed.
- `npm run test -- tests/changes.test.ts tests/cli-change-progress.test.ts tests/cli-change-staleness.test.ts` passed.
- `npm run dev -- change current --json` and `npm run dev -- change status --json` both reported branch-derived active state.

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

Passed:
- `npm run typecheck`
- `npm run test -- tests/changes.test.ts tests/cli-change-progress.test.ts tests/cli-change-staleness.test.ts`
- `npm run dev -- change current --json`
- `npm run dev -- change status --json`
