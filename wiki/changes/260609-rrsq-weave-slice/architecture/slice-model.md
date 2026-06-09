---
facet: slice-model
description: Task-slices folder layout, per-slice artifacts, status vocabulary, and AFK/HITL task semantics.
---

# Slice Model

## Task-Slices Directory Structure

Every sliced change gets a `task-slices/` folder at the change root. Each child folder is one vertical behavior (one tracer bullet). A change-level `dependency-graph.md` appears when there are two or more slices.

```text
wiki/changes/<change-id>/
  status.yml                        (change-level lifecycle; not slice-level)
  task-slices/
    dependency-graph.md             (auto-generated; only when slice count >= 2)
    01-admin-creates-workflow/
      slice.md                      (human narrative)
      contracts.md                  (slice-level technical contracts)
      tasks.md                      (horizontal task breakdown)
      status.yml                    (machine-readable slice state)
    02-admin-configures-approvers/
      slice.md
      contracts.md
      tasks.md
      status.yml
    03-proposer-edits-compensation/
      ...
```

### Slice ID Convention

- Folder name: `<NN>-<slug>` where `NN` is a zero-padded two-digit prefix (`01`, `02`, …) and `<slug>` is a kebab-case human label.
- `status.yml.id` matches the folder name exactly (e.g. `02-admin-configures-approvers`).
- `status.yml.depends_on` references other slices by their `id` values.
- IDs are allocated atomically in one pass by `weave-slices`; never renumbered once tasks are `in_progress` or `done`.

### Per-Slice Folder Contents

| File | Required | Written by | Purpose |
|---|---|---|---|
| `slice.md` | feat always; fix optional | `weave-slices` / human | Human narrative: outcome, user flow, scope, acceptance |
| `contracts.md` | feat always; fix optional | `weave-slices` / human | Slice-level technical contracts — interfaces, data shapes, state, validation |
| `tasks.md` | always | `weave-slices`, `weave-execute`, human | Horizontal task breakdown with per-task fields |
| `status.yml` | always | `weave-slices` (scaffold), rollup library (derived fields) | Machine-readable slice metadata and rollup |

For fix-type single-slice changes, `weave-fix` scaffolds only `tasks.md` + `status.yml` and skips `slice.md` / `contracts.md` when there is nothing meaningful to write. They are added when a second slice is introduced via idempotent `weave-slices` re-run.

### Slice As The Unit Of Vertical Work

A slice represents one vertical behavior (one tracer bullet). `slice.md` carries the narrative. `tasks.md` decomposes the slice into horizontal tasks grouped under per-repo headings. Tasks within a slice coordinate via `Blocked by:` (within-slice only). Slices coordinate via `status.yml.depends_on`.

- A slice is the vertical thing (tracer-bullet, end-to-end behavior).
- Tasks within a slice are horizontal (per-repo, per-layer work).

Cross-slice task-level dependencies are disallowed in v1. If you need fine-grained cross-slice task ordering, restructure slice boundaries instead.

## Per-Change-Type Lane Chains

- `--type feat`: `exploration.md` -> `prd.md` -> `architecture/` -> `task-slices/`
- `--type fix`: `findings.md` -> `architecture/` (optional) -> `task-slices/`
- `--type chore` / `--type refactor`: `exploration.md` -> `architecture/` (optional) -> `task-slices/`

---

## `status.yml` Reference (per slice)

One `status.yml` per slice folder. Engineers may edit `owner`, `depends_on`, and `title`. Rollup-derived fields (`status`, `task_summary`, `updated_at` on rollup) are written by the rollup library and should not be hand-edited.

### Field Reference

| Field | Type | Written by | Notes |
|---|---|---|---|
| `version` | `1` | `weave-slices` | Schema version |
| `id` | string | `weave-slices` | Matches folder name (`02-admin-configures-approvers`) |
| `title` | string | `weave-slices` / human | Human-readable slice title |
| `status` | `pending \| in_progress \| done` | rollup library | Derived from task states in `tasks.md`; never set manually |
| `owner` | string | human / agent | Free text; blank by default |
| `repos` | string[] | `weave-slices` / rollup | Union of `Repos:` values from tasks; may be derived by rollup |
| `depends_on` | string[] | `weave-slices` / human | Slice IDs that must be `done` before this slice can start |
| `task_summary.total` | number | rollup library | Count of active `T#` tasks |
| `task_summary.done` | number | rollup library | Tasks with `Status: done` |
| `task_summary.blocked` | number | rollup library | Tasks with `Status: blocked` |
| `created_at` | ISO 8601 | `weave-slices` | Set at scaffold time |
| `updated_at` | ISO 8601 | rollup library | Bumped on each rollup |

### Status Derivation Rules

Slice `status` is rollup-derived from per-task `Status:` in this slice's `tasks.md`:

- all tasks `done` -> `status: done`
- any task `in_progress`, or some tasks `done` but not all -> `status: in_progress`
- otherwise -> `status: pending`

`ready` and `blocked` are never stored in `status.yml`. They appear only in `dependency-graph.md` for `pending` slices based on whether all `depends_on` slices are `done`.

### Example

```yaml
version: 1
id: 02-admin-configures-approvers
title: Admin configures approvers
status: in_progress
owner: Shubham
repos: [admin-app, api-server]
depends_on:
  - 01-admin-creates-workflow
task_summary:
  total: 3
  done: 1
  blocked: 0
created_at: 2026-06-09T15:00:00.000Z
updated_at: 2026-06-09T16:30:00.000Z
```

---

## `tasks.md` Reference (per slice)

One `tasks.md` per slice. Tasks are grouped under `## <repo-name>` headings (repo IDs from `workspace.yml.repos[].id`). Cross-repo tasks go under `## cross-cutting`. QA findings and refactors live at the bottom in separate sections.

### Document Shape

```markdown
---
artifact: tasks
slice: 02-admin-configures-approvers
status: draft
owner: engineering
created_at: <iso>
updated_at: <iso>
source: architecture
---

# Tasks: Admin configures approvers

## Status Legend

- `todo`: ready when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without listed blocker
- `done`: implemented and verified
- `not_tested`: implementation complete, automated verification incomplete
- `invalid`: no longer applies

## Active Task Index

| ID | Status | Execution | Repos | Owner | Title | Blocked by |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | done | hitl | admin-app | | Add approver picker UI | None |
| T2 | in_progress | afk | api-server | | Expose approvers list endpoint | T1 |
| T3 | todo | hitl | cross-cutting | | Wire picker to endpoint | T1, T2 |

## admin-app

### T1: Add approver picker UI

Status: done
Owner:
Repos: admin-app
Execution: hitl
Blocked by: None
Files:
- src/components/ApproverPicker.tsx (C)
- src/pages/WorkflowSettings.tsx (M)

### What to build

Admin can select approvers from a searchable list in workflow settings.

### Acceptance Criteria

- [ ] Picker renders in workflow settings
- [ ] Selected approvers persist in form state

### Verification

- Automated tests: `npm test -- ApproverPicker`
- Manual/smoke check: open workflow settings, select two approvers

## api-server

### T2: Expose approvers list endpoint

Status: in_progress
Owner:
Repos: api-server
Execution: afk
Blocked by: T1
Files:
- src/routes/approvers.ts (C)
- src/handlers/listApprovers.ts (C)

### What to build

`GET /api/workflows/:id/approvers` returns the configured approver list.

### Acceptance Criteria

- [ ] Endpoint returns 200 with approver array
- [ ] Returns 404 for unknown workflow

### Verification

- Automated tests: `npm test -- listApprovers`

## cross-cutting

### T3: Wire picker to endpoint

Status: todo
Owner:
Repos: admin-app, api-server
Execution: hitl
Blocked by: T1, T2
Files:
- src/api/approvers.ts (C)
- src/components/ApproverPicker.tsx (M)

### What to build

Frontend fetches approvers from the new endpoint and renders them in the picker.

### Acceptance Criteria

- [ ] Picker loads approvers from API on mount
- [ ] Error state shown when endpoint fails

### Verification

- Automated tests: `npm test -- approvers integration`
- Manual/smoke check: end-to-end picker load in dev

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Verification

Not run yet.
```

### Per-Task Field Reference

| Field | Required | Values | Notes |
|---|---|---|---|
| `T#` | yes | `T1`, `T2`, … | Stable IDs within this slice; never reused after invalidation |
| `Status:` | yes | `todo \| in_progress \| done \| not_tested \| blocked \| invalid` | Set by `weave-execute` during implementation |
| `Owner:` | no | free text | Blank by default; human/agent fills in |
| `Repos:` | yes | csv of repo IDs | From `workspace.yml.repos[].id`; source of truth for repo involvement |
| `Execution:` | yes | `afk \| hitl` | Default `hitl`; `weave-slices` promotes to `afk` only when mechanical |
| `Blocked by:` | yes | csv of `T#` or `None` | Within-slice only; cross-slice blocking uses `status.yml.depends_on` |
| `Files:` | yes | paths with `(C)` / `(M)` / `(D)` | Documentation for engineers; not parsed for automation |
| `Acceptance:` | yes | checkbox list | What "done" means for this task |
| `Verification:` | yes | test commands + manual checks | How to confirm the task |

### Repo Headings vs `Repos:`

- `## <repo-name>` headings are presentational grouping for human scanning.
- `Repos:` on each task is the source of truth for which repos a task touches.
- A task under `## cross-cutting` has a multi-value `Repos:` line.

### QA Findings and Refactors

Preserved from the existing Weave flat `tasks.md` model. `QF#` and `R#` use independent ID namespaces from `T#`. They live at the bottom of the slice's `tasks.md`, not in a separate file.

---

## `dependency-graph.md` Reference (change-level)

Lives at `task-slices/dependency-graph.md`. Auto-generated by `weave slice rollup`. Do not edit by hand. Only generated when the change has two or more slices. Source of truth is per-slice `status.yml` files; the markdown is for human glanceability and agent conversational surface.

See `rollup-library.md` for generation triggers and rollup behavior.

### Section Reference

| Section | Content | Data source |
|---|---|---|
| Banner | Auto-generated notice + timestamp | rollup library |
| Purpose | One-liner explaining source of truth | static template |
| Graph | ASCII tree of slice dependencies | all slices' `id` + `depends_on` |
| Slice dependencies | Table of all slices with status and owner | all slices' `status.yml` |
| Ready to work now | List of slices that can start | slices where `status: pending` and all deps `done` |
| Blocked slices | Slices waiting on deps, with blocker list | slices where `status: pending` and any dep not `done` |
| Critical path | Longest dependency chain | topological analysis of `depends_on` |
| Parallel work | Narrative of concurrent slices | groups off the critical path |

### Status Column Rendering

The table `Status` column shows stored slice status (`pending`, `in_progress`, `done`) plus derived labels for `pending` slices:

- `ready` — all `depends_on` slices are `done`; work can start.
- `blocked` — at least one `depends_on` slice is not `done`.

`in_progress` and `done` slices show their stored status as-is.

### Full Example

Five-slice workflow with mixed progress:

```markdown
<!-- AUTO-GENERATED by weave slice rollup. Do not edit by hand.
     Source of truth: per-slice status.yml.
     Generated at: 2026-06-09T16:35:12.000Z -->

# Dependency Graph

## Purpose

Execution order of vertical slices for this change. A slice can start only when
all slices listed in its `depends_on` are `done`.

## Graph

```text
01 admin-creates-workflow
├── 02 admin-configures-approvers
│   └── 04 proposer-submits-workflow
│       └── 05 approver-reviews-workflow
└── 03 proposer-edits-compensation
    └── 04 proposer-submits-workflow
```

## Slice dependencies

| Slice | Depends on | Status | Owner |
|---|---|---|---|
| 01 admin-creates-workflow | none | done | Sharma |
| 02 admin-configures-approvers | 01 | in_progress | Shubham |
| 03 proposer-edits-compensation | 01 | ready | Stephen |
| 04 proposer-submits-workflow | 02, 03 | blocked | Sharma |
| 05 approver-reviews-workflow | 04 | blocked | Shubham |

## Ready to work now

- 03 proposer-edits-compensation

## Blocked slices

### 04 proposer-submits-workflow

Blocked by:

- 02 admin-configures-approvers
- 03 proposer-edits-compensation

### 05 approver-reviews-workflow

Blocked by:

- 04 proposer-submits-workflow

## Critical path

01 admin-creates-workflow → 02 admin-configures-approvers → 04 proposer-submits-workflow → 05 approver-reviews-workflow

## Parallel work

After Slice 01 is done, these can happen in parallel:

- 02 admin-configures-approvers
- 03 proposer-edits-compensation

Once both are done, Slice 04 can start.
```

### Cycle Warning

When `depends_on` contains a cycle, the rollup library writes a warning instead of the graph sections:

```markdown
## WARNING: dependency cycle detected

The following slices form a dependency cycle. Resolve before the graph can be regenerated:

- 02-admin-configures-approvers → 03-proposer-edits-compensation → 02-admin-configures-approvers
```

Primary slice writes still succeed; only the graph regeneration is skipped until the cycle is resolved.

---

## `slice.md` Reference (brief)

Human narrative; no frontmatter. Sections: Outcome, User flow, In scope, Out of scope, Acceptance criteria.

`slice.md` answers **what** the slice delivers in product terms. It is the human story.

---

## `contracts.md` Reference

Slice-level technical contracts. No frontmatter.

`contracts.md` answers **how** the slice is implemented across the layers and repos that `tasks.md` will touch. It carries the technical depth that `slice.md` deliberately omits: concrete shapes, boundaries, error behavior, and state rules that engineers (and agents) need before writing code.

It is not limited to frontend/backend handshakes. A slice may be backend-only, frontend-only, CLI-only, or cross-cutting. The file adapts to whatever interfaces the slice actually has.

### Relationship To Other Slice Files

| File | Audience | Question it answers |
|---|---|---|
| `slice.md` | PM, engineers | What behavior does this slice deliver? |
| `contracts.md` | Engineers, agents | What are the technical interfaces and rules? |
| `tasks.md` | Engineers, agents | Who does what, in which repo, in what order? |
| `status.yml` | Agents, rollup | What is the slice's machine-readable state? |

Change-level `architecture/` holds cross-cutting design (auth, deployment, data model spanning slices). `contracts.md` holds only what is specific to **this slice's** implementable boundary. When a concern is shared across slices, reference the architecture facet and document only the slice-local surface here.

### Section Guidance

Include only sections relevant to this slice. Do not pad empty headings. `weave-slices` scaffolds the sections that apply based on the slice's repos and layers.

**Always consider:**

- **Interfaces** — the concrete surfaces other code or users touch: HTTP endpoints, GraphQL operations, CLI commands, event payloads, component props, file formats, hook payloads.
- **Data** — schema changes, storage shapes, persisted fields, migration notes, config keys.
- **State** — lifecycle transitions, UI states, status enums, idempotency rules, side effects.
- **Validation and errors** — input rules, authorization checks, error response shapes, retry behavior, failure modes.

**Include when relevant:**

- **API** — request/response shapes, status codes, auth requirements (backend or BFF slices).
- **UI states** — loading, empty, error, success rendering rules (frontend slices).
- **Events** — published/consumed events, ordering guarantees, payload schemas (async slices).
- **Files and artifacts** — new file paths, config keys, template shapes (CLI/skill slices).
- **Observability** — logs, metrics, or traces specific to this slice's behavior.

**Omit when not applicable:**

- A backend-only migration slice does not need UI states.
- A CLI-only slice does not need HTTP API sections.
- A pure frontend slice may have no schema section.

### Examples By Slice Shape

**Cross-layer (FE + BE):**

```markdown
# Contracts: Admin configures approvers

## Interfaces

### API
- `GET /api/workflows/:id/approvers` — returns `{ approvers: Approver[] }`
- `PUT /api/workflows/:id/approvers` — body `{ approverIds: string[] }`

## Data
- `workflows.approver_ids` column (jsonb array); migration in T2

## State
- Workflow moves `draft` → `configured` when at least one approver is set

## Validation and errors
- 400 if `approverIds` empty
- 403 if caller lacks `workflow:configure` permission
- 404 if workflow not found

## UI states
- Loading: skeleton picker
- Empty: "No approvers configured" with add CTA
- Error: inline banner with retry
```

**Backend-only:**

```markdown
# Contracts: Rollup library derives slice status

## Interfaces
- `rollupSlice(slicePath: string): RollupResult` in `src/lib/sliceRollup.ts`
- `weave slice rollup [--slice <path>] [--all] [--check]` CLI entry

## Data
- Reads `<slice>/tasks.md`, writes `<slice>/status.yml` fields: `status`, `task_summary`, `updated_at`
- Reads all `<slice>/status.yml`, writes `task-slices/dependency-graph.md`

## State
- Slice `status` derivation: all tasks `done` → `done`; any `in_progress` or partial `done` → `in_progress`; else `pending`

## Validation and errors
- Defensive parse: if `tasks.md` sections are malformed, leave previous `task_summary` untouched
- Cycle in `depends_on`: write succeeds; graph shows WARNING banner
```

**Frontend-only:**

```markdown
# Contracts: Approver picker component

## Interfaces
- `<ApproverPicker workflowId={string} onChange={(ids) => void} />`

## State
- Local state: `selectedIds`, `searchQuery`, `isLoading`, `error`
- Controlled: parent owns persisted value via `onChange`

## UI states
- Loading, empty, filtered-empty, error, success (see slice.md acceptance criteria)

## Validation and errors
- Disable submit when zero approvers selected
```

### AFK Promotion Rule

`weave-slices` promotes a task to `Execution: afk` only when the task's implementable boundary is fully specified in `contracts.md` (not only in `slice.md`) and the work is mechanical translation into code. If the contract section for that task's layer is missing or ambiguous, leave `hitl`.

---

## Status Vocabularies (summary)

- **Slice `status`** (in `status.yml`): stored `pending | in_progress | done`. Rollup-derived.
- **Derived slice state** (in `dependency-graph.md` only): `ready | blocked`.
- **Task `Status:`** (in `tasks.md`): `todo | in_progress | done | not_tested | blocked | invalid`.

## Per-Task AFK / HITL Classification

`Execution: afk | hitl` on each task. Default `hitl`. `weave-slices` promotes to `afk` only when the task is fully spec'd in `contracts.md` and the work is mechanical.

- `afk` — `weave-execute` runs verification without pausing.
- `hitl` — `weave-execute` pauses at acceptance/verification checkpoints.

`weave-next` supports `/weave-next afk` to surface ready tasks marked `Execution: afk` across all ready slices.
