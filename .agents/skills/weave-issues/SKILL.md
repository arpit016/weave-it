---
name: weave-issues
description: Break an architecture, implementation plan, spec, PRD, or referenced context into local implementation tasks in tasks.md using tracer-bullet vertical slices.
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

For a Weave change, prefer durable change artifacts before drafting tasks:

- Read `wiki/changes/<change-id>/prd.md` as the product contract when present.
- Read `wiki/changes/<change-id>/architecture.md` as the engineering design when present.
- Read `wiki/changes/<change-id>/status.yml` when present to check stale lifecycle state.
- Read existing `wiki/changes/<change-id>/tasks.md` when present so reruns can reconcile instead of replacing blindly.
- If both PRD and architecture exist, use `prd.md` for user behavior and acceptance, and `architecture.md` for technical sequencing, affected systems, risks, rollout, observability, and testing strategy.
- If `status.yml.stale.architecture` exists, warn that architecture is stale from its recorded sources and ask for explicit confirmation before creating or reconciling tasks. If the user does not explicitly confirm, stop and recommend `weave-architect`.
- Do not assume architecture is stale merely because `prd.md` changed; rely on source-aware stale state in `status.yml`.

Task generation may use any sufficiently concrete plan or context, including PRD, architecture, implementation plan, spec, sessions, discussion, codebase findings, local paths, or external issue references.

### 2. Explore The Codebase

Explore the codebase enough to understand current implementation conventions before drafting tasks. Issue titles and task descriptions should use the project's domain glossary vocabulary and respect ADRs in the area being touched.

Also inspect testing conventions:

- package scripts or documented test commands
- test directories and file naming
- existing test helpers or fixtures
- manual, smoke, or build verification conventions

If a usable automated test base exists, code-affecting tasks should include relevant automated test expectations and verification commands. If no usable automated test base exists, missing tests should not block task generation by itself; include explicit manual or smoke verification expectations instead.

Do not require strict test-first TDD wording. Preserve vertical-slice completeness by making each task verifiable in the way that fits the repo.

### 3. Draft Vertical-Slice Tasks

Break the plan into **tracer bullet** tasks. Each task is a thin vertical slice that cuts through all relevant integration layers end-to-end, not a horizontal slice of one layer.

Slices may be `HITL` or `AFK`. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but complete path through the relevant layers.
- Each slice is demoable or verifiable on its own.
- Prefer many thin slices over a few thick ones.
- Include automated test expectations when a usable test base exists.
- Include manual or smoke verification when automated tests are unavailable.
</vertical-slice-rules>

Generated tasks start as `todo` unless a real blocker is already known. Do not assign `not_tested` during task generation; implementers apply `not_tested` later if implementation appears complete but automated verification could not be completed.

### 4. Quiz The User

Present the proposed breakdown as a numbered list before writing `tasks.md`. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices, if any, must complete first
- **User stories covered**: which user stories this addresses, if the source material has them

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Write Or Reconcile Local `tasks.md`

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

| ID | Status | Type | Title | Blocked by |
| --- | --- | --- | --- | --- |
| T1 | todo | AFK | <title> | None |

## T1: <Title>

Status: todo

Type: AFK

Blocked by: None - can start immediately

User stories covered: <ids or None>

### What to build

Describe the end-to-end behavior for this vertical slice. Avoid layer-by-layer implementation unless the source material requires it.

### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Verification

- Automated tests: <command and expectation, or "not available; no usable test base found">
- Manual/smoke check: <expected check when relevant>

## Invalid Tasks

None.

## Verification

Not run yet.
</tasks-template>

### 6. Record Lifecycle Progress

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
