# weave-issues

> **Superseded (0.1.6+):** Bundled templates no longer ship `weave-issues`. Use [weave-slices](../weave-slices/behavior.md) for new changes (`task-slices/` model) or flat legacy `tasks.md` via dual-mode skills. The `issues` lifecycle lane is renamed to `slices` (CLI alias kept). This document describes the **legacy flat-mode** behavior for in-flight changes and historical reference.

## Purpose

`weave-issues` broke a Weave change's plan into independently-grabbable local tasks recorded in `wiki/changes/<change-id>/tasks.md`. It was the owning skill for the `issues` lane in the change lifecycle.

`tasks.md` is local-only; `weave-issues` does not publish, close, comment on, label, or otherwise mutate external issue trackers. External issue URLs, issue numbers, and local paths may be used as read-only source context.

## Current Behavior

`weave-issues` runs through seven steps before lifecycle progress: gather context, explore the codebase, classify discovered work, draft vertical-slice tasks, quiz the user, write or reconcile `tasks.md`, and record lifecycle progress.

PRD and architecture are preferred durable sources but are not prerequisites. When they exist, `weave-issues` acts as a downstream coverage and consistency gate before writing tasks: it checks generated tasks against PRD use cases and architecture decisions, verifies PRD/architecture coherence, and records the result in `## Coverage Review`.

Within an active change, section selection in `tasks.md` is driven by the category of each discovered work item, not by the change's declared `status.yml.type`. `T#` implementation tasks remain the backbone. Three first-class categories exist:

- `T#` (implementation tasks) live in `## Active Task Index` and per-task detail sections. They are vertical slices that cut through all relevant integration layers end-to-end. Each `T#` may optionally carry an `Origin` (`qa_finding` or `refactor`) and a `Related finding` (`QF#` or `R#`). `T#` tasks also carry scope and repo-location metadata when generated from the current template: `Scope`, `Primary repo`, `Repos`, `Architecture refs`, and `Coordination`.
- `QF#` (QA findings) live in `## QA Findings`. They record observed defects with observed vs expected behavior, reproduction, severity, source, artifact impact, and related tasks.
- `R#` (refactors) live in `## Refactors`. They record structural cleanup with no observable behavior change. A deferred `R#` may exist without any `T#` task.

All other in-flight work (chore, perf, docs, tech-debt) stays a normal `T#` task, optionally tagged via `Origin`.

`weave-issues` does not impose special refactor routing or escalation; the user decides whether to escalate a refactor or split it into its own change.

## Domain Model

`tasks.md` artifact shape:

- frontmatter: `artifact: tasks`, `status`, `owner: engineering`, `created_at`, `updated_at`, `source`
- `## Source Context`: PRD, architecture, sessions, codebase, external references, local references when used
- `## Coverage Review`: PRD coverage, architecture coverage, and PRD/Architecture sync when relevant sources exist
- `## Local Tracking Status`: declares no external publishing
- `## Status Legend`: task statuses
- `## Active Task Index`: ID, Status, Type, Scope, Primary repo, Repos, Title, Blocked by
- `## T#: <Title>` detail blocks: Status, Type, Scope, Primary repo, Repos, Architecture refs, Coordination, Blocked by, User stories covered, Origin, Related finding, What to build, optional Repo Involvement, Acceptance Criteria, Verification
- `## QA Findings`: Finding Status Legend; index with ID, Status, Severity, Source, Related Task, Summary; per-`QF#` blocks; defaults to `None.`
- `## Refactors`: Refactor Status Legend; index with ID, Status, Scope, Related Tasks, Summary; per-`R#` blocks; defaults to `None.`
- `## Invalid Tasks`: defaults to `None.`
- `## Verification`: runtime verification log

## Configuration Dimensions

- Slice type: `HITL` (requires human interaction) or `AFK` (mergeable without human interaction). Prefer `AFK` over `HITL`.
- Scope: a free-form planning and ownership label such as `backend`, `frontend`, `full-stack`, or user-provided language. Scope is not a repo name, architecture facet name, technical layer, lifecycle lane, or artifact target.
- Repo testing maturity: if a usable test base exists, code-affecting tasks include automated test expectations and verification commands; otherwise tasks include explicit manual or smoke verification.

## Behavioral Rules

- Generated tasks start as `todo` unless a real blocker is already known.
- `weave-issues` does not assign `not_tested` during task generation; implementers apply it later when implementation appears complete but automated verification could not be completed.
- `weave-issues` previews the proposed breakdown and waits for explicit user approval before writing `tasks.md`.
- If invoked as `weave-issues <scope>`, the argument is treated as a free-form planning and ownership label for the run. Scoped runs still read all relevant source context and may propose `Scope: full-stack` tasks when the smallest independently-verifiable behavior crosses backend and frontend boundaries.
- Scoped tasks must remain tracer bullets. A scope narrows planning ownership; it does not permit horizontal layer tasks such as separate database-table, endpoint, component, or route tasks unless each resulting task is independently meaningful and verifiable.
- In workspace mode, registered `repos[]` are implementation-location evidence for `Primary repo`, `Repos`, likely code anchors, and likely verification anchors. They are not separate task artifact targets.
- Multi-repo tasks and tasks with ambiguous implementation locations include `### Repo Involvement` as guidance with repo role, likely code anchors, and test/verification anchors. `Repo Involvement` is not subtask tracking and must not include per-repo statuses.
- If `prd.md` exists, generated tasks should cover concrete PRD use cases, acceptance criteria, non-goals, and relevant edge cases.
- If an architecture artifact exists, generated tasks should cover architecture decisions, facet-specific responsibilities, rollout, data migration, API contracts, observability, tests, and risks that require implementation work.
- If PRD and architecture conflict, `weave-issues` stops before writing tasks and asks whether to clarify PRD or architecture first.
- In folder-mode architecture, `weave-issues` reads `architecture/index.md` and substantive direct child facet files; it does not rely only on the index.
- On rerun, `weave-issues` reads existing `tasks.md` and current source context, proposes a reconciliation, preserves statuses and checked acceptance criteria when intent still maps cleanly, keeps stable IDs for unchanged intent, assigns new IDs to new items, and never reuses invalidated IDs.
- On a scoped rerun, `weave-issues` preserves unrelated scope tasks unless the current scope reveals a direct conflict, reconciles tasks in the requested scope, and stops before writing if the scoped plan conflicts with another scope's existing task or architecture assumption.
- Obsolete tasks are marked `invalid` (not deleted), removed from the active index, and listed in `## Invalid Tasks` with reasons.
- Append-first, preview-before-write, and stable-ID reconciliation apply to `QF#` and `R#` entries the same way they apply to `T#` tasks. `T#`, `QF#`, and `R#` use independent ID namespaces.
- `weave-issues` does not create `issues.md`.
- `weave-issues` does not create `tasks/<repo>/tasks.md`, per-repo task artifacts, rigid scope legends, or per-repo task statuses inside `Repo Involvement`.

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
- `weave-issues` follows the shared `# Silent Weave Command Output` contract: discovery command output is internal by default, and only blockers, failures, relevant notices, lifecycle failures, or user-required actions are summarized.

## Edge Cases

- Architecture appears stale because `prd.md` changed: do not assume architecture is stale; rely on `status.yml` source-aware stale state.
- PRD exists but architecture does not: generate tasks from the concrete source material available and mark architecture coverage as absent in `## Coverage Review`; do not require architecture solely as a prerequisite.
- Architecture exists but PRD does not: generate tasks from architecture or other concrete sources when sufficient and mark PRD coverage as absent in `## Coverage Review`.
- Architecture is folder-mode with substantive facets but a missing or thin index: use the facet context and call out partial architecture coverage in `## Coverage Review`.
- A scope resembles a repo name or architecture facet: do not assume it is a repo selector or facet selector; use all relevant source context and map repos separately through `Primary repo`, `Repos`, and `Repo Involvement`.
- A scoped run reveals a full-stack behavior: propose a `Scope: full-stack` task instead of forcing an artificial backend-only or frontend-only split.
- Repo mapping is uncertain: preview candidate repo mappings and ask for confirmation before writing vague implementation-location metadata.
- A defect surfaces that changes product behavior or acceptance criteria: record the `QF#`, but the user should run `weave-clarify prd` or `weave-explore` to update product artifacts.
- A defect invalidates the technical approach: record the `QF#`, but the user should run `weave-clarify architecture` or `weave-architect` to update the design.
- A refactor turns out to change observable behavior: it is not a refactor and should be reclassified.

## Invariants

- `tasks.md` is the only file `weave-issues` writes; `issues.md` is never created.
- The `issues` lane and source IDs are reused unchanged; no new lifecycle lane or source ID is introduced.
- Workspace sub-repos remain implementation and evidence locations, not separate `issues` artifact targets.
- Installed agent copies of the skill remain byte-identical to `templates/skills/weave-issues/SKILL.md`.

## Source Anchors

- Canonical skill: `templates/skills/weave-issues/SKILL.md`
- Architecture artifact shape: `wiki/knowledge/domains/change-workflow/domain-wide/architecture-artifacts.md`
- Installed copies: `.agents/skills/weave-issues/SKILL.md`, `.claude/skills/weave-issues/SKILL.md`
- Opencode wrapper: `templates/opencode/commands/weave-issues.md` (and installed `.opencode/commands/weave-issues.md`)
- Propagation/manifest: `src/lib/agent-skills.ts`, `.weave/agents.yml`
- Lifecycle CLI: `src/commands/change.ts` (`weave change progress issues`)
- Tests: `tests/agent-skills.test.ts`

## Change History

- 2026-06-01 (change `260602-943x-fix-issues-skill-with-creating-tasks`): `weave-issues` was rewritten around local `tasks.md` creation and reconciliation; external publishing was removed; the canonical `tasks.md` shape (frontmatter, source context, status legend, active task index, T# details, invalid tasks, verification) was established; test-suite-aware verification guidance was added.
- 2026-06-03 (change `260602-of9s-add-ability-to-bug-fix`): added the classification step (`QF#`/`R#`/`T#`); added `## QA Findings` and `## Refactors` as flat siblings of the task index, both defaulting to `None.`; added optional `Origin` and `Related finding` fields on `T#` tasks; extended append-first/stable-ID/independent-namespace reconciliation rules to `QF#` and `R#`; deferred `R#` entries may exist without a `T#`.
- 2026-06-03 (change `260603-piln-npm-and-skill-versioning-and-updates`): embedded the original notice-surfacing and `# Lifecycle Staleness Verification` blocks; `last_changed_in: 0.1.0` added to the skill frontmatter. The `tasks.md` shape and core `weave-issues` behavior are unchanged.
- 2026-06-06 (change `260606-k0l6-architecture-folder`): `weave-issues` became tolerant of optional PRD/architecture sources while acting as a downstream coverage and consistency gate; it now reads folder-mode architecture (`architecture/index.md` plus facets) and records PRD/architecture coverage in `tasks.md`.
- 2026-06-07 (change `260607-ycuo-workspace-aware-issues`): `weave-issues` became scope-aware at the skill level. It now treats `weave-issues <scope>` as a free-form planning/ownership label, preserves tracer-bullet semantics under scoped generation, permits `Scope: full-stack` when behavior crosses backend/frontend boundaries, adds task metadata for scope and repo-location guidance, and forbids per-repo task artifacts.
- 2026-06-07 (change `260607-1mo4-fixes-around-existing-commands`): replaced verbatim notice surfacing with the shared `# Silent Weave Command Output` contract.
- 2026-06-09 (change `260609-rrsq-weave-slice`): superseded by `weave-slices`; bundled skill removed; `slices` lane replaces `issues`. Flat-mode `tasks.md` execution continues via dual-mode `weave-execute`.

## Open Questions

- None at this time.
