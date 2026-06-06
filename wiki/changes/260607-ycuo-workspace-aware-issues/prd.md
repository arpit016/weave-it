---
artifact: prd
status: draft
owner: product
created_at: 2026-06-06T22:15:15.000Z
updated_at: 2026-06-06T22:15:15.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Workspace-Aware Issues PRD

## Problem Statement

`weave-issues` currently creates one local `tasks.md` for a change. That works for a single repo or a monorepo when one person plans the whole change, but workspace and multi-repo work introduces a practical planning problem: backend and frontend engineers often plan in parallel or in isolation, then need a coherent task breakdown that still preserves tracer-bullet slicing.

If tasks are split by repo, the task model can drift toward horizontal work such as "add endpoint" or "add component" rather than independently verifiable behavior slices. If tasks stay in one file without scope and repo metadata, implementation agents may not know which repo to inspect or which part of the architecture explains the task.

The product needs one canonical task artifact that supports scoped planning and reruns while making each tracer bullet's implementation location clear.

## Goals

- Keep one canonical `wiki/changes/<change-id>/tasks.md` artifact for the `issues` lane.
- Let users ask `weave-issues` for scoped task generation, such as `backend` or `frontend`.
- Preserve tracer-bullet task generation even when the user asks for a scope.
- Allow scoped runs to generate `full-stack` tasks when the smallest meaningful behavior crosses backend and frontend boundaries.
- Add enough repo and architecture metadata for future implementation agents to know where to work.
- Support reruns that reconcile the requested scope while preserving unrelated scope tasks.
- Avoid rigid scope taxonomies and preserve user-provided language.

## Non-Goals

- Creating `tasks/<repo>/tasks.md` or any per-repo task artifact.
- Creating or modifying change artifacts inside workspace sub-repos.
- Defining task execution commands or execution-agent behavior.
- Adding per-repo status, per-repo subtask tracking, or repo-row completion semantics.
- Enforcing a fixed list of scopes such as `mobile`, `contracts`, `infra`, or `docs`.
- Changing the `issues` lifecycle lane or adding new lifecycle lanes.

## Actors

- **Backend engineer**: wants backend-owned implementation slices without taking on frontend-only work.
- **Frontend engineer**: wants frontend-owned implementation slices without taking on backend-only work.
- **Full-stack engineer**: wants end-to-end tracer bullets across all relevant repos.
- **Agent generating tasks**: reads PRD, architecture, sessions, codebase context, and existing `tasks.md` to generate or reconcile scoped tasks.
- **Agent implementing tasks later**: uses task metadata to find relevant repos, architecture references, likely code anchors, and verification anchors.

## Current Behavior

`weave-issues` creates or reconciles:

```text
wiki/changes/<change-id>/tasks.md
```

The current task shape focuses on `T#` implementation tasks, optional `QF#` QA findings, and optional `R#` refactors. `T#` tasks are expected to be tracer-bullet slices and can be `HITL` or `AFK`.

Workspace-aware skill behavior already treats the workspace root as the single change artifact store. Registered repos are implementation and evidence locations, not separate artifact targets.

## Proposed Behavior

`weave-issues` remains a single-artifact task generator, but becomes scope-aware.

Users may invoke it with a free-form scope argument:

```text
weave-issues backend
weave-issues frontend
weave-issues full-stack
```

The scope argument is a planning and ownership label. It is not a repo name, an architecture facet name, a technical layer, or permission to generate horizontal tasks.

Common labels are `backend`, `frontend`, and `full-stack`, but the skill should preserve user terminology and avoid enforcing a rigid taxonomy.

When a scoped run discovers that the smallest independently verifiable behavior crosses backend and frontend boundaries, it may propose a `Scope: full-stack` task instead of forcing the work into backend-only or frontend-only tasks.

## Tracer Bullet Semantics

A tracer-bullet task is the smallest independently verifiable increment of behavior within the relevant ownership boundary.

Bad backend slices:

- Add database table.
- Add service method.
- Add endpoint.

Good backend slice:

- Allow API consumers to create pending workspace invitations.

Bad frontend slices:

- Add component.
- Add route.
- Wire API client.

Good frontend slice:

- Let admins submit workspace invitations from settings.

Good full-stack slice:

- Let admins create a pending workspace invitation from workspace settings.

DB work is normally part of backend-owned behavior. Mobile work may fit the frontend scope when that is the team's language. Contract/API boundary concerns should usually appear as `Coordination` on relevant tasks rather than as a required separate scope.

## Task Artifact Shape

`tasks.md` remains the only `issues` artifact.

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

For multi-repo tasks, or when implementation location would otherwise be ambiguous, include repo involvement guidance:

```md
### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| api | backend | Invitation creation behavior, auth, validation, persistence. | `src/invitations/` | invitation/API tests |
| web | frontend | Invite form, submit flow, success and error states. | `src/settings/`, `src/api/` | settings/invitation UI tests |
```

`Repo Involvement` is implementation guidance only. It must not introduce per-repo statuses, per-repo subtasks, or separate canonical task units.

## User Workflows

### Workflow: Backend engineer generates backend-owned tasks

1. Backend engineer runs `weave-issues backend`.
2. The skill reads all relevant source context, including PRD, architecture facets, sessions, existing `tasks.md`, repo docs, and code/test anchors when useful.
3. The skill drafts backend-owned tracer-bullet tasks.
4. If a behavior naturally crosses backend and frontend, the skill may propose a `Scope: full-stack` task.
5. The preview shows scope, primary repo, repos, architecture refs, and blockers before writing.
6. After approval, the skill writes or reconciles `tasks.md`.

### Workflow: Frontend engineer generates frontend-owned tasks later

1. Frontend engineer runs `weave-issues frontend`.
2. The skill reads existing `tasks.md` and relevant source context.
3. Backend-scoped tasks are preserved unless the frontend plan reveals a direct conflict.
4. Frontend-owned tasks are added or reconciled.
5. Full-stack tasks may be added if the smallest meaningful behavior crosses frontend and backend.

### Workflow: Full change reconciliation

1. User runs `weave-issues` without a scope, or with a broad scope such as `full-stack` if that is the team's language.
2. The skill reviews all concrete source context and existing tasks.
3. The skill checks that tasks cover relevant PRD and architecture behavior.
4. The skill reconciles all applicable task scopes after user approval.

## Rerun Behavior

When `tasks.md` exists and the user invokes a scope:

- Read existing `tasks.md` before drafting.
- Preserve unrelated scope tasks unless the current scope reveals a direct conflict.
- Reconcile tasks in the requested scope.
- Preserve stable IDs when task intent still maps cleanly.
- Preserve statuses and checked acceptance criteria when intent still maps cleanly.
- Add new scoped tasks with new IDs.
- Mark obsolete tasks in the requested scope as `invalid` rather than deleting them.
- Do not reuse invalidated IDs.
- If a scoped run discovers a genuinely cross-backend/frontend behavior, propose a `Scope: full-stack` task.
- If the scoped plan conflicts with another scope's existing task or architecture assumption, stop before writing and ask whether to clarify architecture first.

## Functional Requirements

- `weave-issues` should accept a free-form scope argument.
- Scope examples should include `backend`, `frontend`, and `full-stack`, without enforcing a fixed taxonomy.
- Scoped task generation must still follow tracer-bullet rules.
- The generated task index should include `Scope`, `Primary repo`, and `Repos` columns.
- Each task should include `Scope`, `Primary repo`, `Repos`, `Architecture refs`, and `Coordination` fields.
- Multi-repo or ambiguous-location tasks should include `Repo Involvement` guidance.
- `Repo Involvement` should include repo role, likely code anchors, and likely test/verification anchors when known.
- `Repo Involvement` should not include per-repo status or subtask tracking.
- The skill should preview proposed scopes and repo mappings before writing.
- The skill should ask for confirmation when repo mapping is uncertain.
- The skill should never create `tasks/<repo>/tasks.md`.

## Acceptance Criteria

- [ ] `weave-issues backend` is documented as backend-owned tracer-bullet generation, not backend-layer task generation.
- [ ] `weave-issues frontend` is documented as frontend-owned tracer-bullet generation, not frontend-layer task generation.
- [ ] Scoped runs may propose `Scope: full-stack` tasks when behavior crosses backend/frontend boundaries.
- [ ] The canonical task template includes `Scope`, `Primary repo`, `Repos`, `Architecture refs`, and `Coordination` fields.
- [ ] The active task index includes scope and repo mapping columns.
- [ ] Multi-repo tasks include `Repo Involvement` guidance without per-repo statuses.
- [ ] Rerun guidance preserves unrelated scopes and reconciles only relevant scoped tasks unless conflicts are detected.
- [ ] The skill explicitly rejects per-repo task artifacts.
- [ ] Knowledge documentation reflects the new scoped behavior.
- [ ] Skill template tests cover the new wording and template shape.

## Edge Cases

- **No scope provided**: generate or reconcile tasks for the whole available source context using existing behavior, now with scope metadata where useful.
- **Unknown scope provided**: preserve the user's label and preview it before writing.
- **Scope resembles a repo name**: do not assume it is a repo; use repo evidence separately to fill `Primary repo` and `Repos`.
- **Scope resembles an architecture facet**: do not read only that facet; use all relevant source context.
- **Full-stack behavior appears during scoped run**: propose a `Scope: full-stack` task instead of forcing an artificial backend-only/frontend-only split.
- **Repo mapping is uncertain**: preview candidate repos and ask for confirmation before writing vague tasks.
- **Architecture/source conflict across scopes**: stop before writing and ask whether architecture should be clarified.

## Rollout Considerations

This change updates skill behavior and task artifact shape. Existing `tasks.md` files remain valid; reruns should preserve existing IDs and statuses and add missing scope/repo metadata where the intent maps cleanly.

No data migration is required.

## Open Questions

- Should the opencode command wrapper show scoped examples, or should examples remain only in the skill body?
- Should `Repo Involvement` be required for every task or only for multi-repo and ambiguous-location tasks?

## Revision History

- 2026-06-07: Initial PRD generated from exploration discussion.
