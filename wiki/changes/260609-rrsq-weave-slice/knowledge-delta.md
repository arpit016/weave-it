# Knowledge Delta

## Durable Behavior Changes

- Introduced **task-slices** model: per-change `task-slices/<NN>-<slug>/` folders with `slice.md`, `contracts.md`, `tasks.md`, `status.yml`, and rollup-derived `dependency-graph.md`.
- Added **rollup library** (`src/lib/sliceRollup.ts`, `weave slice rollup` CLI): writer-derives, harness-agnostic, batched at weave-execute episode boundaries.
- Added lifecycle lanes **`findings`** (fix-type) and **`slices`** (replaces **`issues`**; CLI alias kept).
- **Hard-renamed** `weave-issues` → **`weave-slices`**; added **`weave-fix`** for bug-fix entry.
- **Dual-mode** `weave-execute` / `weave-next`: slice mode when `task-slices/` exists; flat legacy mode when only change-root `tasks.md` exists.
- **Deprecated** `weave-prepare`; branch prep absorbed into `weave-execute`.
- **`weave-slices` verification rule**: every slice must have explicit verification tasks (behavior-named tests or manual verification task with steps).

## Affected Knowledge Areas

- `change-workflow` domain: task-slices feature, weave-slices, weave-fix, weave-execute, weave-prepare, lifecycle lanes, change creation stages
- `cli-distribution`: skill install vs update for new skill names on upgrade (documented in task-slices)

## Knowledge Files Updated

- `wiki/knowledge/domains/change-workflow/features/task-slices/behavior.md` (expanded)
- `wiki/knowledge/domains/change-workflow/features/weave-slices/behavior.md` (new)
- `wiki/knowledge/domains/change-workflow/features/weave-fix/behavior.md` (new)
- `wiki/knowledge/domains/change-workflow/index.md`
- `wiki/knowledge/domains/change-workflow/domain-wide/change-creation-and-stages.md`
- `wiki/knowledge/domains/change-workflow/domain-wide/lifecycle-progress-and-staleness.md`
- `wiki/knowledge/domains/change-workflow/features/weave-execute/behavior.md`
- `wiki/knowledge/domains/change-workflow/features/weave-prepare/behavior.md`
- `wiki/knowledge/domains/change-workflow/features/weave-issues/behavior.md` (supersession note)
- `wiki/knowledge/index.md`

## No-Impact Rationale

N/A — durable behavior changed.

## Source Evidence

- Change `260609-rrsq-weave-slice`: architecture facets, `tasks.md` T1–T8 completion, implemented code under `src/lib/sliceRollup.ts`, `src/lib/changes.ts`, `templates/skills/`
- Verification: `npm test` (205 passed), `npm run typecheck`

## Follow-Up Knowledge Work

- Add `weave-slices` / `weave-fix` entries to `cli-distribution` domain when release notes ship.
- Consider deprecating or archiving `weave-issues/behavior.md` after one release cycle (currently marked superseded, not deleted).
