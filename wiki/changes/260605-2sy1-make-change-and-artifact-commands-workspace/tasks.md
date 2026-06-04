---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-04T19:09:00.000Z
updated_at: 2026-06-04T19:25:00.000Z
source: architecture
---

# Tasks: Make Change And Artifact Commands Workspace Aware

## Source Context

- PRD: `wiki/changes/260605-2sy1-make-change-and-artifact-commands-workspace/prd.md`
- Architecture: `wiki/changes/260605-2sy1-make-change-and-artifact-commands-workspace/architecture.md`
- Sessions: `wiki/changes/260605-2sy1-make-change-and-artifact-commands-workspace/sessions/20250604-190700-a7k2-architecture.md`
- Codebase: `src/lib/workspace-mode.ts`, `src/lib/changes.ts`, `src/lib/artifact-context.ts`, `src/commands/change.ts`, `src/commands/artifact.ts`, `tests/changes.test.ts`, `tests/init.test.ts`
- External references: None.
- Local references: None.

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
| T1 | done | AFK | Add cwd-dispatched change context resolver | None |
| T2 | done | AFK | Rewire change and artifact libraries to single-context resolution | T1 |
| T3 | done | AFK | Remove change and artifact multi-target CLI surface | T2 |
| T4 | done | AFK | Update tests for cwd dispatch and removed propagation | T2, T3 |
| T5 | done | AFK | Remove obsolete propagate skill and update active skill guidance | T3 |
| T6 | done | AFK | Update docs and knowledge for single-context commands | T3 |
| T7 | done | AFK | Run verification and smoke checks | T4, T5, T6 |

## T1: Add Cwd-Dispatched Change Context Resolver

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 1, 2, 3, 4

Origin: none

Related finding: none

### What to build

Add a shared resolver that turns any command `cwd` into the single Weave change root. It should use `findWorkspaceMode(cwd)`, return the resolved workspace/repo root plus optional session folder metadata, and fail clearly with `ChangeCommandError("no_weave_context", ...)` when no valid Weave mode file exists above `cwd`.

### Acceptance Criteria

- [ ] `resolveChangeContext(cwd, sessionPath?)` resolves workspace-mode nested paths to the workspace root.
- [ ] `resolveChangeContext(cwd, sessionPath?)` resolves repo-mode nested paths to the repo root.
- [ ] The resolver uses session folder metadata only for id/name display, not as the source of root truth.
- [ ] The resolver throws `ChangeCommandError` with `code: "no_weave_context"` outside any Weave context.

### Verification

- Automated tests: `npm test -- tests/changes.test.ts` or the nearest focused Vitest command covering the new resolver.
- Manual/smoke check: Not required for this slice.

## T2: Rewire Change And Artifact Libraries To Single-Context Resolution

Status: done

Type: AFK

Blocked by: T1

User stories covered: 1, 2, 3, 4

Origin: none

Related finding: none

### What to build

Update `src/lib/changes.ts` and `src/lib/artifact-context.ts` so public change and artifact operations resolve exactly one context from `cwd`. Remove public `target` and `targets` option fields, delete old multi-target resolution paths, preserve one-element `targets: [...]` JSON results, and remove propagation library code.

### Acceptance Criteria

- [ ] `createChange`, `listChanges`, `currentChange`, `statusChange`, `progressChange`, `clearChangeStaleness`, `knowledgeChange`, and `switchChange` use the cwd-dispatched resolver.
- [ ] Artifact context operations inherit the same resolved root and no longer accept target options.
- [ ] JSON results that already expose `targets` keep that field as a one-element array.
- [ ] `propagateChange` and code used only by propagation are removed.
- [ ] Library-level behavior no longer creates workspace sub-repo `wiki/` or `.weave/` scaffolds through target resolution.

### Verification

- Automated tests: `npm run typecheck` and focused `npm test -- tests/changes.test.ts` after test updates land.
- Manual/smoke check: Not required for this slice.

## T3: Remove Change And Artifact Multi-Target CLI Surface

Status: done

Type: AFK

Blocked by: T2

User stories covered: 4, 5, 6

Origin: none

Related finding: none

### What to build

Update `src/commands/change.ts` and `src/commands/artifact.ts` to remove the obsolete command surface. Remove every `--target` option, remove `[target]` positionals from `change list`, `change current`, and `artifact current`, remove `all` target support, and delete the `weave change propagate` subcommand.

### Acceptance Criteria

- [ ] `weave change new`, `status`, `progress`, `clear-stale`, and `knowledge` no longer define `--target`.
- [ ] `weave change list` and `weave change current` no longer accept a target positional.
- [ ] `weave artifact current`, `current set`, and `current clear` no longer accept target arguments or options.
- [ ] `weave change propagate` is no longer registered.
- [ ] CLI calls pass only `cwd` and command-specific arguments into library functions.

### Verification

- Automated tests: `npm run typecheck`.
- Manual/smoke check: `npm run dev -- change new "Smoke" --target app` rejects `--target`; `npm run dev -- change propagate abc` reports an unknown subcommand.

## T4: Update Tests For Cwd Dispatch And Removed Propagation

Status: done

Type: AFK

Blocked by: T2, T3

User stories covered: 1, 2, 3, 4, 5, 6

Origin: none

Related finding: none

### What to build

Revise `tests/changes.test.ts` around the new single-context model. Add workspace-mode and repo-mode nested cwd coverage, artifact-context coverage, no-context failure coverage, and replace/remove tests that asserted multi-target or propagation behavior.

### Acceptance Criteria

- [ ] Workspace-mode tests prove commands run from a nested sub-repo operate on the workspace root `wiki/changes/`.
- [ ] Repo-mode tests prove commands run from a nested subdirectory operate on the repo root `wiki/changes/`.
- [ ] Artifact context tests prove `current`, `set`, and `clear` use the same resolved root as change commands.
- [ ] No-context tests assert `ChangeCommandError` with `code: "no_weave_context"`.
- [ ] Propagation tests are removed.
- [ ] Multi-target tests are rewritten as single-context tests.

### Verification

- Automated tests: `npm test -- tests/changes.test.ts`.
- Manual/smoke check: Not required beyond T7.

## T5: Remove Obsolete Propagate Skill And Update Active Skill Guidance

Status: done

Type: AFK

Blocked by: T3

User stories covered: 4, 5, 6

Origin: none

Related finding: none

### What to build

Delete `weave-propagate` from shipped templates and installed skill locations. Update `weave-new` and `weave-next` guidance so agents no longer call `--target`, `change current all`, or propagation flows.

### Acceptance Criteria

- [ ] `templates/skills/weave-propagate/` is removed.
- [ ] `.claude/skills/weave-propagate/` is removed.
- [ ] `.agents/skills/weave-propagate/` is removed.
- [ ] `templates/opencode/commands/weave-propagate.md` is removed.
- [ ] `.opencode/commands/weave-propagate.md` is removed.
- [ ] `weave-new` and `weave-next` template and installed copies no longer mention `--target`, `change current all`, or propagation.

### Verification

- Automated tests: `npm test -- tests/agent-skills.test.ts` if skill assertions cover these files.
- Manual/smoke check: `rg -- '--target|change current all|weave-propagate|change propagate' templates .claude .agents .opencode` shows no stale active guidance except historical change artifacts if intentionally excluded.

## T6: Update Docs And Knowledge For Single-Context Commands

Status: done

Type: AFK

Blocked by: T3

User stories covered: 1, 2, 3, 4, 5, 6

Origin: none

Related finding: none

### What to build

Update user-facing and knowledge docs so command references describe cwd-dispatched single-context behavior. Remove or rewrite examples for `--target`, `all`, and `weave change propagate`.

### Acceptance Criteria

- [ ] `README.md` describes cwd-dispatched workspace/repo behavior for change and artifact commands.
- [ ] `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md` removes target and propagation references.
- [ ] Change workflow knowledge docs no longer tell agents or users to use `--target` or `change current all`.
- [ ] Removed behavior is described as removed, not deprecated or hidden.

### Verification

- Automated tests: Not available for prose-only docs unless existing doc assertions apply.
- Manual/smoke check: `rg -- '--target|change current all|change propagate|weave-propagate' README.md wiki/knowledge` finds only intentional historical references, if any.

## T7: Run Verification And Smoke Checks

Status: done

Type: AFK

Blocked by: T4, T5, T6

User stories covered: 1, 2, 3, 4, 5, 6

Origin: none

Related finding: none

### What to build

Run the final verification pass across typechecking, tests, and targeted CLI smoke commands. Record any failures and fix regressions introduced by the implementation.

### Acceptance Criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] Manual CLI smoke proves nested workspace sub-repo commands resolve to the workspace root.
- [ ] Manual CLI smoke proves nested repo-mode commands resolve to the repo root.
- [ ] Manual CLI smoke proves removed `--target` and `propagate` surfaces fail as unsupported.

### Verification

- Automated tests: `npm run typecheck` and `npm test`.
- Manual/smoke check: run the targeted CLI checks described above and note results in the implementation summary.

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

- `npm run typecheck` passed.
- `npm test` passed.
- Workspace nested cwd smoke passed: running from a workspace sub-repo wrote the change under the workspace root and did not create a sub-repo `wiki/`.
- Repo nested cwd smoke passed: running from a repo subdirectory wrote the change under the repo root and did not create a nested `wiki/`.
- Removed surface smoke passed: `--target` and `weave change propagate` are rejected as unsupported.
