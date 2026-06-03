---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-06-03T20:51:30.027Z
updated_at: 2026-06-03T20:51:30.027Z
reviewed_at: null
approved_at: null
approved_by: null
source: codebase
---

# Fix Change Progress + Fix-Type Scaffold - RCA and Fix Strategy

## Summary

Two independent CLI defects in the `weave change` command surface:

1. `weave change progress <lane>` crashes on every invocation with `raw.trim is not a function`, blocking all lifecycle progression via the CLI.
2. `weave change new --type <non-feat>` scaffolds `exploration.md` and starts at `stage: exploration`, contradicting the already-decided bug-fix workflow where non-feature changes start at `stage: started` with no `exploration.md`.

Both are fixed in `src/commands/change.ts` and `src/lib/changes.ts`, with a skill-text update for `weave-new` and added test coverage. No new artifact type, lifecycle lane, or external dependency is required.

## Bug 1: `weave change progress` crashes with `raw.trim is not a function`

### Bug Context

Reported during an artifact capture: `weave change progress prd --source exploration --source sessions --json` exits 1 with `{"status":"error","code":"unknown_error","message":"raw.trim is not a function"}`. The same failure is recorded in `wiki/changes/260604-jrqg-publish-v1-to-npm-registry/tasks.md`. Effect: lifecycle stage cannot advance via the CLI in this repo.

### Observed Behavior

Every `weave change progress` call fails, including the default path with no invalidate flags.

### Expected Behavior

`weave change progress <lane> --source <list> --json` advances the lane and records sources. `--no-invalidate` suppresses downstream stale propagation; `--invalidate <lanes>` marks only the named dependent subset stale.

### Reproduction

`npm run dev -- change progress prd --source exploration --source sessions --json` against any active change.

### Root Cause Analysis

In `src/commands/change.ts` the `progress` subcommand declares both:

- `--no-invalidate` (negatable flag)
- `--invalidate <lanes>` (string option)

Commander merges both onto a single `invalidate` attribute. The negatable flag makes `options.invalidate` default to boolean `true`, and `options.noInvalidate` is never populated. The action then calls `parseInvalidateList(options.invalidate)`, which runs `.trim()` on the boolean:

- default (no flags): `parseInvalidateList(true)` -> `true.trim()` -> crash
- `--no-invalidate`: `parseInvalidateList(false)` -> `false.trim()` -> crash
- `--invalidate x,y`: parses the string, but `noInvalidate` stays `false`

The existing `tests/cli-change-staleness.test.ts` calls the `progressChange` lib function directly, bypassing the Commander layer, which is why the suite passes while the CLI fails.

### Affected Systems

- `src/commands/change.ts`: `ChangeProgressOptions` interface and the `progress` subcommand action only.

### Fix Strategy

Derive both lever options from the single Commander `invalidate` attribute and drop the phantom `noInvalidate` property:

- `noInvalidate: options.invalidate === false`
- `invalidateOnly: typeof options.invalidate === "string" ? parseInvalidateList(options.invalidate) : undefined`

This preserves the public flag names `--no-invalidate` and `--invalidate <lanes>`, so no skill/doc rename is needed. Mutual-exclusivity and lane validation already live in `progressChange`/`resolveStalePropagationTargets` and remain covered by the lib tests.

### Regression Tests

Existing `tests/cli-change-staleness.test.ts` (lib-level) stays green. A CLI-level smoke run (`npm run dev -- change progress <lane> --source ... --json`) is the manual verification that the Commander wiring no longer crashes.

### Risks and Rollout

Low risk, single-file change. Ships with the package upgrade. The fix is contract-preserving for both flags.

## Bug 2: `change new --type <non-feat>` scaffolds `exploration.md`

### Bug Context

`npm run dev -- change new "name" --type fix` creates `exploration.md` and starts at `stage: exploration`. The bug-fix PRD (`wiki/changes/260602-of9s-add-ability-to-bug-fix/prd.md`, functional requirements lines 179-181 and acceptance criteria 252-253) decided non-feature changes should create only `status.yml` + `sessions/` and start at `stage: started`. This scaffolding behavior was never implemented; the of9s change shipped only the `tasks.md` QA-findings/refactors work.

### Observed Behavior

All change types scaffold `exploration.md` and start at `stage: exploration`.

### Expected Behavior

- `type === "feat"`: scaffold `exploration.md`, `stage: exploration` (unchanged).
- non-feature types (`fix`, `refactor`, `docs`, `test`, `ci`, `chore`): create only `status.yml` + `sessions/`, `stage: started`. The first real artifact is created later by the fitting skill.

### Reproduction

`npm run dev -- change new "x" --type fix` then inspect the change folder and `status.yml`.

### Root Cause Analysis

`createChange` in `src/lib/changes.ts` unconditionally writes `exploration.md`, and `statusTemplate` hardcodes `stage: "exploration"`. `started` appears nowhere in `src/`, and `isChangeStage` only recognizes the four artifact lanes, so a `started` stage would currently be coerced back to `exploration` on read (`readChangeMetadata` line 912).

### Affected Systems

- `src/lib/changes.ts`: `createChange`, `statusTemplate`, `readChangeMetadata`, the metadata `stage` field types, and `maxStage`/`stageIndex`.
- `templates/skills/weave-new/SKILL.md` and its propagated copies (`.agents/`, `.claude/`, `.opencode/`).
- `tests/changes.test.ts`.

### Fix Strategy

- Introduce a stored-stage type that allows `started` without adding it to `changeStages` (the artifact-lane list): e.g. `StoredChangeStage = "started" | ChangeStage`, with an `isStoredChangeStage` guard. Widen the `stage` field type on the metadata interfaces.
- `createChange`: write `exploration.md` only when `type === "feat"`.
- `statusTemplate`: `stage: type === "feat" ? "exploration" : "started"`.
- `readChangeMetadata`: accept `started` instead of coercing to `exploration`.
- `maxStage`/`stageIndex`: tolerate a `started` input. `stageIndex("started")` returns -1, so any real lane wins when a started change is progressed; the `"exploration"` seed keeps progressed stages at their real lane.
- `weave-new` skill: make "Treat `exploration.md` as the first artifact" feature-specific and state non-feature changes start at `stage: started`; propagate byte-identical copies.

### Regression Tests

Add a `tests/changes.test.ts` case for `--type fix`: assert `exploration.md` is NOT created and `status.yml.stage === "started"`. Existing default (feat) cases (lines 47-70, 128-139) remain valid.

### Risks and Rollout

Backward compatible: existing feature changes are unchanged, and older changes without `started` remain readable. The main care point is the stage type widening rippling through metadata interfaces; the `started` stage is never a progressable lane, so lifecycle logic is unaffected once a change advances.

## Architecture Decisions

- Decision: fix Bug 1 by reading both lever options from the merged Commander `invalidate` attribute rather than renaming flags. Rationale: smallest contract-preserving change; avoids touching skill templates and docs. Consequence: CLI-level mutual exclusivity is no longer separately triggerable (last flag wins), but the lib still validates it.
- Decision: model `started` as a stored stage outside `changeStages`. Rationale: the of9s PRD requires `started` to be a stage but explicitly not an artifact lane. Consequence: a separate `StoredChangeStage` type and a guard; `changeStages` (lanes) is untouched, so staleness/dependency logic is unchanged.

## Open Technical Questions

- Confirm Commander v14 merges `--no-invalidate` + `--invalidate <lanes>` onto one attribute exactly as assumed (consistent with the observed crash; verify during implementation).
- Whether status/`weave-next` display needs explicit `started` handling beyond printing the stage value (current formatting prints `change.stage` directly, so type widening is expected to suffice).

## Product Questions Raised by Technical Design

None. The non-feature scaffolding behavior was already decided in the `260602-of9s` PRD.

## Revision History

- 2026-06-04: Initial architecture / RCA generated from the debugging discussion and codebase review.
