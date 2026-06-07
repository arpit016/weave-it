---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-07T12:55:07.000Z
updated_at: 2026-06-07T12:55:07.000Z
source: prd.md, architecture/index.md
---

# Tasks: Fixes Around Existing Commands

## Source Context

- PRD: `wiki/changes/260607-1mo4-fixes-around-existing-commands/prd.md`
- Architecture: `wiki/changes/260607-1mo4-fixes-around-existing-commands/architecture/index.md`
- Sessions:
  - `wiki/changes/260607-1mo4-fixes-around-existing-commands/sessions/20260607-174140-k4n7-exploration.md`
  - `wiki/changes/260607-1mo4-fixes-around-existing-commands/sessions/20260607-181158-p9q2-architecture.md`
  - `wiki/changes/260607-1mo4-fixes-around-existing-commands/sessions/20260607-182108-m6r4-architecture.md`
- Codebase:
  - `src/lib/show-workspace.ts`
  - `src/lib/workspace-repos.ts`
  - `src/lib/task-prepare.ts`
  - `src/lib/skill-template-checks.ts`
  - `templates/skills/`
  - `.agents/skills/`
  - `.claude/skills/`
  - `tests/init.test.ts`
  - `tests/agent-skills.test.ts`
  - `tests/task-prepare.test.ts`
- External references: None.
- Local references: `/Users/arpit/.cursor/plans/command_ux_architecture_da16eabc.plan.md`

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
| T1 | done | AFK | cli | weave-it | None | Show workspace repo availability in `weave workspace` | None |
| T2 | done | AFK | skill-guidance | weave-it | None | Replace verbatim notice surfacing with silent skill output policy | None |
| T3 | done | AFK | skill-guidance | weave-it | None | Make `weave-architect` lane entry explicit and non-blocking | T2 |

## T1: Show Workspace Repo Availability In `weave workspace`

Status: done

Type: AFK

Scope: cli

Primary repo: weave-it

Repos: None

Architecture refs: `wiki/changes/260607-1mo4-fixes-around-existing-commands/architecture/index.md`

Coordination: Coordinate with T2/T3 only on user-facing wording consistency; implementation is otherwise independent.

Blocked by: None - can start immediately

User stories covered: 1, 2, 3, 6

Origin: none

Related finding: none

### What to build

Add runtime repo availability to `weave workspace` in workspace mode. Each registered workspace repo should expose `availability: "present" | "missing"` in `repos[]`, and human-readable workspace output should include availability as a dedicated repo column.

Keep `.weave/workspace.yml` as persisted metadata only. Do not write availability into workspace metadata. Do not change repo-mode `folders[]` output.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | cli | Compute and render workspace repo availability | `src/lib/show-workspace.ts`, `src/lib/workspace-repos.ts` | `tests/init.test.ts`, `npm run test -- tests/init.test.ts` |

### Acceptance Criteria

- [x] `weave workspace --json` includes `availability: "present"` for registered workspace repos whose paths exist locally.
- [x] `weave workspace --json` includes `availability: "missing"` for registered workspace repos whose paths do not exist locally.
- [x] Human-readable `weave workspace` output includes repo availability in a dedicated column or clearly aligned field.
- [x] `weave workspace` remains read-only and does not clone, move, create, delete, or modify repo folders.
- [x] Repo-mode `folders[]` output remains unchanged.
- [x] Missing repo paths do not throw during workspace display.

### Verification

- Automated tests: `npm run test -- tests/init.test.ts`
- Manual/smoke check: create or use a workspace with one present registered repo and one missing registered repo, then run `npm run dev -- workspace` and `npm run dev -- workspace --json`.
- Evidence: `npm run test -- tests/init.test.ts` passed with present and missing repo coverage.

## T2: Replace Verbatim Notice Surfacing With Silent Skill Output Policy

Status: done

Type: AFK

Scope: skill-guidance

Primary repo: weave-it

Repos: None

Architecture refs: `wiki/changes/260607-1mo4-fixes-around-existing-commands/architecture/index.md`

Coordination: T3 depends on the new shared silent-output policy and should use the same command-output language.

Blocked by: None - can start immediately

User stories covered: 4, 5

Origin: none

Related finding: none

### What to build

Replace the old `# Surface Weave Notices` guidance with a shared silent command output policy across all bundled and installed Weave skill copies.

The new policy should say that skills run Weave CLI commands silently by default: no raw stdout, JSON payloads, command echoes, lifecycle payloads, internal state-write confirmations, or verbatim notice text. Skills should surface only blockers, failures, missing relevant repos, branch/task outcomes, lifecycle failures, package outdated notices, relevant outdated skills, relevant modified skills, and user-required actions.

Use the exact notice message matrix from `architecture/index.md` for package outdated, skill outdated, and skill modified cases.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | skill-guidance | Update shared skill policy and all generated skill copies | `src/lib/skill-template-checks.ts`, `templates/skills/`, `.agents/skills/`, `.claude/skills/` | `tests/agent-skills.test.ts`, `npm run test -- tests/agent-skills.test.ts` |

### Acceptance Criteria

- [x] `src/lib/skill-template-checks.ts` defines a shared silent command output block instead of `EXPECTED_NOTICE_BOILERPLATE`.
- [x] Every bundled skill template contains the new shared silent command output policy.
- [x] `.agents/skills` and `.claude/skills` copies are updated consistently with templates.
- [x] No bundled skill still contains `# Surface Weave Notices`.
- [x] No bundled skill still instructs agents to surface notices verbatim.
- [x] The policy includes the package outdated, skills outdated, and skills modified user-facing copy from the architecture artifact.

### Verification

- Automated tests: `npm run test -- tests/agent-skills.test.ts`
- Search check: verify no skill files contain `# Surface Weave Notices` or `surface them to the user verbatim`.
- Evidence: `npm run test -- tests/agent-skills.test.ts` passed. Search checks found no old notice guidance in `templates/skills`, `.agents/skills`, or `.claude/skills`.

## T3: Make `weave-architect` Lane Entry Explicit And Non-Blocking

Status: done

Type: AFK

Scope: skill-guidance

Primary repo: weave-it

Repos: None

Architecture refs: `wiki/changes/260607-1mo4-fixes-around-existing-commands/architecture/index.md`

Coordination: Depends on T2 so the warning and command-output behavior use the shared silent-output language.

Blocked by: T2 - use the shared silent command output policy before tightening the architecture skill wording

User stories covered: 4, 5

Origin: none

Related finding: none

### What to build

Clarify `weave-architect`'s top-level read-only contract so agents do not confuse repo-tracked artifact writes with the allowed local session-state lane commit.

Then verify the lane commit non-blockingly. The skill should attempt `weave artifact current set architecture --json`, read `weave artifact current --json`, and continue the architecture discussion even if the verified lane is still not `architecture`. In that failure case, show only this concise warning:

```text
I could not update the stored artifact lane to `architecture`, so `weave-capture` may ask you to confirm the capture target later.
```

Successful lane entry remains silent.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | skill-guidance | Clarify architecture skill lane entry and verification behavior | `templates/skills/weave-architect/SKILL.md`, `.agents/skills/weave-architect/SKILL.md`, `.claude/skills/weave-architect/SKILL.md` | `tests/agent-skills.test.ts`, `npm run test -- tests/agent-skills.test.ts` |

### Acceptance Criteria

- [x] `weave-architect` top-level wording explicitly forbids repo-tracked artifact writes while allowing local Weave session-state lane commits.
- [x] `weave-architect` keeps `weave artifact current set architecture --json` in the initial entry flow.
- [x] `weave-architect` verifies the stored artifact lane with `weave artifact current --json`.
- [x] If lane verification fails, `weave-architect` continues and warns that `weave-capture` may ask for the target later.
- [x] Successful lane entry remains silent.
- [x] `weave-explore` remains unchanged for this concern.

### Verification

- Automated tests: `npm run test -- tests/agent-skills.test.ts`
- Manual/smoke check: inspect `templates/skills/weave-architect/SKILL.md` and installed copies for the clarified read-only contract, verification command, and non-blocking warning text.
- Evidence: `npm run test -- tests/agent-skills.test.ts` passed with assertions for the allowed local lane commit, verification command, silent success, and non-blocking warning.

## Coverage Review

- PRD coverage: The active tasks cover workspace repo availability, no auto-hydration, silent command output, notice handling, skill consistency, and existing missing-repo blockers.
- Architecture coverage: The active tasks cover the display-layer availability design, persisted metadata boundary, shared skill boilerplate replacement, notice message matrix, and `weave-architect` lane reliability root cause.
- PRD/Architecture sync: No conflict found.

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
| --- | --- | --- | --- |

None.

## Invalid Tasks

None.

## Verification

- `npm run test -- tests/init.test.ts` passed.
- `npm run test -- tests/agent-skills.test.ts` passed.
- `npm run typecheck` passed.
- Lint diagnostics for edited source and test files reported no errors.
