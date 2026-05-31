# Session Capture: Architecture - 2026-05-31

## Summary

First architecture-lane session for the `weave ship` change. Plan Mode discussion converted the now-Ready PRD into the engineering design captured in `architecture.md`. Three architecture decisions were locked through interactive Q&A — the lane type shape (`LaneName` superset rather than extending `ArtifactName` directly), multi-target discovery via session state, and the `weave ship --json` output shape with paired exit-code map. The PRD's only deferred-to-architecture open question (the JSON shape) is now resolved. A fourth durable property emerged from the conversation — "ship is a pure orchestrator; no new persistent state" — and was promoted to a top-level architecture decision (AD-4) along with the field-by-field data-source table. Eight more derived decisions (single orchestrator, lift git wrappers, mirror via `setCurrentArtifact`, gh detected at use-time, `--stash` opt-in, no `.weave/config.yml` in v1, foreign-knowledge default heuristic) were captured. After the doc was written, a short post-write clarification round established what the `--lane` flag actually changes downstream (scope partition, commit subject, draft/ready PR default, auto-promotion eligibility, and "How to review" pointer text). The architecture is now substantive enough to slice into implementation issues; `weave-next` recommends `weave-issues` as the primary next step.

## Decisions Made

- **AD-1. Lane type shape**: keep `ArtifactName = "exploration" | "prd" | "architecture"` narrow; introduce `LaneName = ArtifactName | "implementation" | "review"`. Widen `SessionCurrentArtifact.artifact: LaneName` (TS type widening; on-disk field name unchanged). For non-file lanes, `current_artifact.path` resolves to the change folder root rather than a `<lane>.md` file. File-only helpers (`artifactFileName`, `artifactFrontmatter`, `defaultArtifactSource`) keep their narrow `ArtifactName` signatures.
- **AD-2. Multi-target via session-state discovery**: ship iterates session folders where `current_change.id === <active id>` (aligns with `currentChange({ target: "all" })` in `src/lib/changes.ts`). Filesystem-based discovery rejected.
- **AD-3. `weave ship --json` shape and exit-code map (resolves the PRD's lone open question)**: per-target `ShipTargetResult` with named enums (`PrAction`, `CommitSkipReason`, `PreconditionReason`); per-target `exit_code`; `ShipResult.targets` array. Exit-code map `0` ok / `1` unexpected / `2` precondition / `3` guard block / `4` hook fail / `5` push fail / `6` gh PR error / `7` stash restore conflict. Process exit code = `max(target.exit_code)`. `--json` writes only `ShipResult` to stdout; nothing to stderr.
- **AD-4. Ship is a pure orchestrator; no new persistent state**: every `ShipTargetResult` field is derived from live git, live gh, or already-existing Weave state on disk. Side effects = git commit + git push + gh PR. Ship does not write session state, does not mirror to `status.yml#stage`, does not cache PR URLs, does not write session notes. `--lane` is one-shot only.
- **AD-5. `status.yml#stage` is a display cache**: read by `weave change list / current / status` only. Mirrored from `setCurrentArtifact` via a new `mirrorStageToStatusYml(...)` helper. Mirror failures are non-fatal. `clearCurrentArtifact` does not roll the field back. Ship never consults the field.
- **AD-6. `gh` and remote host detected at use-time per target**: cheap, isolates failures, no global pre-flight that aborts a multi-target run because of one bad target.
- **AD-7. `--stash` is opt-in**: leaks block ship by default with a clear list and `--stash` hint. `--stash` invokes `git stash push -- <leaked-files>`, runs ship, and `git stash pop` on exit. On restore conflict, ship prints stash ref + recovery commands and exits 7. No file persistence for stash refs (print-only).
- **AD-8. Lift `git`/`gitRequired`/`currentBranch` from `changes.ts` to `git.ts`**: behaviour-preserving refactor; `git-ops.ts` and `gh.ts` use this single layer.
- **AD-9. Foreign-knowledge default heuristic**: any dirty `wiki/knowledge/**` path is "foreign-knowledge"; bundled into the commit and listed in `ShipTargetResult.foreign_knowledge_files`. Cross-reference-aware refinement deferred to v2.
- **AD-10. Single orchestrator with per-target containment**: `ship.ts` exports one `ship(options)` function. Per-target work wrapped in try/catch; one target's failure does not abort the run. Typed `ShipError` subclasses (`ShipPreconditionError`, `ShipHookError`, `ShipPushError`, `ShipGhError`, `ShipStashError`) translate at the per-target boundary.
- **AD-11. No `.weave/config.yml` in v1**: behaviour fixed by code; only CLI flags vary.
- **`--lane` semantics (post-write clarification)**: one-shot CLI override that sits at priority 1 in lane resolution. Affects four downstream surfaces in this single invocation only:
  1. Scope partition (in-scope vs leak globs are lane-keyed).
  2. Commit subject (`<type>(<id>): <lane> - <title>`).
  3. PR draft/ready default on first open (draft for early lanes; ready for impl/review).
  4. Auto-promotion eligibility (only fires when resolved lane is `implementation | review` and PR is currently draft).
  5. PR body "How to review" pointer text (lane-keyed lookup).
  Constraints: lane name must be a valid `LaneName` (else exit 2 `invalid_lane`); branch precondition `change/<id>` still applies; change folder must have a valid `status.yml`. Persistent lane changes still go through `weave artifact current set`.

## Options Considered

- **Lane type shape**: (A) two types — `ArtifactName` (file-backed) + `LaneName` (superset) [chosen]; (B) extend `ArtifactName` directly with throw/null returns for non-file lanes; (C) full rename `ArtifactName -> LaneName` everywhere with internal narrowing.
- **Multi-target discovery**: (A) session-state discovery (folders where `current_change.id` matches) [chosen]; (B) filesystem discovery (scan `wiki/changes/<id>/` across folders); (C) single-target by default with explicit `--all-targets` opt-in; (D) defer multi-target to v2.
- **JSON output shape**: (i) PRD-proposed shape (the structural starting point); (ii) architecture-confirmed shape with locked field names + named enums + per-target `exit_code` addition + paired exit-code map [chosen].
- **Pure-orchestrator property promotion**: keep "no new persistent state" implicit in the design vs. promote it to a named architecture decision [chosen — explicit AD].
- **`--lane` documentation depth**: leave "one-shot override" as the bullet's only description vs. expand inline with the four downstream surfaces it affects [chosen — expand].

## Rejected Approaches

- **Extend `ArtifactName` directly** (option B from interview): naming dissonance for file-only helpers; sentinel return / throw paths for non-file lanes are awkward and error-prone.
- **Rename `ArtifactName` to `LaneName` everywhere** (option C): every call site and existing test would change; on-disk session-state field name would either remain a misnomer or require a schema migration.
- **Filesystem-based multi-target discovery**: would iterate orphaned change folders or session-disconnected repos surprisingly.
- **Single-target only in v1**: would have invalidated the PRD's multi-target requirement.
- **Sub-primitives (`weave ship commit` / `weave ship push` / `weave ship pr`)**: PRD non-goal; single command keeps surface small and operation idempotent.
- **`weave change advance` command**: redundant given `weave artifact current set` covers any-direction lane moves.
- **Auto-stash by default**: silent worktree mutation is dangerous; must remain opt-in.
- **Persisting stash refs to `sessions/` or `.weave/`**: stash refs are short-lived; print-on-failure is sufficient.
- **Caching PR URL in session state**: invalidation is hard; live `gh pr view` is fast enough.
- **Native (Octokit-based) GitHub PR creation**: adds runtime dep, requires token management, duplicates `gh`'s auth UX. PRD non-goal.

## User Preferences

- The PRD's open question (`weave ship --json` shape) must be resolved in architecture, not punted forward to implementation. Architecture lane is the right place to lock concrete field names and the exit-code pairing.
- When evaluating type-shape options, prefers concrete code-grounded examples (e.g. "show me what `current_artifact.artifact` looks like on disk and how each option changes it") over abstract pros/cons.
- Prefers reusing existing primitives over introducing new state. The "no new persistent state" property is consistent with this preference.
- Wants the operational distinction between persistent lane changes (`weave artifact current set`) and one-shot lane changes (`weave ship --lane`) made explicit so users don't reach for `--lane` repeatedly.
- After core decisions land, prefers moving forward to the next pipeline step rather than expanding documentation further (responded to "should I record this in architecture.md more prominently?" with `/weave-next`).

## Agent Recommendations

- Place lane resolution in `src/lib/lane.ts` and the lane-scope table in `src/lib/lane-scope.ts` for testability and a single source of truth.
- Lift the duplicate `git`/`gitRequired`/`currentBranch` helpers from `src/lib/changes.ts` into `src/lib/git.ts` before adding ship plumbing, so both feature areas share one wrapper.
- Encapsulate the `status.yml#stage` mirror inside `setCurrentArtifact` so any caller that updates artifact context also updates the display cache atomically.
- Use per-target containment with typed `ShipError` subclasses (`ShipPreconditionError`, `ShipHookError`, `ShipPushError`, `ShipGhError`, `ShipStashError`) caught at the per-target boundary.
- Detect `gh` and the remote host at use-time per target rather than once at orchestrator start, so per-target containment is preserved.
- Use `gh pr view --json url,isDraft,number,state` for stable detection (contract-stable JSON schema, less brittle than text parsing).
- For tests, stub `gh` with a small fake binary controlled by env vars; use vitest tmpdir + real `git init` for ship integration tests so CI does not require GitHub API access.
- Treat `mirrorStageToStatusYml` failures as non-fatal (logged to stderr) — the display cache should never block a successful artifact-context update.
- Never auto-pop the stash on conflict; leave the entry intact so the user can recover with `git stash pop <ref>`.
- Spawn `git` calls with `LANG=C` for deterministic stderr parsing.
- Follow up `weave-architect` with `weave-issues` to slice the architecture into tracer-bullet implementation issues; the open technical questions are explicitly deferred and do not block slicing.

## Unresolved Points

All seven Open Technical Questions in `architecture.md` and both Product Questions Raised by Technical Design are explicitly deferred (decisions blocked, v2 follow-ups, or precision-tuning that depends on artifacts not yet shipped). They do not block implementation slicing. For posterity:

- **OTQ-1**: foreign-knowledge cross-reference refinement (v2 if usage data warrants).
- **OTQ-2**: `tasks.md` populated heuristic precision (defer until `weave-implement` lands and stabilises `tasks.md` shape).
- **OTQ-3**: pre-commit hook re-modification on retry — re-stage original list only vs broaden on retry.
- **OTQ-4**: multi-target `weave artifact current set <lane> --target <id>` UX (defer until users have explicit need).
- **OTQ-5**: skill suggestion footer placement in lane-skill templates (template structure only; wording is locked).
- **OTQ-6**: `git status` output parsing for renamed paths (treat both halves equally for v1).
- **OTQ-7**: concurrent ship serialisation with a `--lock` flag (rely on `gh`'s server-side rejection in v1).
- **PQ-1**: foreign-knowledge cross-reference policy (PRD says bundle-and-warn for everything; architecture defaults match).
- **PQ-2**: lane-keyed "How to review" pointer text in the PR body (architecture proposes reasonable defaults; PRD can absorb the table without rework if needed).

## Live Artifact Updates Applied

- Added a `--lane` semantics subsection under `Proposed Architecture` -> `src/commands/ship.ts` documenting the four downstream surfaces it affects (scope partition, commit subject, PR draft/ready default, auto-promotion eligibility, PR body pointer text) plus the operational distinction between persistent (`weave artifact current set`) and one-shot (`weave ship --lane`) lane changes. The bullet for `--lane` is expanded inline; a new "Operational distinction: persistent vs one-shot lane changes" subsection is added.
- Bumped frontmatter `updated_at` to `2026-05-31`.
- Appended a `Revision History` entry for this session.

No other live-artifact merges were required: `architecture.md` was written from scratch in the same session and already captured every decision discussed (it is not pre-existing content needing a merge).

## Next Resume Point

Run `weave-issues` to break the architecture into independently-grabbable, tracer-bullet implementation issues. The architecture is substantive across all 18 sections and the deferred OTQs / product questions are explicitly non-blocking for slicing. Suggested first vertical slice: lift the git wrappers from `changes.ts` to `git.ts` (AD-8) and add the `LaneName` superset (AD-1) — both are pre-requisites for everything else and have no inbound dependencies.
