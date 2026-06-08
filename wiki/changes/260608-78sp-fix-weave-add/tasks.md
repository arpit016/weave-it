---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-08T14:11:18.000Z
updated_at: 2026-06-08T14:14:07.000Z
source: architecture
---

# Tasks: Fix Weave Add

## Source Context

- PRD: absent
- Architecture: `wiki/changes/260608-78sp-fix-weave-add/architecture/index.md`
- Sessions: `wiki/changes/260608-78sp-fix-weave-add/sessions/20260608-193500-k9p4-architecture.md`
- Codebase: `src/lib/add-folder.ts`, `src/lib/workspace-repos.ts`, `src/lib/show-workspace.ts`, `tests/init.test.ts`, `package.json`
- External references: none
- Local references: none

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
| T1 | done | AFK | CLI | weave-it | weave-it | Materialize missing registered workspace repos via `weave add` | None |

## T1: Materialize missing registered workspace repos via `weave add`

Status: done

Type: AFK

Scope: CLI

Primary repo: weave-it

Repos: weave-it

Architecture refs: `wiki/changes/260608-78sp-fix-weave-add/architecture/index.md`

Coordination: none

Blocked by: None - can start immediately

User stories covered: None; architecture-only fix

Origin: qa_finding

Related finding: QF1

### What to build

Update workspace-mode `weave add` so committed workspace metadata and local repo availability are treated separately. A repo path that is registered in `.weave/workspace.yml` should return `already_exists` only when the repo directory is also present locally. If the registered repo directory is missing, `weave add <git-url>` should clone into the registered path, and `weave add <local-path>` should move the local folder into the registered path without rewriting `.weave/workspace.yml` or `.gitignore`.

Keep existing behavior for new unregistered repos: clone or move into the workspace, append the gitignore entry, and register workspace metadata. Keep existing safety behavior that refuses to overwrite an already-present destination.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | CLI | Owns `weave add` command behavior, workspace repo metadata helpers, and tests | `src/lib/add-folder.ts`, `src/lib/workspace-repos.ts`, `src/lib/show-workspace.ts` | `tests/init.test.ts`, `npm test -- tests/init.test.ts`, `npm test` |

### Acceptance Criteria

- [x] `weave add <git-url>` clones into a registered-but-missing workspace repo path without rewriting `.weave/workspace.yml` or `.gitignore`.
- [x] `weave add <local-path>` moves a local folder/repo into a registered-but-missing workspace repo path without rewriting `.weave/workspace.yml` or `.gitignore`.
- [x] Registered-and-present workspace repo paths still return `already_exists`.
- [x] Unregistered workspace repo paths still follow existing clone/register or move/register behavior.
- [x] Existing destination collision protections still prevent overwriting local workspace folders.
- [x] Regression tests cover both Git URL and local path materialization paths.

### Verification

- Automated tests: `npm test -- tests/init.test.ts` passed (24 tests).
- Automated tests: `npm test` passed (17 files, 201 tests).
- Typecheck: `npm run typecheck` passed.
- Manual/smoke check: optional CLI smoke with a workspace whose `.weave/workspace.yml` lists an ignored repo path that is missing locally, then run `weave add <git-url>` and `weave add <local-path>` variants.

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
| QF1 | accepted | medium | user report plus code inspection | T1 | Workspace `weave add` reports a repo as already registered when committed metadata exists but the repo folder is missing locally. |

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

## Coverage Review

- PRD coverage: PRD is absent. Task coverage is based on the architecture artifact and captured discussion.
- Architecture coverage: T1 covers the registered-present, registered-missing, and unregistered workspace repo states described in `architecture/index.md`, including both Git URL and local path inputs.
- PRD/Architecture sync: No PRD exists, so no conflict was found. The architecture and session capture are aligned.

## Verification

- `npm test -- tests/init.test.ts` passed (24 tests).
- `npm test` passed (17 files, 201 tests).
- `npm run typecheck` passed.
