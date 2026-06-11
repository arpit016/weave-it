---
artifact: tasks
slice: 02-remove-artifact-lane-state
status: draft
owner: engineering
created_at: 2026-06-10T19:18:40.000Z
updated_at: 2026-06-10T19:18:40.000Z
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
| T1 | todo | hitl | weave-it | | Remove artifact command registration and implementation | None |
| T2 | todo | hitl | weave-it | | Remove artifact session writes from change flows | T1 |
| T3 | todo | hitl | weave-it | | Regression: artifact current command is gone | T2 |

## weave-it

### T1: Remove artifact command registration and implementation

Status: todo
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

- [ ] `createProgram()` no longer registers an `artifact` command.
- [ ] `src/commands/artifact.ts` is removed.
- [ ] `src/lib/artifact-context.ts` is removed or has no remaining reachable command surface before final deletion.
- [ ] TypeScript has no unresolved artifact-context imports.

### Verification

- Automated tests: `npm run typecheck`
- Automated tests: `npm run test -- tests/changes.test.ts`
- Manual/smoke check: run CLI help and confirm `artifact` is not listed.

### T2: Remove artifact session writes from change flows

Status: todo
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

- [ ] Feature `createChange` no longer writes `current_artifact`.
- [ ] `switchChange` no longer reads, clears, or preserves `current_artifact`.
- [ ] No active routing code reads `currentArtifactForPath`.
- [ ] Tests no longer assert artifact context persistence.

### Verification

- Automated tests: `npm run test -- tests/changes.test.ts`
- Automated tests: `npm run typecheck`

### T3: Regression: artifact current command is gone

Status: todo
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

- [ ] Tests do not import `currentArtifact`, `setCurrentArtifact`, or `clearCurrentArtifact`.
- [ ] Tests verify `weave artifact` is absent from `createProgram()` or CLI help.
- [ ] Tests preserve parse tolerance for old session files where useful, without treating `current_artifact` as current state.

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

Not run yet.
