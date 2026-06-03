# Knowledge Delta

## Durable Behavior Changes

- `weave change progress` works from the CLI again. Previously `--no-invalidate` and `--invalidate <lanes>` collided on one Commander option, so every invocation crashed with `raw.trim is not a function`. The documented stale levers and default propagation are now reachable from the CLI.
- Non-feature `weave change new` (`fix`, `refactor`, `docs`, `test`, `ci`, `chore`) now starts at `stage: started` with no scaffolded `exploration.md` and no current artifact context. Feature changes are unchanged (`stage: exploration` with `exploration.md`).
- `started` is now a recognized stored stage distinct from the four artifact lanes (`exploration`, `prd`, `architecture`, `issues`). It never participates in lifecycle progress, source dependencies, or staleness; lane progress advances a `started` change directly to the progressed lane.

## Affected Knowledge Areas

- `change-workflow` domain: change creation and the stage vocabulary; `weave change progress` CLI lever wiring.

## Knowledge Files Updated

- `wiki/knowledge/domains/change-workflow/domain-wide/change-creation-and-stages.md` (new)
- `wiki/knowledge/domains/change-workflow/domain-wide/lifecycle-progress-and-staleness.md` (CLI flag-wiring fix, `started` stage tolerance, new test anchor, change history)
- `wiki/knowledge/domains/change-workflow/index.md` (start-stage summary, link to the new domain-wide doc)

## No-Impact Rationale

Not applicable; this change has durable behavior impact.

## Source Evidence

- `src/commands/change.ts` (`progress` action; `change new` action)
- `src/lib/changes.ts` (`createChange`, `statusTemplate`, `readChangeMetadata`, `maxStage`, `stageIndex`, `storedStages`/`StoredChangeStage`/`isStoredChangeStage`, `saveCurrentForTargets`)
- `templates/skills/weave-new/SKILL.md` (+ propagated `.agents`/`.claude`/`.opencode` copies)
- Tests: `tests/cli-change-progress.test.ts`, `tests/changes.test.ts`, `tests/cli-skills.test.ts`

## Follow-Up Knowledge Work

- If `weave change status` / `weave-next` later give the `started` stage dedicated presentation, update `change-creation-and-stages.md` accordingly.
