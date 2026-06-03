---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-03T09:44:30.000Z
updated_at: 2026-06-03T09:55:39.000Z
source: architecture.md
---

# Tasks: Add Ability To Bug Fix - Categorized `tasks.md` Sections

## Source Context

- PRD: `wiki/changes/260602-of9s-add-ability-to-bug-fix/prd.md`
- Architecture: `wiki/changes/260602-of9s-add-ability-to-bug-fix/architecture.md`
- Sessions: `wiki/changes/260602-of9s-add-ability-to-bug-fix/sessions/20260603-135955-c2k8-exploration.md`, `wiki/changes/260602-of9s-add-ability-to-bug-fix/sessions/20260603-144740-9m4t-architecture.md`
- Codebase: `templates/skills/weave-issues/SKILL.md`, `src/lib/agent-skills.ts`, `tests/agent-skills.test.ts`, `.weave/agents.yml`

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
| T1 | done | AFK | Add classification and categorized sections to the `weave-issues` template | None |
| T2 | done | AFK | Propagate the updated `weave-issues` skill to installed copies | T1 |
| T3 | done | AFK | Update skill contract tests for the new sections | T1, T2 |
| T4 | done | AFK | Update the README `weave-issues` description | T1 |

## T1: Add classification and categorized sections to the `weave-issues` template

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 1, 8, 9

### What to build

Edit the canonical `templates/skills/weave-issues/SKILL.md` so a generated `tasks.md` records discovered work by category while keeping `T#` as the implementation backbone.

- Add a classification rule in the drafting flow: a defect becomes a `QF#`, structural cleanup with no observable behavior change becomes an `R#`, and everything else is a `T#` task (optionally tagged).
- Extend the `<tasks-template>` block with two flat sibling sections placed after the `T#` details and before `## Invalid Tasks`:
  - `## QA Findings` with a finding status legend (`new`, `accepted`, `fixed`, `verified`, `duplicate`, `not_reproducible`, `out_of_scope`, `invalid`), an index (ID, Status, Severity, Source, Related Task, Summary), and `### QF#` detail fields (Observed behavior, Expected behavior, Reproduction, Severity, Source, Artifact impact, Related tasks). Default body `None.`.
  - `## Refactors` with a refactor status legend (`proposed`, `accepted`, `deferred`, `done`, `out_of_scope`, `invalid`), an index (ID, Status, Scope, Related Tasks, Summary), and `### R#` detail fields (Motivation, Scope / affected modules, Behavior preservation, Risk / blast radius, Regression verification, Related tasks). Default body `None.`.
- Add optional `Origin:` (`qa_finding`/`refactor`) and `Related finding:` (`QF#`/`R#`) fields to the `T#` detail shape.
- Extend the reconciliation rules so append-first, preview-before-write, and stable-ID handling explicitly apply to `QF#` and `R#`, with independent ID namespaces, no reuse of invalidated IDs, and deferred `R#` entries allowed without a `T#`.
- State that there is no special refactor routing or escalation; the user decides whether to escalate or split out a refactor.

### Acceptance Criteria

- [x] The skill describes the `QF#`/`R#`/`T#` classification rule.
- [x] The `<tasks-template>` includes a `## QA Findings` section with the finalized statuses, index columns, and `QF#` fields, defaulting to `None.`.
- [x] The `<tasks-template>` includes a `## Refactors` section with refactor statuses, index columns, and `R#` fields, defaulting to `None.`.
- [x] The `T#` shape includes optional `Origin` and `Related finding` fields.
- [x] Reconciliation rules explicitly cover `QF#` and `R#` (append-first, stable IDs, no ID reuse, deferred `R#` allowed).
- [x] `T#` remains the implementation backbone and section selection is described as category-driven, not change-type-driven.

### Verification

- Automated tests: `npm run test` (full assertion pass occurs after T3; T1 alone is verified by re-reading the template).
- Manual/smoke check: re-read the template and confirm a sample `tasks.md` would render both sections with `None.` defaults.

## T2: Propagate the updated `weave-issues` skill to installed copies

Status: done

Type: AFK

Blocked by: T1

User stories covered: None (distribution)

### What to build

Propagate the edited canonical template to the installed agent copies without hand-editing them.

- Run `weave agent reset all weave-issues` (this is the CLI's actual command; the architecture's `weave skill reset` shorthand maps to it) to force-write `.agents/skills/weave-issues/SKILL.md` and `.claude/skills/weave-issues/SKILL.md` and refresh the `source_hash`/`installed_hash` entries in `.weave/agents.yml`.
- Confirm the opencode wrapper `.opencode/commands/weave-issues.md` still matches its template (no change expected).

### Acceptance Criteria

- [x] `.agents/skills/weave-issues/SKILL.md` is byte-identical to the template.
- [x] `.claude/skills/weave-issues/SKILL.md` is byte-identical to the template.
- [x] `.weave/agents.yml` `weave-issues` hashes match the new template content.
- [x] `weave agent diff all weave-issues` reports no differences for `weave-issues`.

### Verification

- Automated tests: `npm run test` (byte-alignment assertion in `tests/agent-skills.test.ts`).
- Manual/smoke check: `weave skill diff weave-issues --agent all` is clean.

## T3: Update skill contract tests for the new sections

Status: done

Type: AFK

Blocked by: T1, T2

User stories covered: None (quality gate)

### What to build

Extend `tests/agent-skills.test.ts` so the new behavior is asserted on the installed `weave-issues` skill.

- Add `toContain` assertions for stable structural anchors: `## QA Findings`, `## Refactors`, the `QF#` and `R#` status legends, and the classification sentence.
- Keep assertions on headings and status tokens rather than prose to avoid brittleness.
- Confirm the existing byte-alignment and metadata/description tests still pass.

### Acceptance Criteria

- [x] Tests assert the installed `weave-issues` skill contains `## QA Findings` and `## Refactors`.
- [x] Tests assert the `QF#` and `R#` status vocabularies are present.
- [x] Tests assert the classification rule text is present.
- [x] Existing byte-alignment and description tests still pass.

### Verification

- Automated tests: `npm run test`, `npm run typecheck`, `npm run build`.
- Manual/smoke check: none beyond the test run.

## T4: Update the README `weave-issues` description

Status: done

Type: AFK

Blocked by: T1

User stories covered: None (visibility)

### What to build

Extend the `weave-issues` one-line description in `README.md` so it mentions that `tasks.md` now records QA findings and refactors as categorized sections.

### Acceptance Criteria

- [x] The README `weave-issues` line reflects categorized `QF#`/`R#` sections alongside `T#` tasks.
- [x] README examples remain consistent with local `tasks.md` (no external publishing implied).

### Verification

- Automated tests: `npm run test` (if README assertions exist) or not applicable.
- Manual/smoke check: read the updated README line.

## Invalid Tasks

None.

## Verification

- [x] `npm run test` (63 tests passed, including the new QA Findings / Refactors anchors and the byte-alignment check)
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npx tsx src/cli.ts agent diff all weave-issues` reports no differences
