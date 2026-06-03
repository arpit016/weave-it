---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-02T13:06:26.980Z
updated_at: 2026-06-03T08:29:55.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Add Ability To Bug Fix

## Topic

Add ability to bug fix

## Current Understanding

Weave needs first-class bug-fix workflows that do not force every bug through the full exploration -> PRD -> architecture -> issues pipeline.

There are two distinct bug paths:

- Active-change QA bugs found while a feature or change is still in development.
- Post-release or old-context bugs reported after the original change has shipped or enough time has passed that current behavior may have changed.

Active-change QA bugs should stay inside the active change. They should be recorded in `tasks.md` as QA findings and linked to implementation tasks when work is needed.

Post-release bugs should become new standalone `fix` changes. They should start from current product knowledge, current code, current tests, and relevant historical provenance rather than reopening the original feature change as the working context.

For post-release fixes, root cause analysis, investigation notes, diagnosis, affected systems, and fix strategy belong in `architecture.md` through `weave-architect`. Implementation work belongs in `tasks.md` through `weave-issues`. Product exploration or PRD work is needed only when the bug changes or clarifies expected behavior.

For `type: fix`, Weave should not create a scaffold-only `exploration.md` by default. A standalone fix change should start with `status.yml`, `sessions/`, no current artifact context, and `stage: started`. The first real artifact should be created by the skill that matches the work.

## Open Questions

- Should `stage: started` apply only to `fix`, or also to `refactor`, `docs`, `test`, `ci`, and `chore`?
- What exact sections should fix-oriented `architecture.md` use?
- Should documentation include separate examples for CS-reported, PM-reported, and QA-reported old bugs?

## Decisions

- Active QA bugs remain in the active change.
- `weave-issues` owns active-change QA finding intake in `tasks.md`.
- `tasks.md` should include a dedicated `QA Findings` section with stable `QF#` IDs.
- Implementation tasks remain normal `T#` tasks and can link back to related `QF#` findings.
- QA findings should be append-first. Agents should not casually rewrite earlier tasks, checked acceptance criteria, or QA finding details.

### Categorized `tasks.md` Sections For Discovered Work

- Within an active change, `tasks.md` section selection is driven by the category of each discovered work item, not by the change's declared `status.yml.type`. `T#` implementation tasks remain the backbone.
- For v1, `tasks.md` supports two dedicated observation sections: `QA Findings` (`QF#`) and `Refactors` (`R#`). All other in-flight work (chore, perf, docs, tech-debt) stays a normal `T#` task, optionally tagged.
- Refactors are modeled observation-style, mirroring QA findings: an `R#` entry records why/what and links to the `T#` task(s) that carry it out, and can be logged-but-deferred without a task yet.
- `tasks.md` uses a flat sibling layout: `Active Task Index` (+ `T#` details), then `QA Findings`, then `Refactors`. No umbrella heading and no combined top index table.
- No special refactor routing or escalation guidance in v1; `weave-issues` records the `R#` and the user decides whether to escalate or split it out into its own change.
- Refactor status vocabulary is distinct from task and finding statuses: `proposed`, `accepted`, `deferred`, `done`, `out_of_scope`, `invalid`.
- `T#` tasks gain optional `Origin:` (`qa_finding` | `refactor`) and `Related finding:` (`QF#`/`R#`) fields so backbone tasks link back to their source observation.
- Append-first, preview-before-write, and stable-ID reconciliation rules apply to `QF#` and `R#` the same way they apply to `T#`.

### Finalized `QA Findings` Section Shape

- `QA Findings` finding statuses: `new`, `accepted`, `fixed`, `verified`, `duplicate`, `not_reproducible`, `out_of_scope`, `invalid`.
- `QA Findings` index columns: ID, Status, Severity, Source, Related Task, Summary.
- `QF#` detail fields: Observed behavior, Expected behavior, Reproduction, Severity, Source, Artifact impact, Related tasks.

### `Refactors` Section Shape

- `Refactors` index columns: ID, Status, Scope, Related Tasks, Summary.
- `R#` detail fields: Motivation, Scope / affected modules, Behavior preservation, Risk / blast radius, Regression verification, Related tasks.
- If an active QA bug changes product behavior, scope, requirements, or acceptance criteria, the user should run `weave-clarify prd` or `weave-explore`.
- If an active QA bug changes technical approach, affected systems, rollout, risk, testing, or architecture, the user should run `weave-clarify architecture` or `weave-architect`.
- Bugs reported after time has passed should become new standalone changes with `type: fix`.
- Old feature/change artifacts are provenance only, not the active work context.
- RCA, investigation, diagnosis, affected systems, and fix strategy live in `architecture.md`.
- `weave-architect` owns post-release bug investigation/RCA in v1.
- Do not add a separate `weave-investigate` skill in v1.
- `weave-architect` should adapt when the active change has `status.yml.type: fix` or the prompt clearly describes a bug/RCA.
- If root cause is unknown, `weave-architect` can create an investigation-first architecture with symptoms, hypotheses, investigation plan, likely affected systems, and open technical questions.
- Once root cause is found, users should run `weave-clarify architecture` to update the RCA and fix strategy.
- After implementation, `weave-knowledge` should record whether current-state behavior changed or there was no durable knowledge impact.
- `weave change new --type fix` should not create `exploration.md` by default.
- Fix changes with no artifact yet should use `stage: started`.
- `started` means the change exists, but no durable artifact lane has been reached yet.

## Scenarios

### Scenario: Active QA Bug Inside An In-Flight Change

QA finds a bug while a feature is still being developed.

The user asks `weave-issues` to add the bug as a QA finding. `tasks.md` records a `QF#` entry with observed behavior, expected behavior, reproduction, severity, source, artifact impact, and related task links. If implementation work is needed, `weave-issues` creates or links a normal `T#` implementation task.

The bug does not create a new change by default.

### Scenario: Refactor Discovered During An In-Flight Change

While implementing a feature, an engineer realizes a module needs restructuring before the feature can land safely.

The user asks `weave-issues` to record it. `tasks.md` gets an `R#` entry in the `Refactors` section capturing motivation, scope, behavior-preservation requirement, risk, and regression verification. If work is done now, a normal `T#` task is created and links back to the `R#`. If it is deferred, the `R#` is logged with status `deferred` and no task yet.

The refactor stays distinct from planned `T#` feature tasks instead of being silently blended in, and the change type stays whatever it already was.

### Scenario: Active QA Bug Changes Product Behavior

QA finds a bug that shows expected behavior or acceptance criteria are wrong or incomplete.

`weave-issues` can record the QA finding, but product behavior must be updated through `weave-clarify prd` or `weave-explore`. Source-aware lifecycle state can then mark downstream artifacts or tasks stale when relevant.

### Scenario: Active QA Bug Changes Technical Design

QA finds a bug that invalidates the current technical approach.

`weave-issues` can record the QA finding, but the technical plan must be updated through `weave-clarify architecture` or `weave-architect`. Tasks should then be refreshed through `weave-issues` when needed.

### Scenario: Post-Release Bug With Unknown Root Cause

CS, PM, or QA reports a bug months after release.

The user starts a standalone fix:

```text
weave-new "Fix upload retry duplication" --type fix
```

The change folder starts with `status.yml`, `sessions/`, `stage: started`, and no `exploration.md`.

The user runs `weave-architect` with the bug context. `weave-architect` creates `architecture.md` as an investigation-first artifact with bug context, symptoms, reproduction, hypotheses, investigation plan, affected systems, risks, and open technical questions.

### Scenario: Post-Release Bug With Known Root Cause

The user already knows the RCA and fix approach.

The user runs `weave-architect` to capture the RCA and fix strategy directly. Then `weave-issues` creates implementation tasks from the architecture.

### Scenario: Post-Release Bug With Product Ambiguity

The bug reveals that expected behavior is unclear or has changed.

The user runs `weave-prd` or `weave-explore` before or alongside technical planning. Product artifacts stay conditional; they are not required for every bug.

### Scenario: Fix Completion Updates Knowledge

After implementation, the user runs `weave-knowledge`.

If the fix changed or clarified durable current behavior, knowledge is updated. If the fix was only an internal defect with no durable behavior impact, the change records a no-impact knowledge rationale.

## Existing Behavior

Current `weave change new` always creates:

```text
wiki/changes/<change-id>/
  status.yml
  exploration.md
  sessions/
```

It sets:

```yaml
stage: exploration
```

and records `exploration` as the current artifact context.

That behavior is appropriate for feature changes, but misleading for fixes because scaffold-only exploration suggests product discovery has started and causes `weave-next` to treat exploration as the initial blocker.

Current skill contracts already support some needed pieces:

- `ChangeType` includes `fix`.
- `weave-prd` and `weave-architect` do not require upstream artifacts.
- `weave-next` is type-aware, but still has a broad missing/scaffold exploration recommendation that conflicts with fix changes.
- `weave-issues` already owns local `tasks.md` creation and reconciliation.
- `weave-knowledge` already supports bug fixes and no-impact knowledge closure.

## PRD Readiness

Ready
