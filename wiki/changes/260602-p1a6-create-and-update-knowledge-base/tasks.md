---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-02T12:43:56.000Z
updated_at: 2026-06-02T13:01:00.000Z
source: architecture.md
---

# Tasks: Create And Update Knowledge Base

## Source Context

- PRD: `wiki/changes/260602-p1a6-create-and-update-knowledge-base/prd.md`
- Architecture: `wiki/changes/260602-p1a6-create-and-update-knowledge-base/architecture.md`
- Sessions: `wiki/changes/260602-p1a6-create-and-update-knowledge-base/sessions/20260602-180327-k4p9-architecture.md`
- Codebase: TypeScript CLI in `src/`, bundled skills in `templates/skills/`, installed skill copies in `.agents/skills/` and `.claude/skills/`, opencode wrappers in `templates/opencode/commands/`, tests in `tests/`
- External references: None
- Local references: None

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
| T1 | done | AFK | Scaffold Standard Knowledge Structure | None |
| T2 | done | AFK | Add Knowledge Lifecycle CLI | None |
| T3 | done | AFK | Mark Knowledge Stale From Lifecycle Changes | T2 |
| T4 | done | AFK | Ship `weave-knowledge` Skill | T1, T2 |
| T5 | done | AFK | Update Existing Skills And README For Knowledge | T1, T4 |
| T6 | done | AFK | End-To-End Verification Sweep | T1, T2, T3, T4, T5 |

## T1: Scaffold Standard Knowledge Structure

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 2, 3

### What to build

Extend the Weave scaffold so new and existing repos get the standard knowledge structure without overwriting user-authored files. The scaffold should create `wiki/knowledge/domains/`, `wiki/knowledge/shared/`, and README guidance files that explain domains, features, domain-wide behavior, shared behavior, and the progressive folder model.

Keep `.weave/sync.yml` tracking only `wiki/knowledge/index.md` in v1.

### Acceptance Criteria

- [x] `weave init` creates `wiki/knowledge/README.md`, `wiki/knowledge/domains/README.md`, `wiki/knowledge/shared/README.md`, `wiki/knowledge/domains/`, and `wiki/knowledge/shared/`.
- [x] Scaffolded README guidance names `domains`, `features`, `domain-wide`, and `shared`.
- [x] Scaffolded README guidance includes a sample folder tree and the guided template shapes or clear links to the skill guidance.
- [x] Re-running scaffold/init does not overwrite existing knowledge index, README, domain README, shared README, or sync files.
- [x] `.weave/sync.yml` remains limited to `knowledge.index` in v1.

### Verification

- Automated tests: `npm run test -- tests/init.test.ts` passed.
- Manual/smoke check: Run `npm run dev -- init --yes` in a temp repo and inspect the created `wiki/knowledge/**` structure.

## T2: Add Knowledge Lifecycle CLI

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 7, 9, 10

### What to build

Add typed knowledge lifecycle metadata to change summaries and expose `weave change knowledge <status>` as the CLI-owned status update path. The command should support `pending`, `stale`, `updated`, and `none`, plus routing/provenance flags for domains, shared behavior areas, files, delta path, reason, invalidation source, target, and JSON output.

The command must update only `status.yml.knowledge`; it must not move the lifecycle stage or require skills to hand-edit status files.

### Acceptance Criteria

- [x] `ChangeSummary` JSON includes parsed `knowledge` metadata when present.
- [x] Missing or malformed `status.yml.knowledge` does not break change status reads.
- [x] `weave change knowledge <status>` supports `pending`, `stale`, `updated`, and `none`.
- [x] Repeatable `--domain`, `--shared`, and `--file` flags are deduped and persisted.
- [x] `--delta`, `--reason`, and `--invalidated-by` are persisted when provided.
- [x] `updated` and `none` clear stale invalidation fields.
- [x] Human `weave change status` output includes concise knowledge status when present.
- [x] Unsupported statuses or invalidation sources return existing structured CLI errors.

### Verification

- Automated tests: `npm run test -- tests/changes.test.ts tests/cli-skills.test.ts` passed.
- Manual/smoke check: Run `npm run dev -- change knowledge updated --domain performance-reviews --file wiki/knowledge/domains/performance-reviews/index.md --reason "Updated knowledge" --json` on a temp active change and inspect `status.yml`.

## T3: Mark Knowledge Stale From Lifecycle Changes

Status: done

Type: AFK

Blocked by: T2

User stories covered: 7, 8

### What to build

Update lifecycle progress so artifact changes invalidate previously resolved knowledge. When `weave change progress <lane>` runs and current knowledge status is `updated` or `none`, mark knowledge `stale` with `invalidated_by: <lane>`, `invalidated_at`, and an explanatory reason. Leave existing `pending` or `stale` knowledge unchanged.

### Acceptance Criteria

- [x] Progressing `exploration`, `prd`, `architecture`, or `issues` after `knowledge.status: updated` marks knowledge stale.
- [x] Progressing a lane after `knowledge.status: none` marks knowledge stale.
- [x] Progressing a lane when knowledge is already `pending` or `stale` does not overwrite useful existing knowledge metadata unnecessarily.
- [x] Stale knowledge metadata preserves affected domains, shared areas, files, and delta when no replacement flags are involved.
- [x] `weave-next` can rely on stored stale knowledge metadata after lifecycle progress.

### Verification

- Automated tests: `npm run test -- tests/changes.test.ts` passed.
- Manual/smoke check: Mark a temp change `knowledge updated`, run `weave change progress prd --source exploration --json`, and confirm knowledge becomes stale in `status.yml`.

## T4: Ship `weave-knowledge` Skill

Status: done

Type: AFK

Blocked by: T1, T2

User stories covered: 4, 5, 6, 9

### What to build

Add a bundled `weave-knowledge` skill that manually updates current-state knowledge and change-local knowledge delta files. The skill should resolve the active change, inspect artifacts and relevant knowledge, create or update `knowledge-delta.md`, create missing standard knowledge files when needed, avoid reorganizing user-authored knowledge without approval, and call `weave change knowledge`.

Ship the skill through all existing skill packaging surfaces, including templates, installed repo copies, Claude copies, and opencode command wrappers.

### Acceptance Criteria

- [x] `templates/skills/weave-knowledge/SKILL.md` exists with correct frontmatter and behavior contract.
- [x] `.agents/skills/weave-knowledge/SKILL.md` and `.claude/skills/weave-knowledge/SKILL.md` match the template.
- [x] `templates/opencode/commands/weave-knowledge.md` delegates to the skill and passes context arguments.
- [x] Skill guidance defines `behavior.md`, `decision-tables.md`, `source-map.md`, and `knowledge-delta.md` templates.
- [x] Skill guidance strongly recommends `Purpose`, `Current Behavior`, `Source Anchors`, and `Change History` for behavior specs.
- [x] Skill guidance covers no active change, ambiguous target, no-impact rationale, missing standard file creation, and no silent reorganization.
- [x] Skill install/list/show tests include `weave-knowledge`.

### Verification

- Automated tests: `npm run test -- tests/agent-skills.test.ts tests/cli-skills.test.ts` passed.
- Manual/smoke check: Run `npm run dev -- skill show weave-knowledge` and inspect the printed contract.

## T5: Update Existing Skills And README For Knowledge

Status: done

Type: AFK

Blocked by: T1, T4

User stories covered: 1, 2, 8

### What to build

Update existing skill guidance and docs to use the new knowledge structure. `weave-next` should report knowledge freshness and recommend `weave-knowledge` when knowledge is pending, stored stale, or effectively stale. Product and architecture skills should read the new `domains/**`, `domain-wide/**`, `shared/**`, and `source-map.md` locations instead of the old shallow context paths.

README should document the new skill, invocation examples, knowledge lifecycle command, and scaffold conventions.

### Acceptance Criteria

- [x] `weave-next` guidance remains read-only and includes knowledge status/freshness recommendation rules.
- [x] Existing skills reference the new knowledge paths and no longer depend on only `wiki/knowledge/*/context.md`.
- [x] README skill list and invocation examples include `weave-knowledge`.
- [x] README documents `weave change knowledge <status>` and its flags.
- [x] README describes the standard knowledge structure and v1 no-validation stance.
- [x] Skill contract tests cover the updated guidance.

### Verification

- Automated tests: `npm run test -- tests/agent-skills.test.ts tests/cli-skills.test.ts` passed.
- Manual/smoke check: Run `npm run dev -- skills list` and confirm `weave-knowledge` appears with the expected description.

## T6: End-To-End Verification Sweep

Status: done

Type: AFK

Blocked by: T1, T2, T3, T4, T5

User stories covered: All

### What to build

Run the full project verification suite after all implementation slices are complete. Fix integration issues across scaffold behavior, lifecycle status output, command wiring, skill packaging, installed skill copies, docs, and tests.

### Acceptance Criteria

- [x] `npm run typecheck` passes.
- [x] `npm run build` passes.
- [x] `npm run test` passes.
- [x] No generated task remains unverified solely because tests were skipped.
- [x] `weave change status --json` on the active change remains valid after issues progress.

### Verification

- Automated tests: `npm run typecheck`, `npm run build`, `npm run test` passed.
- Manual/smoke check: Inspect `wiki/changes/260602-p1a6-create-and-update-knowledge-base/status.yml` and confirm lifecycle metadata remains coherent.

## Invalid Tasks

None.

## Verification

Passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`
