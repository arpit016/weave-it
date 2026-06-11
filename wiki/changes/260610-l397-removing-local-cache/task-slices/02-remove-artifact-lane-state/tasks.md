---
artifact: tasks
slice: 02-remove-artifact-lane-state
status: done
owner: engineering
created_at: 2026-06-10T19:18:40.000Z
updated_at: 2026-06-11T16:52:00.000Z
source: architecture
---

# Tasks: Remove Artifact Lane State

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
| T1 | done | hitl | weave-it | | Remove artifact command registration and implementation | None |
| T2 | done | hitl | weave-it | | Remove artifact session writes from change flows | T1 |
| T3 | done | hitl | weave-it | | Regression: artifact current command is gone | T2 |

## weave-it

### T1: Remove artifact command registration and implementation

Status: done
Owner:
Repos: weave-it
Execution: hitl
Blocked by: None
Files:
- `src/cli.ts` (M)
- `src/commands/artifact.ts` (D)
- `src/lib/artifact-context.ts` (D)

### What to build

Remove the `artifactCommand` import and registration from the CLI, then delete the command and artifact-context implementation once no imports remain.

### Acceptance Criteria

- [x] `createProgram()` no longer registers an `artifact` command.
- [x] `src/commands/artifact.ts` is removed.
- [x] `src/lib/artifact-context.ts` is removed or has no remaining reachable command surface before final deletion.
- [x] TypeScript has no unresolved artifact-context imports.

### Verification

- Automated tests: `npm run typecheck`
- Automated tests: `npm run test -- tests/changes.test.ts`
- Manual/smoke check: run CLI help and confirm `artifact` is not listed.

### T2: Remove artifact session writes from change flows

Status: done
Owner:
Repos: weave-it
Execution: hitl
Blocked by: T1
Files:
- `src/lib/changes.ts` (M)
- `src/lib/session-state.ts` (M)
- `tests/changes.test.ts` (M)

### What to build

Stop `createChange` from setting `current_artifact`, stop `switchChange` from clearing or preserving artifact context, and remove artifact helper imports. Keep legacy session types only if useful for parse tolerance.

### Acceptance Criteria

- [x] Feature `createChange` no longer writes `current_artifact`.
- [x] `switchChange` no longer reads, clears, or preserves `current_artifact`.
- [x] No active routing code reads `currentArtifactForPath`.
- [x] Tests no longer assert artifact context persistence.

### Verification

- Automated tests: `npm run test -- tests/changes.test.ts`
- Automated tests: `npm run typecheck`

### T3: Regression: artifact current command is gone

Status: done
Owner:
Repos: weave-it
Execution: hitl
Blocked by: T2
Files:
- `tests/changes.test.ts` (M)
- `tests/cli*.test.ts` (M)

### What to build

Replace old artifact current tests with tests that prove the command is not registered and old session artifact state is ignored for routing. Add a command-registration assertion if no existing CLI registration test covers command presence.

### Acceptance Criteria

- [x] Tests do not import `currentArtifact`, `setCurrentArtifact`, or `clearCurrentArtifact`.
- [x] Tests verify `weave artifact` is absent from `createProgram()` or CLI help.
- [x] Tests preserve parse tolerance for old session files where useful, without treating `current_artifact` as current state.

### Verification

- Automated tests: `npm run test -- tests/changes.test.ts tests/agent-skills.test.ts`
- Automated tests: `npm run typecheck`

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

- `npm run typecheck` passed.
- `npm run test -- tests/changes.test.ts tests/cli-skills.test.ts tests/agent-skills.test.ts` passed.
- `npm run test` passed: 18 files, 200 tests.
- `npm run dev -- --help` confirmed no `artifact` command in top-level help.
- Source search confirmed no `artifactCommand`, `currentArtifact`, `setCurrentArtifact`, or `clearCurrentArtifact` references in `src`.
