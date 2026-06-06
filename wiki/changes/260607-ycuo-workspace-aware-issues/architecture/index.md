---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-06-06T22:23:52.000Z
updated_at: 2026-06-06T22:30:46.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: prd
---

# Workspace-Aware Issues Architecture

## Decision Summary

- Keep one canonical `wiki/changes/<change-id>/tasks.md` artifact for the `issues` lane.
- Make scoped task generation a `weave-issues` skill behavior, not a CLI/runtime command parser change.
- Add task-level scope and repo-location metadata so scoped and multi-repo tracer bullets remain understandable to future implementers.
- Preserve tracer-bullet semantics: scoped tasks must remain independently verifiable behavior slices, not backend/frontend layer lists.
- Do not introduce per-repo task files, per-repo task statuses, new lifecycle lanes, or a rigid scope taxonomy.

## System Context

- Active change: `260607-ycuo-workspace-aware-issues`.
- Product contract: `wiki/changes/260607-ycuo-workspace-aware-issues/prd.md`.
- Current skill behavior: `templates/skills/weave-issues/SKILL.md` creates and reconciles one `tasks.md` with `T#`, `QF#`, and `R#` sections.
- Installed skill copies are expected to match the bundled template: `.agents/skills/weave-issues/SKILL.md` and `.claude/skills/weave-issues/SKILL.md`.
- Opencode command wrapper: `templates/opencode/commands/weave-issues.md` passes `$ARGUMENTS` as context, so scoped usage does not require command parser changes.
- Skill installation and propagation are template-driven through `src/lib/agent-skills.ts`; no runtime behavior change is expected.
- Existing tests in `tests/agent-skills.test.ts` assert important `weave-issues` template text and installed opencode behavior.

## Architecture Overview

This change updates the `weave-issues` skill contract. The skill should interpret an invocation argument such as `backend`, `frontend`, or `full-stack` as a free-form planning/ownership scope.

`Scope` is task metadata. It is not:

- a repo selector
- an architecture facet selector
- a technical layer
- a lifecycle lane
- an artifact target

The task artifact remains one Markdown file:

```text
wiki/changes/<change-id>/tasks.md
```

The active task index should include scope and repo mapping:

```md
| ID | Status | Type | Scope | Primary repo | Repos | Title | Blocked by |
| --- | --- | --- | --- | --- | --- | --- | --- |
```

Each `T#` task should include these metadata fields:

```md
Scope: <backend | frontend | full-stack | user-provided label>
Primary repo: <repo id or workspace>
Repos: <repo ids, or None>
Architecture refs: <relevant architecture files/facets, or None>
Coordination: <none or concrete cross-scope note>
```

For multi-repo tasks, or tasks where implementation location would otherwise be ambiguous, include repo-location guidance:

```md
### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
```

`Repo Involvement` is guidance only. It must not contain status columns, become subtask tracking, or create separate canonical task units.

## Skill Template Changes

Update `templates/skills/weave-issues/SKILL.md` in these areas:

1. Gather context: document `weave-issues <scope>` as a free-form planning/ownership label.
2. Explore the codebase: in workspace mode, use registered repos as implementation-location evidence while still writing only the workspace-level `tasks.md`.
3. Draft vertical slices: strengthen the rule that scoped tasks remain tracer bullets and include examples of bad layer tasks versus good behavior slices.
4. Quiz the user: preview `Scope`, `Primary repo`, `Repos`, `Architecture refs`, and whether a task is repo-local or full-stack.
5. Reconcile `tasks.md`: preserve unrelated scope tasks during scoped reruns, reconcile matching-scope tasks, and propose `Scope: full-stack` when the smallest meaningful behavior crosses backend/frontend boundaries.
6. Template shape: add the new task index columns, task metadata fields, and optional `Repo Involvement` section.
7. Anti-rules: explicitly forbid `tasks/<repo>/tasks.md`, per-repo task artifacts, per-repo statuses in `Repo Involvement`, and forced backend/frontend splitting of a single tracer bullet.

## Exact `weave-issues` Wording And Placement

Add the following wording to `templates/skills/weave-issues/SKILL.md`. After updating the canonical template, copy the same content into `.agents/skills/weave-issues/SKILL.md` and `.claude/skills/weave-issues/SKILL.md` so installed copies remain aligned.

### Insert After `### 1. Gather Context`

Place this immediately after the opening paragraph that currently says: `Work from whatever is already in the conversation context...`.

```md
If the user invokes `weave-issues <scope>`, treat `<scope>` as a free-form planning and ownership label for this run.

Common examples are `backend`, `frontend`, and `full-stack`, but do not enforce a fixed taxonomy. Preserve the user's language unless it is ambiguous.

Scope is not a repo name, architecture facet name, technical layer, lifecycle lane, or artifact target. `weave-issues backend` means generate or reconcile backend-owned tracer-bullet implementation slices using all relevant source context. `weave-issues frontend` means generate or reconcile frontend-owned tracer-bullet implementation slices using all relevant source context.

A scoped run may still propose `Scope: full-stack` tasks when the smallest independently verifiable behavior crosses backend and frontend boundaries. Do not force a naturally full-stack behavior into fake backend-only or frontend-only tasks.
```

### Insert After The Durable Artifact List In `### 1. Gather Context`

Place this after the existing durable artifact bullets that read PRD, architecture, `status.yml`, and existing `tasks.md`.

```md
When a scope is provided, still read all source context relevant to that scoped ownership boundary. Do not read only a same-named architecture facet and do not assume the scope is a repo selector. For example, `weave-issues backend` may need `architecture/backend.md`, `architecture/frontend.md`, `architecture/api-contract.md`, `architecture/index.md`, repo docs, and existing frontend or full-stack tasks to detect coordination needs or conflicts.
```

### Insert In `### 2. Explore The Codebase`

Place this after the paragraph ending `respect ADRs in the area being touched.`.

```md
In workspace mode, use registered `repos[]` as implementation-location evidence, not as separate task artifact targets. For repos that appear relevant to the requested scope or source context, identify:

- repo id or name
- repo kind when known
- likely code anchors
- likely test or verification anchors
- which task scope(s) the repo appears relevant to

Do not create per-repo task files. The only task artifact remains `wiki/changes/<change-id>/tasks.md`.
```

### Insert In `### 4. Draft Vertical-Slice Tasks`

Place this after the sentence `Each task is a thin vertical slice that cuts through all relevant integration layers end-to-end, not a horizontal slice of one layer.`.

```md
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
```

### Replace The Preview Bullets In `### 5. Quiz The User`

Replace the existing list under `For each slice, show:` with this list.

```md
- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Scope**: backend, frontend, full-stack, or the user-provided label
- **Primary repo**: main implementation location, or `workspace` / `None` when not repo-specific
- **Repos**: all repos expected to be touched, or `None`
- **Architecture refs**: architecture files or facets that explain the task, when known
- **Blocked by**: which other slices, if any, must complete first
- **User stories covered**: which user stories this addresses, if the source material has them
- **Repo-local or full-stack**: whether the slice is contained in one repo/scope or crosses repos/scopes
```

Replace the existing questions under `Ask the user:` with this list.

```md
- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?
- Are the scopes and repo mappings correct?
- Should any backend/frontend scoped task become full-stack, or vice versa?
- Are any repo/code anchors missing or misleading?
```

### Insert In `### 6. Write Or Reconcile Local tasks.md`

Place this after the existing rerun reconciliation bullets and before the paragraph that starts `Append-first, preview-before-write...`.

```md
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
```

### Replace The Active Task Index In `<tasks-template>`

Replace the current table under `## Active Task Index` with this table.

```md
| ID | Status | Type | Scope | Primary repo | Repos | Title | Blocked by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | todo | AFK | <scope> | <repo or workspace> | <repos or None> | <title> | None |
```

### Insert Task Metadata In `<tasks-template>`

Place these fields inside each `T#` detail block after `Type: AFK` and before `Blocked by:`.

```md
Scope: <backend | frontend | full-stack | user-provided label>

Primary repo: <repo id or workspace>

Repos: <repo ids, or None>

Architecture refs: <relevant architecture files/facets, or None>

Coordination: <none or concrete cross-scope note>
```

### Insert Optional Repo Involvement In `<tasks-template>`

Place this section after `### What to build` and before `### Acceptance Criteria`. Include it for multi-repo tasks or when implementation location would otherwise be ambiguous. Omit it for obvious single-repo tasks.

```md
### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| <repo> | <scope> | <what this repo contributes to the behavior> | <paths or "inspect repo docs/code"> | <tests/checks or "inspect repo test conventions"> |
```

Add this sentence immediately after the table when the section is present:

```md
`Repo Involvement` is implementation guidance only; it is not subtask tracking and must not include per-repo statuses.
```

### Add Assertions In `tests/agent-skills.test.ts`

Add assertions near the existing `issuesSkill` checks for the installed opencode skill.

```ts
expect(issuesSkill).toContain("If the user invokes `weave-issues <scope>`");
expect(issuesSkill).toContain("Scope is not a repo name, architecture facet name, technical layer, lifecycle lane, or artifact target.");
expect(issuesSkill).toContain("A scoped run may still propose `Scope: full-stack` tasks");
expect(issuesSkill).toContain("| ID | Status | Type | Scope | Primary repo | Repos | Title | Blocked by |");
expect(issuesSkill).toContain("Architecture refs: <relevant architecture files/facets, or None>");
expect(issuesSkill).toContain("### Repo Involvement");
expect(issuesSkill).toContain("`Repo Involvement` is implementation guidance only");
expect(issuesSkill).toContain("Do not create `tasks/<repo>/tasks.md`");
```

## Files Affected

- `templates/skills/weave-issues/SKILL.md`: canonical behavior and template shape.
- `.agents/skills/weave-issues/SKILL.md`: checked-in installed copy for shared agents/opencode.
- `.claude/skills/weave-issues/SKILL.md`: checked-in installed copy for Claude.
- `tests/agent-skills.test.ts`: assertions for scope-aware wording and new template fields.
- `wiki/knowledge/domains/change-workflow/features/weave-issues/behavior.md`: current-state behavior after implementation.
- `templates/opencode/commands/weave-issues.md`: optional wording-only update if scoped usage should be visible in the command description.

## Tradeoffs

- Keeping one `tasks.md` preserves lifecycle simplicity but requires richer metadata for scope and repo guidance.
- Putting scope behavior in the skill avoids CLI churn but relies on clear instructions and tests to keep agent behavior stable.
- Making `Repo Involvement` optional keeps simple tasks concise but means the skill must judge when implementation location is ambiguous.
- Allowing `Scope: full-stack` during scoped runs preserves tracer-bullet quality but means `weave-issues backend` may produce tasks that are not purely backend-scoped when the behavior demands it.

## Risks And Mitigations

- Risk: Agents treat `Scope` as a repo or facet selector. Mitigation: repeat that scope is an ownership/planning label and instruct the skill to use all relevant source context.
- Risk: Agents generate horizontal backend/frontend task lists. Mitigation: add explicit bad/good examples and require behavior/outcome-shaped slices.
- Risk: `Repo Involvement` becomes execution tracking. Mitigation: explicitly forbid per-repo statuses and subtasks in that section.
- Risk: Existing `tasks.md` files lack scope metadata. Mitigation: reruns should add metadata only when intent maps cleanly and otherwise preview ambiguity.
- Risk: Full-stack tasks become too large. Mitigation: keep the smallest independently verifiable behavior as the slice boundary.

## Open Questions

- Should `Repo Involvement` be required only for multi-repo and ambiguous-location tasks, or should it be included for every `T#` task? Recommendation: require it for multi-repo and ambiguous-location tasks only.

## Revision History

- 2026-06-07: Added exact `weave-issues` skill wording and placement guidance for scope handling, repo discovery, scoped tracer bullets, preview prompts, scoped reconciliation, task template metadata, optional `Repo Involvement`, and tests.

## Capture Guidance

- This architecture can stay in `architecture/index.md`; no separate facet is required unless implementation uncovers a larger command-wrapper or template-propagation design concern.
