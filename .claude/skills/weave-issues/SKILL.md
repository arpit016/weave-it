---
name: weave-issues
description: Break an architecture, implementation plan, spec, PRD, or referenced context into local implementation tasks in tasks.md using tracer-bullet vertical slices.
last_changed_in: 0.1.0
---

# To Local Tasks

Break a plan into independently-grabbable local tasks using vertical slices (tracer bullets).

`weave-issues` creates or reconciles:

```text
wiki/changes/<change-id>/tasks.md
```

It does not publish, close, comment on, label, or otherwise mutate external issue trackers. External issue URLs, issue numbers, and local paths may be used as read-only source context only.

## Process

### 1. Gather Context

Work from whatever is already in the conversation context. If the user passes an issue reference, URL, issue number, or local path as an argument, read it as source context when available. Do not mutate the referenced tracker item or file.

If the user invokes `weave-issues <scope>`, treat `<scope>` as a free-form planning and ownership label for this run.

Common examples are `backend`, `frontend`, and `full-stack`, but do not enforce a fixed taxonomy. Preserve the user's language unless it is ambiguous.

Scope is not a repo name, architecture facet name, technical layer, lifecycle lane, or artifact target. `weave-issues backend` means generate or reconcile backend-owned tracer-bullet implementation slices using all relevant source context. `weave-issues frontend` means generate or reconcile frontend-owned tracer-bullet implementation slices using all relevant source context.

A scoped run may still propose `Scope: full-stack` tasks when the smallest independently verifiable behavior crosses backend and frontend boundaries. Do not force a naturally full-stack behavior into fake backend-only or frontend-only tasks.

For a Weave change, prefer durable change artifacts before drafting tasks:

- Read `wiki/changes/<change-id>/prd.md` as the product contract when present.
- Read the architecture artifact as the engineering design when present: legacy `wiki/changes/<change-id>/architecture.md` or folder-mode `wiki/changes/<change-id>/architecture/index.md` plus direct child `architecture/*.md` facets.
- Read `wiki/changes/<change-id>/status.yml` when present to check stale lifecycle state.
- Read existing `wiki/changes/<change-id>/tasks.md` when present so reruns can reconcile instead of replacing blindly.
- If both PRD and architecture exist, use `prd.md` for user behavior and acceptance, and the architecture artifact for technical sequencing, affected systems, risks, rollout, observability, and testing strategy.
- If `status.yml.stale.architecture` exists, warn that architecture is stale from its recorded sources and ask for explicit confirmation before creating or reconciling tasks. If the user does not explicitly confirm, stop and recommend `weave-architect`.
- Do not assume architecture is stale merely because `prd.md` changed; rely on source-aware stale state in `status.yml`.

When a scope is provided, still read all source context relevant to that scoped ownership boundary. Do not read only a same-named architecture facet and do not assume the scope is a repo selector. For example, `weave-issues backend` may need `architecture/backend.md`, `architecture/frontend.md`, `architecture/api-contract.md`, `architecture/index.md`, repo docs, and existing frontend or full-stack tasks to detect coordination needs or conflicts.

Task generation may use any sufficiently concrete plan or context, including PRD, architecture, implementation plan, spec, sessions, discussion, codebase findings, local paths, or external issue references.

PRD and architecture are optional sources, not prerequisites. When either exists, `weave-issues` acts as a downstream consistency gate:

- Verify generated tasks cover all concrete PRD use cases, acceptance criteria, non-goals, and edge cases that are relevant to implementation.
- Verify generated tasks cover architecture decisions, facet-specific responsibilities, rollout, data migration, API contracts, observability, testing, and risks that require implementation work.
- Verify PRD and architecture are mutually coherent. If they conflict, stop before writing tasks and ask the user whether to clarify PRD or architecture first.
- If architecture folder mode exists, review `architecture/index.md` and each substantive facet file; do not only read the index.
- Include a `## Coverage Review` section in `tasks.md` summarizing PRD coverage, architecture coverage, and PRD/Architecture sync. If a source is absent, state that it was absent instead of treating that as a blocker.

### 2. Explore The Codebase

Explore the codebase enough to understand current implementation conventions before drafting tasks. Issue titles and task descriptions should use the project's domain glossary vocabulary and respect ADRs in the area being touched.

In workspace mode, use registered `repos[]` as implementation-location evidence, not as separate task artifact targets. For repos that appear relevant to the requested scope or source context, identify:

- repo id or name
- repo kind when known
- likely code anchors
- likely test or verification anchors
- which task scope(s) the repo appears relevant to

Do not create per-repo task files. The only task artifact remains `wiki/changes/<change-id>/tasks.md`.

Also inspect testing conventions:

- package scripts or documented test commands
- test directories and file naming
- existing test helpers or fixtures
- manual, smoke, or build verification conventions

If a usable automated test base exists, code-affecting tasks should include relevant automated test expectations and verification commands. If no usable automated test base exists, missing tests should not block task generation by itself; include explicit manual or smoke verification expectations instead.

Do not require strict test-first TDD wording. Preserve vertical-slice completeness by making each task verifiable in the way that fits the repo.

### 3. Classify Discovered Work

Within an active change, `tasks.md` section selection is driven by the category of each discovered work item, not by the change's declared `status.yml.type`. `T#` implementation tasks remain the backbone. Classify each work item before drafting it:

- A defect observed during the change becomes a `QF#` entry in the `## QA Findings` section.
- Structural cleanup with no observable behavior change becomes an `R#` entry in the `## Refactors` section.
- Everything else (planned work, chore, perf, docs, tech-debt, etc.) becomes a `T#` task, optionally tagged via `Origin`.

`QF#` and `R#` are observation-style records: they capture why and what, and link to the `T#` task(s) that carry the work out. An `R#` may be logged-but-deferred without a `T#` yet. `weave-issues` does not impose special refactor routing or escalation; the user decides whether to escalate a refactor or split it into its own change.

### 4. Draft Vertical-Slice Tasks

Break the plan into **tracer bullet** tasks. Each task is a thin vertical slice that cuts through all relevant integration layers end-to-end, not a horizontal slice of one layer.

Scoped tasks must remain tracer bullets. A scope narrows planning ownership; it does not permit horizontal layer tasks.

Bad backend slices:

- Add database table
- Add service method
- Add endpoint

Good backend slice:

- Allow API consumers to create pending workspace invitations

Bad frontend slices:

- Add component
- Add route
- Wire API client

Good frontend slice:

- Let admins submit workspace invitations from settings

Good full-stack slice:

- Let admins create a pending workspace invitation from workspace settings

DB work usually belongs inside the relevant backend-owned behavior slice. Mobile work may use the team's normal frontend/client scope language. Contract and API boundary work should usually be captured as `Coordination` on the relevant task unless the user naturally provides a separate scope label.

Slices may be `HITL` or `AFK`. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but complete path through the relevant layers.
- Each slice is demoable or verifiable on its own.
- Prefer many thin slices over a few thick ones.
- Include automated test expectations when a usable test base exists.
- Include manual or smoke verification when automated tests are unavailable.
</vertical-slice-rules>

Generated tasks start as `todo` unless a real blocker is already known. Do not assign `not_tested` during task generation; implementers apply `not_tested` later if implementation appears complete but automated verification could not be completed.

### 5. Quiz The User

Present the proposed breakdown as a numbered list before writing `tasks.md`. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Scope**: backend, frontend, full-stack, or the user-provided label
- **Primary repo**: main implementation location, or `workspace` / `None` when not repo-specific
- **Repos**: all repos expected to be touched, or `None`
- **Architecture refs**: architecture files or facets that explain the task, when known
- **Blocked by**: which other slices, if any, must complete first
- **User stories covered**: which user stories this addresses, if the source material has them
- **Repo-local or full-stack**: whether the slice is contained in one repo/scope or crosses repos/scopes

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?
- Are the scopes and repo mappings correct?
- Should any backend/frontend scoped task become full-stack, or vice versa?
- Are any repo/code anchors missing or misleading?

Iterate until the user approves the breakdown.

### 6. Write Or Reconcile Local `tasks.md`

After the user approves, create or reconcile:

```text
wiki/changes/<change-id>/tasks.md
```

Do not create `issues.md`.

If `tasks.md` does not exist, create it using the canonical shape below.

If `tasks.md` already exists:

- read the current task file and current source context
- propose a reconciliation summary before writing
- preserve statuses and checked acceptance criteria when task intent still maps cleanly
- keep stable IDs for unchanged task intent
- assign new IDs to new tasks
- do not reuse invalidated task IDs
- mark obsolete tasks as `invalid` instead of deleting them
- remove invalid tasks from the active task index
- list invalid tasks in a separate `## Invalid Tasks` section with reasons
- write only after explicit user approval

If `tasks.md` already exists and the user invoked a scope:

- read the existing `tasks.md` before drafting
- preserve unrelated scope tasks unless the current scope reveals a direct conflict
- reconcile tasks in the requested scope
- preserve stable IDs when task intent still maps cleanly
- preserve statuses and checked acceptance criteria when intent still maps cleanly
- add new scoped tasks with new IDs
- mark obsolete tasks in the requested scope as `invalid` rather than deleting them
- do not reuse invalidated task IDs
- if a scoped run discovers a genuinely cross-backend/frontend behavior, propose a `Scope: full-stack` task instead of forcing it into backend-only or frontend-only tasks
- if the scoped plan conflicts with another scope's existing task or architecture assumption, stop before writing and ask whether to clarify PRD or architecture first

Do not create `tasks/<repo>/tasks.md`, per-repo task artifacts, per-repo task statuses inside `Repo Involvement`, or rigid scope legends. Do not split a tracer bullet into backend/frontend tasks merely because multiple repos are involved. Split only when each resulting task is independently meaningful and verifiable.

Append-first, preview-before-write, and stable-ID reconciliation apply to `QF#` and `R#` entries the same way they apply to `T#` tasks. `T#`, `QF#`, and `R#` use independent ID namespaces; do not reuse invalidated IDs across any of them. A deferred `R#` may exist without a `T#` task.

<tasks-template>
---
artifact: tasks
status: draft
owner: engineering
created_at: <YYYY-MM-DDTHH:mm:ss.sssZ>
updated_at: <YYYY-MM-DDTHH:mm:ss.sssZ>
source: <primary-source>
---

# Tasks: <Change Title>

## Source Context

- PRD: `<path>` when used
- Architecture: `<path>` when used
- Sessions: `<path>` when used
- Codebase: `<summary or path>` when used
- External references: `<url or issue number>` when used as read-only context
- Local references: `<path>` when used as source context

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
| T1 | todo | AFK | <scope> | <repo or workspace> | <repos or None> | <title> | None |

## T1: <Title>

Status: todo

Type: AFK

Scope: <backend | frontend | full-stack | user-provided label>

Primary repo: <repo id or workspace>

Repos: <repo ids, or None>

Architecture refs: <relevant architecture files/facets, or None>

Coordination: <none or concrete cross-scope note>

Blocked by: None - can start immediately

User stories covered: <ids or None>

Origin: <none | qa_finding | refactor>

Related finding: <none | QF# | R#>

### What to build

Describe the end-to-end behavior for this vertical slice. Avoid layer-by-layer implementation unless the source material requires it.

### Repo Involvement

Include this section for multi-repo tasks or when implementation location would otherwise be ambiguous. Omit it for obvious single-repo tasks.

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| <repo> | <scope> | <what this repo contributes to the behavior> | <paths or "inspect repo docs/code"> | <tests/checks or "inspect repo test conventions"> |

`Repo Involvement` is implementation guidance only; it is not subtask tracking and must not include per-repo statuses.

### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Verification

- Automated tests: <command and expectation, or "not available; no usable test base found">
- Manual/smoke check: <expected check when relevant>

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

Not run yet.
</tasks-template>

### 7. Record Lifecycle Progress

After local tasks are successfully created or reconciled, run lifecycle progress for the `issues` lane with the existing source IDs that actually informed `tasks.md`.

Supported source IDs are:

```text
exploration
prd
architecture
discussion
sessions
codebase
```

Examples:

```bash
weave change progress issues --source architecture --json
weave change progress issues --source prd --source codebase --json
weave change progress issues --source discussion --source sessions --json
```

Do not use unsupported source IDs such as `external`, `reference`, or `local_path`. Concrete external issue references and local paths belong in the `## Source Context` section of `tasks.md`.

If lifecycle progress fails, do not recreate tasks just to recover. Report the progress failure so the user can rerun the command or inspect `status.yml`.

---

# Surface Weave Notices

Every Weave skill discovery phase calls at least one Tier 1 command
(`weave workspace`, `weave change current`, `weave change status`,
`weave change new`, or `weave status`). Tier 1 commands return a stable
`notices` array in their `--json` output describing outdated packages,
modified skills, and skills that need updating.

When you run any Tier 1 command (with or without `--json`) and the result
contains a non-empty `notices` array, surface them to the user verbatim
near the start of your response. Do not edit notice text. Do not suppress
notices unless the user explicitly asks. Do not invent notices.

If notices recommend `weave status`, suggest the user run it. If notices
recommend `weave agent update`, suggest that. Do not run `npm i -g` or
any package manager command yourself; let the user run it.

If `WEAVE_NO_NOTICES=1` is set in the environment, the notices array will
be empty by design and you should not warn about it.

---

# Lifecycle Staleness Verification

Before calling `weave change progress`, verify content-sync of every artifact
that would otherwise be marked stale by the default pessimistic propagation.

The `--source` arguments of `weave change progress` declare causal influence,
not strict-DAG dependency. Pessimistic staleness propagation is the safe default,
not the only correct answer. When the clarification this skill just performed is
narrowly contained (a typo fix, a sentence rewording, an open-question
resolution), dependents may already be in content sync; flagging them stale
creates churn the user did not ask for.

Procedure:

1. Identify the set of structural dependents of the lane being progressed. Read
   `wiki/changes/<change-id>/status.yml` and compute which lanes list this
   lane in their `artifacts.<lane>.sources`.
2. For each dependent lane, read both the dependent artifact and the artifact
   just being progressed. Decide whether the change you just made invalidates
   the dependent's content. The judgement is binary per lane: invalidates, or
   does not invalidate.
3. Select the appropriate progress invocation:

   - Every dependent is invalidated (or there are no dependents):
     `weave change progress <lane> --source <list> --json` (default, no new flags)
   - No dependent is invalidated:
     `weave change progress <lane> --source <list> --no-invalidate --json`
   - Some dependents are invalidated, some are not:
     `weave change progress <lane> --source <list> --invalidate=<comma-list> --json`

4. If a previously-stale dependent is now in content sync (because the upstream
   change has been absorbed but the stale flag still lingers from an earlier
   pessimistic propagation), clear it explicitly:

   `weave change clear-stale <lane> --reason "<one-sentence verification>" --json`

   Always pass `--reason` so the audit entry in `stale_history` carries the
   verification rationale. Do not clear flags without reading both artifacts.

5. Never edit `status.yml` by hand to manipulate stale state. Use the CLI.

Failure mode: if you are uncertain whether a dependent is in content sync,
prefer the pessimistic default (omit `--no-invalidate` and `--invalidate`).
The user can always run `weave-clarify <lane>` later. A false-positive stale
flag is recoverable; silently leaving a real downstream artifact mismatched is
not.
