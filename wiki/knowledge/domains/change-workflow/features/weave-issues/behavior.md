# weave-issues

## Purpose

`weave-issues` breaks a Weave change's plan into independently-grabbable local tasks recorded in `wiki/changes/<change-id>/tasks.md`. It is the owning skill for the `issues` lane in the change lifecycle.

`tasks.md` is local-only; `weave-issues` does not publish, close, comment on, label, or otherwise mutate external issue trackers. External issue URLs, issue numbers, and local paths may be used as read-only source context.

## Current Behavior

`weave-issues` runs through seven steps before lifecycle progress: gather context, explore the codebase, classify discovered work, draft vertical-slice tasks, quiz the user, write or reconcile `tasks.md`, and record lifecycle progress.

Within an active change, section selection in `tasks.md` is driven by the category of each discovered work item, not by the change's declared `status.yml.type`. `T#` implementation tasks remain the backbone. Three first-class categories exist:

- `T#` (implementation tasks) live in `## Active Task Index` and per-task detail sections. They are vertical slices that cut through all relevant integration layers end-to-end. Each `T#` may optionally carry an `Origin` (`qa_finding` or `refactor`) and a `Related finding` (`QF#` or `R#`).
- `QF#` (QA findings) live in `## QA Findings`. They record observed defects with observed vs expected behavior, reproduction, severity, source, artifact impact, and related tasks.
- `R#` (refactors) live in `## Refactors`. They record structural cleanup with no observable behavior change. A deferred `R#` may exist without any `T#` task.

All other in-flight work (chore, perf, docs, tech-debt) stays a normal `T#` task, optionally tagged via `Origin`.

`weave-issues` does not impose special refactor routing or escalation; the user decides whether to escalate a refactor or split it into its own change.

## Domain Model

`tasks.md` artifact shape:

- frontmatter: `artifact: tasks`, `status`, `owner: engineering`, `created_at`, `updated_at`, `source`
- `## Source Context`: PRD, architecture, sessions, codebase, external references, local references when used
- `## Local Tracking Status`: declares no external publishing
- `## Status Legend`: task statuses
- `## Active Task Index`: ID, Status, Type, Title, Blocked by
- `## T#: <Title>` detail blocks: Status, Type, Blocked by, User stories covered, Origin, Related finding, What to build, Acceptance Criteria, Verification
- `## QA Findings`: Finding Status Legend; index with ID, Status, Severity, Source, Related Task, Summary; per-`QF#` blocks; defaults to `None.`
- `## Refactors`: Refactor Status Legend; index with ID, Status, Scope, Related Tasks, Summary; per-`R#` blocks; defaults to `None.`
- `## Invalid Tasks`: defaults to `None.`
- `## Verification`: runtime verification log

## Configuration Dimensions

- Slice type: `HITL` (requires human interaction) or `AFK` (mergeable without human interaction). Prefer `AFK` over `HITL`.
- Repo testing maturity: if a usable test base exists, code-affecting tasks include automated test expectations and verification commands; otherwise tasks include explicit manual or smoke verification.

## Behavioral Rules

- Generated tasks start as `todo` unless a real blocker is already known.
- `weave-issues` does not assign `not_tested` during task generation; implementers apply it later when implementation appears complete but automated verification could not be completed.
- `weave-issues` previews the proposed breakdown and waits for explicit user approval before writing `tasks.md`.
- On rerun, `weave-issues` reads existing `tasks.md` and current source context, proposes a reconciliation, preserves statuses and checked acceptance criteria when intent still maps cleanly, keeps stable IDs for unchanged intent, assigns new IDs to new items, and never reuses invalidated IDs.
- Obsolete tasks are marked `invalid` (not deleted), removed from the active index, and listed in `## Invalid Tasks` with reasons.
- Append-first, preview-before-write, and stable-ID reconciliation apply to `QF#` and `R#` entries the same way they apply to `T#` tasks. `T#`, `QF#`, and `R#` use independent ID namespaces.
- `weave-issues` does not create `issues.md`.

## Task Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified
- `not_tested`: implementation appears complete, but automated verification could not be completed
- `invalid`: no longer applies after source context changed

## QA Finding Status Legend

- `new`: reported but not yet triaged
- `accepted`: triaged and accepted as a real defect
- `fixed`: implementation believed to address the defect
- `verified`: fix confirmed by re-test
- `duplicate`: already covered by another finding
- `not_reproducible`: could not be reproduced
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

## Refactor Status Legend

- `proposed`: identified but not yet accepted
- `accepted`: agreed to do as part of this change
- `deferred`: logged for later; no `T#` yet
- `done`: completed and verified behavior-preserving
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

## Integrations And Side Effects

- After writing or reconciling `tasks.md`, `weave-issues` calls `weave change progress issues --source <ids>` with the source IDs that actually informed the file. Supported source IDs are `exploration`, `prd`, `architecture`, `discussion`, `sessions`, `codebase`. Unsupported IDs (`external`, `reference`, `local_path`) must not be used; concrete external/local references belong in `## Source Context`.
- `weave-issues` participates in the [Lifecycle Staleness Verification Protocol](../../domain-wide/lifecycle-progress-and-staleness.md). Before calling `progress`, it checks structural dependents and may pass `--no-invalidate` or `--invalidate=<lanes>` based on per-lane content-sync verification, or follow up with `weave change clear-stale <lane> --reason ...` for previously-stale dependents now in sync.
- If `status.yml.stale.architecture` exists, `weave-issues` warns that architecture is stale from its recorded sources and asks for explicit confirmation before creating or reconciling tasks; without explicit confirmation it stops and recommends `weave-architect`.
- `weave-issues` carries the byte-identical `# Surface Weave Notices` block; any notices returned by its Tier 1 discovery commands are surfaced verbatim to the user.

## Edge Cases

- Architecture appears stale because `prd.md` changed: do not assume architecture is stale; rely on `status.yml` source-aware stale state.
- A defect surfaces that changes product behavior or acceptance criteria: record the `QF#`, but the user should run `weave-clarify prd` or `weave-explore` to update product artifacts.
- A defect invalidates the technical approach: record the `QF#`, but the user should run `weave-clarify architecture` or `weave-architect` to update the design.
- A refactor turns out to change observable behavior: it is not a refactor and should be reclassified.

## Invariants

- `tasks.md` is the only file `weave-issues` writes; `issues.md` is never created.
- The `issues` lane and source IDs are reused unchanged; no new lifecycle lane or source ID is introduced.
- Installed agent copies of the skill remain byte-identical to `templates/skills/weave-issues/SKILL.md`.

## Source Anchors

- Canonical skill: `templates/skills/weave-issues/SKILL.md`
- Installed copies: `.agents/skills/weave-issues/SKILL.md`, `.claude/skills/weave-issues/SKILL.md`
- Opencode wrapper: `templates/opencode/commands/weave-issues.md` (and installed `.opencode/commands/weave-issues.md`)
- Propagation/manifest: `src/lib/agent-skills.ts`, `.weave/agents.yml`
- Lifecycle CLI: `src/commands/change.ts` (`weave change progress issues`)
- Tests: `tests/agent-skills.test.ts`

## Change History

- 2026-06-01 (change `260602-943x-fix-issues-skill-with-creating-tasks`): `weave-issues` was rewritten around local `tasks.md` creation and reconciliation; external publishing was removed; the canonical `tasks.md` shape (frontmatter, source context, status legend, active task index, T# details, invalid tasks, verification) was established; test-suite-aware verification guidance was added.
- 2026-06-03 (change `260602-of9s-add-ability-to-bug-fix`): added the classification step (`QF#`/`R#`/`T#`); added `## QA Findings` and `## Refactors` as flat siblings of the task index, both defaulting to `None.`; added optional `Origin` and `Related finding` fields on `T#` tasks; extended append-first/stable-ID/independent-namespace reconciliation rules to `QF#` and `R#`; deferred `R#` entries may exist without a `T#`.
- 2026-06-03 (change `260603-piln-npm-and-skill-versioning-and-updates`): embedded the byte-identical `# Surface Weave Notices` and `# Lifecycle Staleness Verification` blocks; `last_changed_in: 0.1.0` added to the skill frontmatter. The `tasks.md` shape and core `weave-issues` behavior are unchanged.

## Open Questions

- None at this time.
