---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-03T20:58:41.169Z
updated_at: 2026-06-03T20:58:41.169Z
source: architecture.md
---

# Tasks: Fix Change Progress Qf Bug

## Source Context

- Architecture: `wiki/changes/260604-68e6-fix-change-progress-qf-bug/architecture.md`
- Sessions: `wiki/changes/260604-68e6-fix-change-progress-qf-bug/sessions/20260604-022130-hss4-architecture.md`
- Codebase: `src/commands/change.ts`, `src/lib/changes.ts`, `templates/skills/weave-new/SKILL.md`, `tests/changes.test.ts`, `tests/cli-change-staleness.test.ts`, `tests/agent-skills.test.ts`
- Prior decision: `wiki/changes/260602-of9s-add-ability-to-bug-fix/prd.md` (non-feature changes start at `stage: started` without `exploration.md`)

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
| T1 | done | AFK | Fix `weave change progress` Commander flag collision | None |
| T2 | done | AFK | Non-feature changes start at `stage: started` with no `exploration.md` | None |
| T3 | done | AFK | Update `weave-new` skill text and propagate byte-identical copies | T2 |

## T1: Fix `weave change progress` Commander flag collision

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: None (defect fix)

Origin: none

Related finding: none

### What to build

Fix the `raw.trim is not a function` crash that breaks every `weave change progress` invocation. The root cause is in `src/commands/change.ts`: the `progress` subcommand declares both `--no-invalidate` (negatable) and `--invalidate <lanes>` (string), which Commander merges onto a single `invalidate` attribute. The negatable flag defaults `options.invalidate` to boolean `true` and never populates `options.noInvalidate`, so `parseInvalidateList(options.invalidate)` runs `.trim()` on a boolean.

Implement entirely within `src/commands/change.ts`:

- Update the `ChangeProgressOptions` interface: remove `noInvalidate?: boolean`, and type `invalidate?: string | boolean` (Commander stores `true` by default, `false` for `--no-invalidate`, or the lane string for `--invalidate <lanes>`).
- In the `progress` subcommand action, derive both lever values from the merged attribute:
  - `noInvalidate: options.invalidate === false`
  - `invalidateOnly: typeof options.invalidate === "string" ? parseInvalidateList(options.invalidate) : undefined`
- Keep both public flag declarations (`--no-invalidate`, `--invalidate <lanes>`) and their help text unchanged.

Do not change `progressChange` or `resolveStalePropagationTargets` in `src/lib/changes.ts`; mutual-exclusivity and lane validation already live there and stay correct.

### Acceptance Criteria

- [ ] `npm run dev -- change progress <lane> --source <list> --json` advances the lane and exits 0 (no `raw.trim` error) on the default path.
- [ ] `--no-invalidate` suppresses downstream stale propagation (maps to `noInvalidate: true`).
- [ ] `--invalidate <lanes>` marks only the named subset stale (maps to a parsed `invalidateOnly` array).
- [ ] Passing no invalidate flags yields the pessimistic default (`noInvalidate: false`, `invalidateOnly: undefined`).
- [ ] A CLI-level regression test exercises the Commander wiring (see Verification) and fails against the pre-fix code.
- [ ] Public flag names and help text are unchanged.

### Verification

- Automated tests: add a CLI-level test (e.g. `tests/cli-change-progress.test.ts`) that builds `changeCommand()` and calls `parseAsync(["progress", "<lane>", "--source", "...", "--json"], { from: "user" })` against a seeded temp change, asserting it does not throw `raw.trim is not a function` and that the resulting `status.yml` advanced. Cover three cases: default, `--no-invalidate`, and `--invalidate <lane>`. Run with `npm run test`.
- Manual/smoke check: `npm run dev -- change progress architecture --source codebase --source discussion --json` against this change (`260604-68e6...`) succeeds and records the `architecture` lane; also `npm run typecheck` and `npm run build`.

## T2: Non-feature changes start at `stage: started` with no `exploration.md`

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: None (implements the `260602-of9s` PRD decision; defect fix)

Origin: none

Related finding: none

### What to build

Make `weave change new --type <non-feat>` create only `status.yml` + `sessions/` and start at `stage: started`, per the bug-fix PRD. `feat` changes keep scaffolding `exploration.md` at `stage: exploration`. `started` is a stored stage that is NOT an artifact lane (`changeStages` stays the four lanes), so staleness/dependency logic is untouched.

Implement in `src/lib/changes.ts`:

- Introduce a stored-stage type without extending `changeStages`: e.g. `export const storedStages = ["started", ...changeStages] as const;` and `export type StoredChangeStage = "started" | ChangeStage;`, plus `export function isStoredChangeStage(value: unknown): value is StoredChangeStage`.
- Widen the `stage` field type from `ChangeStage` to `StoredChangeStage` on the metadata interfaces that carry it (around lines 107, 230, 301) and any `ChangeSummary`/result type that surfaces `stage`.
- `createChange` (lines 326-335): write `exploration.md` only when `type === "feat"`. Always write `status.yml` and create the `sessions/` directory.
- `statusTemplate` (lines 1420-1432): set `stage: input.type === "feat" ? "exploration" : "started"`.
- `readChangeMetadata` (line 912): accept `started` — `isStoredChangeStage(parsed?.stage) ? parsed.stage : "exploration"` (keep the `exploration` fallback for unknown values).
- `maxStage`/`stageIndex` (lines 1767-1773): accept a `StoredChangeStage[]` input. `stageIndex("started")` returns -1 (not in `changeStages`), so any real lane wins on progress and the `"exploration"` seed keeps progressed stages at their real lane. Ensure the return type stays `ChangeStage`.
- Verify no other consumer assumes `stage` is always one of the four lanes (e.g. display/formatting just prints `change.stage`, which is fine).

### Acceptance Criteria

- [ ] `change new --type fix` (and other non-feat types) creates `status.yml` and `sessions/` but NOT `exploration.md`.
- [ ] Non-feature changes have `status.yml.stage === "started"`.
- [ ] `change new --type feat` (and the default) still scaffolds `exploration.md` at `stage: exploration`.
- [ ] `readChangeMetadata` returns `stage: "started"` for a non-feature change instead of coercing to `exploration`.
- [ ] Progressing a `started` change to a real lane (e.g. `architecture`) sets `stage` to that lane (no regression below the progressed lane).
- [ ] `npm run typecheck` passes with the widened `stage` types.

### Verification

- Automated tests: add a `tests/changes.test.ts` case asserting `createChange({ type: "fix" })` does not create `exploration.md` (e.g. `stat(...exploration.md)` rejects) and `status.yml.stage === "started"`. Keep the existing default/feat cases (around lines 47-70, 128-139) green. Run `npm run test`.
- Manual/smoke check: `npm run dev -- change new "tmp fix" --type fix` then inspect the folder and `status.yml`; clean up the temp change afterward. Also `npm run build`.

## T3: Update `weave-new` skill text and propagate byte-identical copies

Status: done

Type: AFK

Blocked by: T2

User stories covered: None (guidance/visibility)

Origin: none

Related finding: none

### What to build

Align the `weave-new` skill guidance with the T2 behavior so agents do not assume `exploration.md` is always the first artifact.

- Edit the canonical `templates/skills/weave-new/SKILL.md`:
  - Replace the unconditional "Treat `exploration.md` as the first artifact." (line 43) with feature-specific guidance: for `feat`, `exploration.md` is the first artifact; for non-feature types the change starts at `stage: started` with only `status.yml` + `sessions/`, and the first real artifact is created later by the fitting skill (`weave-architect`, `weave-issues`, or `weave-prd`).
  - Keep the existing "Do not create `prd.md`." rule and the plan-mode/notice sections intact.
- Propagate byte-identical copies to the installed agent directories via the existing CLI (do not hand-edit copies): `npm run dev -- agent reset all weave-new` (or the documented equivalent), refreshing `.weave/agents.yml` hashes for `.agents/skills/weave-new/SKILL.md`, `.claude/skills/weave-new/SKILL.md`, and the `.opencode/commands/weave-new.md` wrapper as applicable.

### Acceptance Criteria

- [ ] `templates/skills/weave-new/SKILL.md` documents feature vs non-feature scaffolding and the `stage: started` start for non-feature changes.
- [ ] Installed copies (`.agents`, `.claude`, opencode wrapper) are byte-identical to the template.
- [ ] `.weave/agents.yml` `weave-new` hashes match the new template content.
- [ ] `npm run dev -- agent diff all weave-new` reports no differences.

### Verification

- Automated tests: `npm run test` (the byte-identity assertions in `tests/agent-skills.test.ts` cover the installed copies once propagation runs).
- Manual/smoke check: re-read the updated template section and confirm `agent diff` is clean.

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

- [x] `npm run typecheck`
- [x] `npm run test` (130 tests passed, including the new `tests/cli-change-progress.test.ts` CLI wiring cases and the `--type fix` scaffolding cases)
- [x] `npm run build`
- [x] `npm run dev -- agent diff all weave-new` reports no differences
- [x] Manual smoke: `npm run dev -- change progress architecture/issues --source ... --json` succeeds (this change advanced to `stage: issues`)
