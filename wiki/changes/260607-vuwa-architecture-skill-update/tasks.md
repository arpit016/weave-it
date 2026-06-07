---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-07T15:34:00.000Z
updated_at: 2026-06-07T15:34:00.000Z
source: architecture
---

# Tasks: architecture skill update

## Source Context

- PRD: absent.
- Architecture: `wiki/changes/260607-vuwa-architecture-skill-update/architecture/index.md`
- Sessions: `wiki/changes/260607-vuwa-architecture-skill-update/sessions/20260607-204600-g7kp-architecture.md`
- Codebase: `src/lib/weave-scaffold.ts`, `src/cli.ts`, `src/commands/status.ts`, `src/lib/status.ts`, `src/lib/agent-skills.ts`, `tests/init.test.ts`, `tests/cli-status.test.ts`, `tests/agent-skills.test.ts`
- External references: none.
- Local references: none.

## Coverage Review

- PRD coverage: no PRD exists for this fix change, so there are no user stories, acceptance criteria, non-goals, or edge cases to map.
- Architecture coverage: tasks cover the scaffolded `.weave/architecture-considerations.md` file, read-only `weave doctor`, safe `weave doctor --fix`, bundled `weave-architect` template guidance, intentional installed-skill drift, docs, and verification.
- PRD/Architecture sync: no PRD exists, so no conflict was found.

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
| T1 | done | AFK | CLI package | weave-it | weave-it | Scaffold team architecture considerations | None |
| T2 | done | AFK | CLI package | weave-it | weave-it | Add read-only `weave doctor` health report | T1 |
| T3 | done | AFK | CLI package | weave-it | weave-it | Add safe `weave doctor --fix` scaffold repair | T1, T2 |
| T4 | done | AFK | skill template | weave-it | weave-it | Teach bundled architect skill to use team considerations | T1 |
| T5 | done | AFK | docs/tests | weave-it | weave-it | Document doctor and intentional skill drift behavior | T2, T3, T4 |

## T1: Scaffold team architecture considerations

Status: done

Type: AFK

Scope: CLI package

Primary repo: weave-it

Repos: weave-it

Architecture refs: `wiki/changes/260607-vuwa-architecture-skill-update/architecture/index.md`

Coordination: Establishes the file path and template that `weave doctor` and `weave-architect` consume.

Blocked by: None - can start immediately

User stories covered: None - no PRD present

Origin: none

Related finding: none

### What to build

Add `.weave/architecture-considerations.md` to the standard Weave scaffold. The file should be created through the same safe write-if-missing path used by existing scaffold files, include a lightweight user-owned template, and be reported in scaffold `created` output only when newly created.

The starter template should make clear that Weave creates the file once and never overwrites it. It should provide optional sections for team-specific design principles, preferred patterns, patterns to avoid, data access and scaling, caching and consistency, async boundaries and events, observability and operations, and notes for agents.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | CLI package | Owns scaffold creation and init behavior | `src/lib/weave-scaffold.ts`, `src/lib/init-workspace.ts` | `tests/init.test.ts` |

### Acceptance Criteria

- [x] `ensureWeaveScaffold` creates `.weave/architecture-considerations.md` when missing.
- [x] The template is small, editable, and explicitly user-owned.
- [x] Re-running scaffold/init does not overwrite existing `.weave/architecture-considerations.md` content.
- [x] Repo-mode init and workspace-mode init create the file in the correct `.weave/` directory.
- [x] Existing scaffold paths that call `ensureWeaveScaffold` can add the file to older Weave contexts without overwriting local edits.

### Verification

- Automated tests: `npm test -- tests/init.test.ts` (passed)
- Manual/smoke check: run `npm run dev -- init --yes` in a temp repo and confirm `.weave/architecture-considerations.md` exists with the starter template.

## T2: Add read-only `weave doctor` health report

Status: done

Type: AFK

Scope: CLI package

Primary repo: weave-it

Repos: weave-it

Architecture refs: `wiki/changes/260607-vuwa-architecture-skill-update/architecture/index.md`

Coordination: Builds on T1's safe scaffold file list and should reuse existing status/agent-skill helpers where possible.

Blocked by: T1 - needs the final safe scaffold file list

User stories covered: None - no PRD present

Origin: none

Related finding: none

### What to build

Add a top-level `weave doctor` command that inspects the current Weave project and prints a read-only health report. The command should support text output by default and `--json` for machine-readable output.

The report should identify whether Weave metadata is present and readable, whether safe scaffold files are missing, whether knowledge scaffold directories and README files are present, whether installed skills differ from bundled templates when an agent manifest exists, whether an active change exists, and whether the current branch matches the active change branch when available.

The command should summarize status as `ok`, `warning`, or `error` and clearly state that no files were changed.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | CLI package | Owns command registration, health checks, JSON/text rendering | `src/cli.ts`, `src/commands/status.ts`, `src/lib/status.ts`, `src/lib/agent-skills.ts`, `src/lib/workspace-mode.ts`, `src/lib/git.ts` | `tests/cli-status.test.ts`, new doctor CLI tests |

### Acceptance Criteria

- [x] `weave doctor` is registered as a top-level command.
- [x] `weave doctor` does not create, edit, delete, or overwrite files.
- [x] Text output includes context, checks, summary, and "No files were changed" or equivalent.
- [x] JSON output includes summary status, structured check rows, and an empty `changed` list.
- [x] Missing safe scaffold files are reported as warning and marked fixable.
- [x] Skill drift is reported as warning when installed skills differ, but is not fixed by doctor.
- [x] Broken or unreadable Weave metadata is reported as error without throwing an uncaught exception.

### Verification

- Automated tests: `npm test -- tests/cli-doctor.test.ts` (passed)
- Manual/smoke check: run `npm run dev -- doctor` and `npm run dev -- doctor --json` in a temp repo with missing scaffold files.

## T3: Add safe `weave doctor --fix` scaffold repair

Status: done

Type: AFK

Scope: CLI package

Primary repo: weave-it

Repos: weave-it

Architecture refs: `wiki/changes/260607-vuwa-architecture-skill-update/architecture/index.md`

Coordination: Extends T2 and must preserve T1's write-if-missing guarantees.

Blocked by: T1, T2 - needs scaffold file list and doctor command shape

User stories covered: None - no PRD present

Origin: none

Related finding: none

### What to build

Extend `weave doctor` with a `--fix` flag that performs only safe, additive scaffold repair. It may create missing directories and missing standard scaffold files through write-if-missing behavior, including `.weave/architecture-considerations.md`.

It must not overwrite files, update installed skills, change branches, edit `status.yml`, mutate live change artifacts, run migrations, or perform package upgrades. Text and JSON output should report the files that were created.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | CLI package | Owns safe repair behavior and output | `src/lib/weave-scaffold.ts`, new doctor library, `src/commands/doctor.ts` | `tests/init.test.ts`, new doctor CLI tests |

### Acceptance Criteria

- [x] `weave doctor --fix` creates missing safe scaffold files and reports them.
- [x] `weave doctor --fix --json` returns created paths in `changed`.
- [x] Existing `.weave/architecture-considerations.md` content is preserved exactly.
- [x] Existing knowledge/scaffold README files are preserved exactly.
- [x] Installed skills are never updated by `doctor --fix`.
- [x] `status.yml` and live artifacts under `wiki/changes/**` are never modified by `doctor --fix`.

### Verification

- Automated tests: `npm test -- tests/cli-doctor.test.ts tests/init.test.ts` (passed)
- Manual/smoke check: remove `.weave/architecture-considerations.md` in a temp repo, run `npm run dev -- doctor --fix`, and confirm only the missing scaffold file is created.

## T4: Teach bundled architect skill to use team considerations

Status: done

Type: AFK

Scope: skill template

Primary repo: weave-it

Repos: weave-it

Architecture refs: `wiki/changes/260607-vuwa-architecture-skill-update/architecture/index.md`

Coordination: Depends on T1's final file path and intentionally leaves installed skill copies stale.

Blocked by: T1 - needs the final considerations file path and ownership language

User stories covered: None - no PRD present

Origin: none

Related finding: none

### What to build

Update only `templates/skills/weave-architect/SKILL.md` so `weave-architect` reads `.weave/architecture-considerations.md` when present and treats it as team-owned advisory architecture guidance.

The skill should never edit this file. It should apply relevant guidance silently while reasoning, surface only material constraints or conflicts, and avoid turning the file into boilerplate output. If the file conflicts with PRD context, ADRs, existing architecture, code reality, or user instructions, the skill should call out the conflict and ask which source is authoritative.

Do not update installed copies under `.agents/`, `.claude/`, or `.opencode/`; this change intentionally leaves installed copies out of sync so drift behavior remains observable.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | skill template | Owns bundled `weave-architect` instructions | `templates/skills/weave-architect/SKILL.md` | `tests/agent-skills.test.ts` |

### Acceptance Criteria

- [x] Bundled `weave-architect` mentions `.weave/architecture-considerations.md` in context loading.
- [x] Bundled `weave-architect` states that the file is user-owned and must not be edited.
- [x] Bundled `weave-architect` says to apply relevant guidance silently and surface only material constraints, conflicts, or risks.
- [x] `.agents/skills/weave-architect/SKILL.md` remains untouched.
- [x] `.claude/skills/weave-architect/SKILL.md` remains untouched.
- [x] `.opencode/commands/weave-architect.md` remains untouched.
- [x] Tests distinguish intentional installed-skill drift from template regressions.

### Verification

- Automated tests: `npm test -- tests/agent-skills.test.ts` (passed)
- Manual/smoke check: inspect `git diff` and confirm only the bundled template changed, not installed copies.

## T5: Document doctor and intentional skill drift behavior

Status: done

Type: AFK

Scope: docs/tests

Primary repo: weave-it

Repos: weave-it

Architecture refs: `wiki/changes/260607-vuwa-architecture-skill-update/architecture/index.md`

Coordination: Final user-facing pass across the features implemented by T2, T3, and T4.

Blocked by: T2, T3, T4 - docs and final tests should reflect implemented command and skill behavior

User stories covered: None - no PRD present

Origin: none

Related finding: none

### What to build

Update README and relevant tests so users can discover `weave doctor`, understand the difference between read-only doctor and `doctor --fix`, see how existing projects receive missing safe scaffold files, and understand why installed skill copies may intentionally differ from bundled templates until they run explicit agent update commands.

This task should also run the final verification set for the whole change.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | docs/tests | Owns package documentation and release confidence | `README.md`, `tests/*` | `npm run typecheck`, `npm test`, `npm run build` |

### Acceptance Criteria

- [x] README documents `weave doctor`, `weave doctor --fix`, and `--json` behavior.
- [x] README states that `doctor --fix` only creates missing safe scaffold files and never overwrites user files.
- [x] README explains that installed skill drift is surfaced but not repaired by doctor.
- [x] Tests cover command registration, text output, JSON output, safe fix behavior, non-overwrite behavior, and intentional installed-skill drift.
- [x] Final verification passes or any failure is recorded with evidence.

### Verification

- Automated tests: `npm run typecheck` (passed), `npm test` (passed), `npm run build` (passed)
- Manual/smoke check: run `npm run dev -- doctor`, `npm run dev -- doctor --json`, `npm run dev -- doctor --fix`, and `npm run dev -- doctor --fix --json` in a temp Weave repo.

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

- `npm test -- tests/init.test.ts` passed.
- `npm test -- tests/cli-doctor.test.ts` passed.
- `npm test -- tests/cli-doctor.test.ts tests/init.test.ts` passed.
- `npm test -- tests/agent-skills.test.ts` passed.
- `npm run typecheck` passed.
- `npm test -- tests/cli-doctor.test.ts tests/init.test.ts tests/agent-skills.test.ts tests/cli-tier1-notices.test.ts` passed.
- `npm test` passed.
- `npm run build` passed.
- IDE lints reported no errors for edited code and test files.
