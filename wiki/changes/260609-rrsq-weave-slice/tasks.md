---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-09T18:45:00.000Z
updated_at: 2026-06-09T18:45:00.000Z
source: architecture
---

# Tasks: Weave Slice

## Source Context

- PRD: absent (architecture-only meta-change)
- Architecture: `wiki/changes/260609-rrsq-weave-slice/architecture/index.md`, `architecture/slice-model.md`, `architecture/rollup-library.md`, `architecture/skill-ecosystem.md`
- Sessions: `wiki/changes/260609-rrsq-weave-slice/sessions/20260609-144437-s7k2-architecture.md`, `20260609-162459-9a3k-architecture.md`, `20260609-174155-b5q2-architecture.md`
- Codebase: `src/commands/change.ts`, `src/lib/changes.ts`, `src/lib/agent-skills.ts`, `templates/skills/`, `.claude/skills/`
- Implementation plan: `/Users/arpit/.cursor/plans/task-slices_model_c219422f.plan.md`

## Local Tracking Status

External issue publishing status: not used. This change tracks implementation locally in this file.

This meta-change intentionally uses flat `tasks.md` (legacy mode) while implementing the slice model for all future changes.

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
| T1 | done | AFK | full-stack | weave-it | weave-it | Findings lane plumbing (CLI + supporting skills) | None |
| T2 | done | AFK | full-stack | weave-it | weave-it | Slice-model and skill templates | None |
| T3 | done | AFK | full-stack | weave-it | weave-it | Rollup library + `weave slice rollup` CLI | None |
| T4 | done | AFK | full-stack | weave-it | weave-it | `weave-fix` skill (bug-fix entry point) | T1, T2, T3 |
| T5 | done | AFK | full-stack | weave-it | weave-it | `weave-slices` hard rename + full rewrite | T1, T2, T3 |
| T6 | done | AFK | full-stack | weave-it | weave-it | Slice-aware `weave-execute` + `weave-next` | T3, T5 |
| T7 | done | AFK | full-stack | weave-it | weave-it | Deprecate `weave-prepare` | T6 |
| T8 | done | AFK | full-stack | weave-it | weave-it | Knowledge doc for task-slices behavior | T6 |

## Coverage Review

- **PRD coverage:** PRD absent. Architecture is the sole product/engineering contract for this meta-change. N/A.
- **Architecture coverage (index.md):** T1–T8 collectively implement all decision-summary bullets: slice model (T2, T5), rollup library (T3, wired in T4–T6), skill ecosystem (T1, T4–T7), dual-mode compatibility (T6), findings lane (T1, T4), hard rename issues→slices (T5), deprecate weave-prepare (T7).
- **Architecture coverage (slice-model.md):** T2 templates encode slice folder layout, per-slice `status.yml`, slice-level `tasks.md` shape, `contracts.md` as slice-level technical contracts (not FE/BE-only), `dependency-graph.md` structure. T5 generates slices conforming to this spec.
- **Architecture coverage (rollup-library.md):** T3 implements writer-derives rollup (no editor hooks), batched episode boundaries, defensive parser, cycle detection, `--check` mode. T4/T5/T6 wire call sites.
- **Architecture coverage (skill-ecosystem.md):** T1 findings lane; T4 weave-fix workflow; T5 weave-slices generation rules + `issues`→`slices` lane rename; T6 slice-mode execute/next + flat-mode preservation; T7 weave-prepare deprecation.
- **PRD/Architecture sync:** N/A (no PRD).
- **Out of scope (deferred):** MCP-via-agent external tracker integration (`followup-mcp-integration` in plan). Pre-commit hook installer (v1 skipped per architecture).

## T1: Findings lane plumbing (CLI + supporting skills)

Status: done

Type: AFK

Scope: full-stack

Primary repo: weave-it

Repos: weave-it

Architecture refs: `architecture/skill-ecosystem.md` (Lifecycle Frontmatter), `architecture/index.md`

Coordination: none

Blocked by: None - can start immediately

User stories covered: None

Origin: none

Related finding: none

### What to build

Add `findings` as a first-class lifecycle lane end-to-end so `--type fix` changes can progress through `findings.md` the same way feat changes progress through `exploration.md` / `prd.md`.

Deliverables:

- Extend `weave change progress` CLI to accept `findings` lane with sources `discussion`, `codebase` (and any other supported source IDs that apply).
- Update `src/lib/changes.ts` stage/source definitions as needed.
- Update `weave-clarify` skill (templates + installed) to support `findings` lane.
- Update `weave-capture` skill to support `findings` lane and `sessions/*-findings.md` notes.
- Update `weave-architect` skill to accept `findings.md` as upstream source for fix-type changes.
- Add/adjust vitest coverage for new lane in change progress tests.

### Repo Involvement

| Repo | Scope | Role | Likely code anchors | Test/verification anchors |
| --- | --- | --- | --- | --- |
| weave-it | full-stack | CLI + skill templates | `src/commands/change.ts`, `src/lib/changes.ts`, `templates/skills/weave-clarify/`, `templates/skills/weave-capture/`, `templates/skills/weave-architect/` | `tests/` change progress tests; `npm test` |

### Acceptance Criteria

- [x] `weave change progress findings --source discussion --json` succeeds on a fix-type change with `findings.md`
- [x] `weave-clarify findings`, `weave-capture findings`, and `weave-architect` (fix-type) document the findings lane in their SKILL.md
- [x] Unsupported lane names fail with a clear error (no silent fallback to `issues`)

### Verification

- `npm test` — 205 passed (includes change progress / lane parsing / agent-skills)
- `npm run typecheck` — passed

## T2: Slice-model and skill templates

Status: done

Type: AFK

Scope: full-stack

Primary repo: weave-it

Repos: weave-it

Architecture refs: `architecture/slice-model.md`, `architecture/rollup-library.md`

Coordination: none

Blocked by: None - can start immediately

User stories covered: None

Origin: none

Related finding: none

### What to build

Author canonical template files that `weave-slices` and `weave-fix` will use when scaffolding slice folders. Pure markdown/yaml templates — no runtime behavior in this task.

Deliverables under `templates/skills/`:

- `weave-fix/findings-template.md` — Summary (required), Repro, Scope & Impact, Root cause, Related sections.
- `weave-slices/slice-template.md` — Outcome, User flow, In scope, Out of scope, Acceptance criteria.
- `weave-slices/contracts-template.md` — slice-level technical contracts with adaptive sections (Interfaces, Data, State, Validation and errors; optional API, UI states, Events, Files). Not FE/BE-only.
- `weave-slices/tasks-template.md` — slice-level `tasks.md` with repo headings, per-task fields (`Repos:`, `Execution:`, `Files:`, `Blocked by:`), QA Findings, Refactors.
- `weave-slices/status-template.yml` — per-slice `status.yml` scaffold (`id`, `title`, `status`, `owner`, `repos`, `depends_on`, `task_summary`).
- `weave-slices/dependency-graph-template.md` — banner + Purpose, Graph, Slice dependencies table, Ready, Blocked, Critical path, Parallel work sections.

SKILL.md placeholders for `weave-fix` and `weave-slices` are acceptable here; full skill logic lands in T4 and T5.

### Acceptance Criteria

- [x] All six template files exist and match field names / section order documented in `architecture/slice-model.md`
- [x] `contracts-template.md` uses "slice-level technical contracts" framing, not "FE/BE handshake"
- [x] `tasks-template.md` uses `Execution: afk | hitl` (not legacy `Type: HITL | AFK`)
- [x] `dependency-graph-template.md` includes cycle-warning placeholder section

### Verification

- Templates authored under `templates/skills/weave-fix/` and `templates/skills/weave-slices/`
- `npm test` — agent-skills install/resource checks passed

## T3: Rollup library + `weave slice rollup` CLI

Status: done

Type: AFK

Scope: full-stack

Primary repo: weave-it

Repos: weave-it

Architecture refs: `architecture/rollup-library.md`, `architecture/slice-model.md` (status derivation, dependency-graph structure)

Coordination: Writer wiring into skills lands in T4, T5, T6 — this task ships the library and CLI only.

Blocked by: None - can start immediately

User stories covered: None

Origin: none

Related finding: none

### What to build

Implement harness-agnostic derived-state rollup as a shared library + CLI. No editor PostToolUse hooks.

Deliverables:

- `src/lib/sliceRollup.ts` — defensive parse of `<slice>/tasks.md`; rewrite `task_summary`; derive slice `status`; regenerate `task-slices/dependency-graph.md` from all slice `status.yml` files (when slice count >= 2); cycle detection with WARNING banner; `git add` derived files.
- `weave slice rollup` CLI subcommand with `--slice <path>`, `--all` (default), `--check` flags.
- Register command in `src/cli.ts`.
- Vitest coverage: parser, status derivation, graph generation, cycle detection, defensive partial-write behavior, `--check` exit code.

### Acceptance Criteria

- [x] Given a slice folder with `tasks.md` and `status.yml`, rollup produces correct `task_summary` and `status`
- [x] Given two or more slices with `depends_on`, rollup generates `dependency-graph.md` matching section order in `architecture/slice-model.md`
- [x] Cycle in `depends_on` produces WARNING banner; primary files still write successfully
- [x] Malformed partial `tasks.md` does not overwrite valid existing `task_summary` (defensive parser)
- [x] `weave slice rollup --check` exits non-zero when derived files would change

### Verification

- `tests/slice-rollup.test.ts` — passed
- `npm test` — full suite passed

## T4: `weave-fix` skill (bug-fix entry point)

Status: done

Type: AFK

Scope: full-stack

Primary repo: weave-it

Repos: weave-it

Architecture refs: `architecture/skill-ecosystem.md` (Bug-Fix Workflow), `architecture/slice-model.md`

Coordination: Calls rollup library (T3) after scaffolding. Uses findings lane (T1) for lifecycle progress.

Blocked by: T1, T2, T3

User stories covered: None

Origin: none

Related finding: none

### What to build

Chat-driven bug-fix entry point. Full `templates/skills/weave-fix/SKILL.md` + installed `.claude/skills/weave-fix/SKILL.md`.

Single-turn flow:

1. Derive slug from chat description.
2. `weave new --type fix <slug>`.
3. Write `findings.md` from `findings-template.md` (Summary minimum).
4. Scaffold `task-slices/01-<slug>/` with `tasks.md` + `status.yml` (skip `slice.md` / `contracts.md` for trivial fixes).
5. Call rollup library for the new slice.
6. Run `weave change progress findings --source discussion --json`.
7. Report next step.

Re-invocation updates `findings.md` with new context without re-scaffolding unless slice folder is missing.

### Acceptance Criteria

- [x] Invoking `/weave-fix` with a bug description creates a fix-type change with `findings.md` and `task-slices/01-<slug>/`
- [x] `findings.md` always created (even for trivial bugs); Summary section populated at minimum
- [x] Slice `status.yml` has correct scaffold fields; rollup runs after scaffold
- [x] Skill installed via `templates/skills/weave-fix/` and matches bundled template conventions

### Verification

- `templates/skills/weave-fix/SKILL.md` + `findings-template.md` shipped; agent-skills tests passed

## T5: `weave-slices` hard rename + full rewrite

Status: done

Type: AFK

Scope: full-stack

Primary repo: weave-it

Repos: weave-it

Architecture refs: `architecture/skill-ecosystem.md`, `architecture/slice-model.md`, `architecture/index.md`

Coordination: Renames `weave-issues` → `weave-slices` in templates and `.claude/skills/`. Renames CLI lane `issues` → `slices`. Deletes old `weave-issues` folders.

Blocked by: T1, T2, T3

User stories covered: None

Origin: none

Related finding: none

### What to build

Replace `weave-issues` entirely with `weave-slices` for the slice-folder model.

Deliverables:

- Rename `templates/skills/weave-issues/` → `templates/skills/weave-slices/`; rewrite SKILL.md for slice-folder generation.
- Rename `.claude/skills/weave-issues/` → `.claude/skills/weave-slices/`; same rewrite.
- Update `src/lib/changes.ts` and `src/commands/change.ts`: lane `issues` → `slices`; `weave change progress slices`.
- Generation behavior: read upstream per change type (feat: prd + architecture; fix: findings + optional architecture; chore/refactor: exploration + optional architecture); scaffold `task-slices/<NN>-<slug>/` with templates from T2; atomic ID allocation; explicit `Repos:` per task; `Execution:` default `hitl`; blank `Owner:`; populate `depends_on` from architecture cues; idempotent re-run for scope expansion.
- Populate `contracts.md` using slice-level technical contracts template (adaptive sections per slice shape).
- Call rollup library after scaffolding.
- Update `src/lib/agent-skills.ts`, opencode commands, `.weave/agents.yml` references, skill template checks, and any docs referencing `weave-issues`.
- Update tests referencing `issues` lane.

### Acceptance Criteria

- [x] `weave-issues` skill path no longer exists; `weave-slices` is installable via `weave agent update`
- [x] `weave change progress slices --source architecture --json` succeeds
- [x] Running `/weave-slices` on a feat change with architecture scaffolds `task-slices/<NN>-<slug>/` folders matching `slice-model.md`
- [x] Idempotent re-run proposes additive expansion without moving `in_progress` or `done` tasks
- [x] `contracts.md` generated with technical-contracts sections (not hardcoded FE/BE-only)

### Verification

- `issues` → `slices` lane rename in `src/lib/changes.ts` + `src/commands/change.ts` with legacy `issues` alias
- `weave-issues` removed; `weave-slices` + opencode command shipped; `npm test` passed

## T6: Slice-aware `weave-execute` + `weave-next`

Status: done

Type: AFK

Scope: full-stack

Primary repo: weave-it

Repos: weave-it

Architecture refs: `architecture/skill-ecosystem.md` (Slice-Aware Skill Behavior, Backwards Compatibility), `architecture/rollup-library.md` (episode boundaries)

Coordination: Absorbs branch-prep from deprecated `weave-prepare`. Wires rollup library at episode boundaries.

Blocked by: T3, T5

User stories covered: None

Origin: none

Related finding: none

### What to build

Update `weave-execute` and `weave-next` for dual-mode dispatch. Slice mode when `task-slices/` exists; flat mode when only change-root `tasks.md` exists (preserves this meta-change and all legacy changes).

**weave-execute (slice mode):**

- Accept `<slice-id> <task-id>` selector.
- Read slice's `tasks.md`; enforce within-slice-only `Blocked by:` deps.
- Absorb `weave-prepare` branch-prep: ensure change branch checked out in repos from task `Repos:`; call existing `weave task prepare` CLI internally.
- Branch on `Execution:` field — `afk` runs autonomously; `hitl` pauses at checkpoints.
- Call rollup library at episode boundaries (end, HITL pause, error exit).

**weave-next (slice mode):**

- Walk `task-slices/*/status.yml`; compute ready set from `depends_on` + slice status.
- Suggest next slice + task; bias toward critical-path slices.
- Add `/weave-next afk` filter for `Execution: afk` tasks across ready slices.

**Flat mode:** today's behavior unchanged for both skills.

### Acceptance Criteria

- [x] `/weave-execute 01 T1` on a slice-mode change reads the correct slice `tasks.md` and runs prepare + implementation
- [x] `/weave-next` on a slice-mode change suggests a ready slice/task with critical-path bias
- [x] `/weave-next afk` returns only `Execution: afk` tasks in ready slices
- [x] Flat-mode change with only `tasks.md` still works with legacy selectors (`T#`, `all`)
- [x] Rollup runs at weave-execute episode boundaries (verify `status.yml` / `dependency-graph.md` update)

### Verification

- Dual-mode dispatch documented in `templates/skills/weave-execute/SKILL.md` and `weave-next/SKILL.md`
- `npm test` passed

## T7: Deprecate `weave-prepare`

Status: done

Type: AFK

Scope: full-stack

Primary repo: weave-it

Repos: weave-it

Architecture refs: `architecture/skill-ecosystem.md`, `architecture/index.md`

Coordination: T6 must absorb branch-prep before this ships.

Blocked by: T6

User stories covered: None

Origin: none

Related finding: none

### What to build

Add deprecation banner to `weave-prepare` SKILL.md in both `templates/skills/weave-prepare/` and `.claude/skills/weave-prepare/`. Banner points users to `/weave-execute` for combined branch + execute flow. Do not delete the skill file yet (remove after one release cycle).

### Acceptance Criteria

- [x] Deprecation banner present at top of both template and installed `weave-prepare/SKILL.md`
- [x] Banner references `/weave-execute` as the replacement entry point
- [x] Skill still installable (not deleted)

### Verification

- Banner added to `templates/skills/weave-prepare/SKILL.md` and synced to `.claude/skills/`

## T8: Knowledge doc for task-slices behavior

Status: done

Type: AFK

Scope: full-stack

Primary repo: weave-it

Repos: weave-it

Architecture refs: `architecture/index.md`, all facets; `templates/skills/weave-knowledge/knowledge-templates.md`

Coordination: Documents shipped behavior from T1–T7, not aspirational design.

Blocked by: T6

User stories covered: None

Origin: none

Related finding: none

### What to build

Author `wiki/knowledge/domains/change-workflow/features/task-slices/behavior.md` using knowledge templates.

Cover:

- Multi-engineer collaboration model and residual git conflict cost
- Slice vs task vocabulary (vertical vs horizontal)
- Stored vs derived status vocabulary (`pending`/`in_progress`/`done` vs `ready`/`blocked`)
- Per-task `Execution: afk | hitl` semantics
- `contracts.md` as slice-level technical contracts (not FE/BE-only)
- Bug-fix workflow (`weave-fix` + `findings.md` + scope-growth via idempotent `weave-slices`)
- Writer-derives rollup library responsibilities (`sliceRollup.ts` + `weave slice rollup` CLI; no editor hooks)
- Dual-mode backwards compatibility

### Acceptance Criteria

- [x] Knowledge doc exists at the specified path
- [x] Doc matches implemented behavior (post T6), not pre-implementation assumptions
- [x] Cross-references architecture facets where useful

### Verification

- `wiki/knowledge/domains/change-workflow/features/task-slices/behavior.md` authored

## QA Findings

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Invalid Tasks

None.

## Verification

- `npm test` — 205 passed
- `npm run typecheck` — passed
