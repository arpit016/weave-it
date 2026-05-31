---
artifact: tasks
status: complete
owner: engineering
created_at: 2026-05-31
updated_at: 2026-05-31
reviewed_at: null
approved_at: null
approved_by: null
source: architecture.md
---

# Weave Ship - Implementation Slices

## Overview

11 vertical slices broken from `architecture.md` using the tracer-bullet model. Each slice cuts end-to-end through the affected layers (lib helpers, CLI command, skill templates, tests). Slices 1 and 2 are foundational pre-reqs; slice 3 is the first end-to-end ship invocation; slices 4-10 each extend ship with one feature dimension and can be picked up in parallel after #3 lands; slice 11 is documentation polish.

Source artifacts:

- `wiki/changes/260530-hb8a-weave-ship-command-for-git-automation/prd.md`
- `wiki/changes/260530-hb8a-weave-ship-command-for-git-automation/architecture.md`

User-story numbers reference the 20 stories listed in `prd.md` -> `## User Stories`.

## Dependency Graph

```text
1 ─┐
   ├─> 3 ─> {4, 5, 6, 7, 8, 9, 10}
2 ─┘
└──────────> 11 (also depends on 3)
```

- Slices 1 and 2 have no inbound deps; they can start in parallel.
- Slice 3 is the tracer bullet through every layer (commit + push + draft PR for the exploration lane). It blocks every feature slice.
- Slices 4-10 are independent of each other once #3 lands.
- Slice 11 (README + release notes) benefits from #4-#10 being landed for accuracy but can begin once the core surface from #3 exists.

## Status Legend

- `[ ]` not started
- `[~]` in progress
- `[x]` complete

## Implementation Status

All 11 slices landed locally on `change/260530-hb8a-weave-ship-command-for-git-automation` ahead of the first ship. Verified with:

- `npm run typecheck` — clean
- `npm test` — 91 passed (7 files)
- `npm run build` — green

| Slice | Status |
| --- | --- |
| 1: Lift git wrappers | complete |
| 2: `LaneName` superset + `status.yml#stage` mirror | complete |
| 3: Tracer-bullet `weave ship` (commit + push + draft PR + `--json`) | complete |
| 4: Lane-aware leak guard + `--stash` opt-in | complete |
| 5: Multi-target session-state discovery | complete |
| 6: Auto-promotion + `--draft`/`--ready` + impl/review PR posture | complete |
| 7: Foreign-knowledge bundling | complete |
| 8: gh graceful fallback (`no_gh`, `unauth`, `non_github`, `no_remote`) | complete |
| 9: Pre-commit hook respect + single retry | complete |
| 10: `weave-ship` skill + lane-skill suggestion footers | complete |
| 11: README + release notes | complete |

---

## Slice 1: Lift git wrappers from `changes.ts` to `git.ts`

- **Type**: AFK
- **Blocked by**: None - can start immediately.
- **User stories**: foundation; not directly user-visible.
- **Architecture refs**: AD-8.

### What to build

Behaviour-preserving refactor. Lift the private `git()`, `gitRequired()`, and `currentBranch()` helpers from `src/lib/changes.ts` into `src/lib/git.ts` and export them so the upcoming `weave ship` modules (`git-ops.ts`, `gh.ts`) and the existing `changes.ts` consumers share one git wrapper layer. `changes.ts` continues to call the same helper signatures, but imports them from the new home. No public CLI behaviour changes.

### Acceptance criteria

- [x] `src/lib/git.ts` exports `git(args, cwd)`, `gitRequired(args, cwd)`, and `currentBranch(cwd)` in addition to the existing `findGitRoot` and `getGitRemote`.
- [x] `src/lib/changes.ts` imports those helpers from `./git.js` and removes its private duplicates.
- [x] Existing tests in `tests/changes.test.ts` continue to pass without modification.
- [x] New `tests/git.test.ts` covers the lifted helpers (silent vs throwing variants, `currentBranch` against tmpdir + real `git init`).
- [x] `npm run typecheck` is clean.
- [x] `npm test` is green.
- [x] `npm run build` is green.

---

## Slice 2: `LaneName` superset + widen `weave artifact current set` + `status.yml#stage` mirror

- **Type**: AFK
- **Blocked by**: None - can start immediately.
- **User stories**: 12 (`--lane` override foundation), 19 (backward lane move), 20 (lane-mismatch hint foundation).
- **Architecture refs**: AD-1, AD-5.

### What to build

Add `LaneName = ArtifactName | "implementation" | "review"` in a new `src/lib/lane.ts`. Widen `SessionCurrentArtifact.artifact: LaneName` (TS type widening; on-disk field name unchanged). Update `parseArtifact` / `parseArtifactName` to accept the wider set in `weave artifact current set`. In `setCurrentArtifact`, branch on file-vs-lane to compute `current_artifact.path`: file path for `exploration|prd|architecture` (existing behaviour), change folder root for `implementation|review`. Add `mirrorStageToStatusYml(targetRoot, changeRelativePath, lane)` helper invoked from `setCurrentArtifact`; mirror failures non-fatal (logged to stderr). Older session files (`artifact: exploration|prd|architecture`) continue to load unchanged.

### Acceptance criteria

- [x] `LaneName` type and `isLaneName(value)` helper exported from `src/lib/lane.ts`.
- [x] `SessionCurrentArtifact.artifact` typed as `LaneName` in `src/lib/session-state.ts`.
- [x] `weave artifact current set implementation --json` succeeds; `current_artifact.path` is the change folder root.
- [x] `weave artifact current set review --json` succeeds.
- [x] `weave artifact current set <invalid>` fails fast with a clear error naming all five accepted values.
- [x] After `weave artifact current set <name>`, the change's `status.yml#stage` field reflects `<name>` and `weave change current` displays it.
- [x] Mirror write failures (e.g. read-only `status.yml`) do not fail `weave artifact current set`; they emit a stderr warning.
- [x] `clearCurrentArtifact` does not mutate `status.yml#stage`.
- [x] Loading an older session file with `artifact: exploration` continues to work.
- [x] New `tests/lane-name-compat.test.ts` covers the widening, the path semantics for non-file lanes, and the mirror behaviour.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Slice 3: Tracer-bullet `weave ship`: exploration lane, single target, commit + push + draft PR, `--json` shape

- **Type**: AFK
- **Blocked by**: Slice 1, Slice 2.
- **User stories**: 1 (single command), 2 (early-lane drafts), 6 (idempotent), 7 (clear messages), 11 (wrong-branch refuse), 12 (`--lane`), 18 (`--json`).
- **Architecture refs**: AD-3, AD-4, AD-6, AD-10.

### What to build

The first end-to-end vertical bullet through every layer. New modules: `src/lib/lane.ts` (`resolveLane()` priority chain - flag, session lane, artifact-presence inference), `src/lib/lane-scope.ts` (full scope table baked in for all five lanes; `partitionDirty()`), `src/lib/git-ops.ts` (`getDirtyFiles`, `stageFiles`, `commit`, `push`, `defaultBaseBranch`, `compareUrl`), `src/lib/gh.ts` (`ghAvailable`, `ghAuthOk`, `findPrForBranch`, `createPr`), `src/lib/ship.ts` (orchestrator), `src/commands/ship.ts` (Commander entry registered in `cli.ts`).

Flags wired in this slice: `--lane`, `--json`. Other flags (`--draft`, `--ready`, `--stash`, `--message-body`, `--pr-body-extra`) are accepted but no-op until later slices. `ShipResult` / `ShipTargetResult` shape from AD-3 returned in full; only the `pr.action: "opened_draft"` and `"existing"` enum branches exercised in this slice.

From a `change/<id>` branch with a dirty `exploration.md`, `weave ship` resolves lane = `exploration`, commits `feat(<id>): exploration - <title>` (body = staged-files list + latest active-lane session note `## Summary`), pushes with `-u origin HEAD`, runs `gh pr create --draft`. Idempotency: re-running prints existing PR URL with `pr.action: "existing"`. Precondition errors (no active change, wrong branch, not git, change corrupt) all return exit 2 with structured result.

### Acceptance criteria

- [x] `weave ship` is registered as a top-level Commander command and shows in `weave --help`.
- [x] `weave ship` from a `change/<id>` branch with a dirty `exploration.md` produces a commit with subject `<type>(<id>): exploration - <title>`.
- [x] First push uses `git push -u origin HEAD`; subsequent pushes use plain `git push`.
- [x] When no PR exists for the branch and lane resolves to `exploration`, `weave ship` opens a draft PR via `gh pr create --draft` with title `<type>: <title>` and a templated metadata block.
- [x] When a PR already exists for the branch, `weave ship` prints the existing PR URL and does not create a duplicate; result has `pr.action: "existing"`.
- [x] `weave ship` on `main` (or any branch other than `change/<active-id>`) fails fast with exit 2 and a hint pointing to `weave change switch <id>`.
- [x] `weave ship` with no active Weave change fails fast with exit 2 and a hint pointing to `weave change new` / `weave change switch`.
- [x] `weave ship` outside a git repo fails fast with exit 2.
- [x] Lane resolution priority is: `--lane` flag > `weave artifact current` > artifact-presence inference (populated `tasks.md` -> `implementation`; `architecture.md` -> `architecture`; `prd.md` -> `prd`; otherwise `exploration`).
- [x] `weave ship --json` writes a single `ShipResult` JSON object to stdout matching the AD-3 shape; nothing on stderr.
- [x] Process exit code matches the AD-3 exit-code map; in this slice the relevant codes are 0 (ok), 2 (precondition).
- [x] New integration tests in `tests/ship.test.ts` cover: exploration happy path with fake `gh`, wrong-branch precondition, no-active-change precondition, not-git precondition, idempotent re-run, `--json` shape sanity.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Slice 4: Lane-aware leak guard + `--stash` opt-in

- **Type**: AFK
- **Blocked by**: Slice 3.
- **User stories**: 4 (refuse `src/**` during exploration), 5 (`--stash` escape), 7 (clear messages), 20 (lane-mismatch hint).
- **Architecture refs**: AD-7, IR-1.

### What to build

Wire `partitionDirty()` into the orchestrator. Without `--stash`: leaks block ship; exit 3 with `guard.ok: false`, `guard.leaked_files`, and a hint pointing at `weave artifact current set <impl-lane>` / `weave ship --lane <name>` / `--stash`. With `--stash`: invoke `git stash push -- <leaked-files>`, run ship, `git stash pop` on exit. On stash restore conflict: print stash ref + `git stash list` / `git stash pop <ref>` recovery commands; exit 7; leave stash entry intact. Add `stashLeaks(cwd, files)` and `popStash(cwd, ref)` to `git-ops.ts`.

### Acceptance criteria

- [x] Dirty `src/cli.ts` while lane is `exploration` blocks ship with exit 3 and prints the leaked path.
- [x] Block message includes hints to use `weave artifact current set <name>`, `weave ship --lane <name>`, or `--stash`.
- [x] `weave ship --stash` with a leaked file: stashes leaks, commits + pushes the in-scope files, pops the stash on exit, exits 0.
- [x] On stash pop conflict, ship prints the stash ref and `git stash list` / `git stash pop <ref>` recovery commands; exits 7; the stash entry is retained.
- [x] `ShipTargetResult.guard` and `.stash` fields are populated correctly across all paths.
- [x] New integration tests in `tests/ship.test.ts` cover: leak block, `--stash` happy path, `--stash` restore conflict.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Slice 5: Multi-target session-state discovery

- **Type**: AFK
- **Blocked by**: Slice 3.
- **User stories**: 10 (multi-target propagated changes).
- **Architecture refs**: AD-2, IR-4.

### What to build

In `ship.ts`, replace single-target operation with iteration over session folders where `current_change.id === <active id>` (per AD-2). Per-target containment via `try/catch`; one target's failure does not abort the run. Process exit = `max(target.exit_code)`. Output: per-target structured outcome in JSON (`ShipResult.targets`); per-target text block in human mode. Folders without a session-tracked `current_change` for the active id are silently skipped.

### Acceptance criteria

- [x] `weave ship` with two session folders both carrying matching `current_change.id` runs the full sequence in each target.
- [x] When target A succeeds and target B fails, both outcomes are reported and process exit code = `max(target.exit_code)`.
- [x] Single-target invocation (cwd's target is the only one with matching `current_change`) still works exactly like slice 3.
- [x] Per-target outcomes appear in `ShipResult.targets` array in stable order (cwd target first).
- [x] Human-mode output prints one block per target with a clear separator.
- [x] Integration tests cover: two-folder happy path, partial failure, single-target invocation.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Slice 6: Auto-promotion + `--draft` / `--ready` overrides + impl/review PR posture

- **Type**: AFK
- **Blocked by**: Slice 3.
- **User stories**: 2 (drafts for early lanes), 3 (impl PR ready), 6 (idempotent auto-promotion), 13 (`--draft` / `--ready`), 19 (backward lane move).
- **Architecture refs**: AD-3 (PR action enum), `pr.action: "opened_ready"` and `"promoted_to_ready"`.

### What to build

Add `markPrReady(cwd, branch)` to `gh.ts`. In the orchestrator: when an existing PR is draft AND resolved lane is `implementation | review` AND `--draft` is not passed, call `gh pr ready` and set `pr.action: "promoted_to_ready"`. New PR open default flips to ready when lane is `implementation | review`. Wire `--draft` / `--ready` overrides (any-lane override of the draft/ready default). Never auto-demote ready -> draft; only `--draft` can.

### Acceptance criteria

- [x] `weave ship` with lane `implementation` and no existing PR opens a ready PR (`pr.action: "opened_ready"`).
- [x] `weave ship` with lane `implementation` and an existing draft PR auto-promotes it (`pr.action: "promoted_to_ready"`).
- [x] `weave ship --draft` from any lane opens / keeps the PR as draft (no auto-promotion).
- [x] `weave ship --ready` from any lane opens a ready PR.
- [x] An existing ready PR is never auto-demoted to draft (only `--draft` can demote).
- [x] `--lane <impl|review>` triggers auto-promotion against an existing draft PR.
- [x] Re-running ship after auto-promotion is idempotent (`pr.action: "existing"`).
- [x] Integration tests cover: ready first-open, auto-promotion happy path, `--draft` overrides lane default, `--ready` overrides exploration default, never-auto-demote.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Slice 7: Foreign-knowledge bundling

- **Type**: AFK
- **Blocked by**: Slice 3.
- **User stories**: 7 (clear messages on what was bundled).
- **Architecture refs**: AD-9, OTQ-1, IR-5.

### What to build

In `partitionDirty()`, classify any dirty `wiki/knowledge/**` path as foreign-knowledge. Bundle into the staged set (still committed) but list separately in `ShipTargetResult.foreign_knowledge_files`. Surface in human-mode summary as an informational warning ("listed for split, not a block"). The simple v1 heuristic does not check for cross-references; OTQ-1 tracks the v2 refinement.

### Acceptance criteria

- [x] A dirty `wiki/knowledge/billing.md` is committed as part of the change AND listed in `foreign_knowledge_files`.
- [x] Human-mode output flags foreign-knowledge files clearly (e.g. "Foreign-knowledge bundled: <list>").
- [x] `--json` output's `foreign_knowledge_files` array contains the same paths.
- [x] Foreign-knowledge files do not trigger the leak guard (they are bundled, not blocked).
- [x] Integration tests cover: foreign-knowledge file present alongside change-folder edits.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Slice 8: `gh` graceful fallback (no-gh, unauth, non-github, no-remote)

- **Type**: AFK
- **Blocked by**: Slice 3.
- **User stories**: 8 (no `gh` installed), 9 (`gh` unauth).
- **Architecture refs**: AD-3 (skipped enum branches), AD-6.

### What to build

At the PR step per target, branch on `ghAvailable()` / `ghAuthOk()` / remote-host parsing. Skip-with-message paths populate `pr.action` with `"skipped_no_gh"` / `"skipped_unauth"` / `"skipped_non_github"` / `"skipped_no_remote"`. Print `compareUrl(remote, base, head)` when the host is recognised (github / gitlab / bitbucket; SSH and HTTPS forms). Exit 0 when push succeeded but PR was skipped.

### Acceptance criteria

- [x] `gh` not on PATH: `pr.action: "skipped_no_gh"`; commit + push succeed; compare URL printed when host recognised; exit 0.
- [x] `gh` installed but `gh auth status` non-zero: `pr.action: "skipped_unauth"`; commit + push succeed; `gh auth login` instruction printed + compare URL; exit 0.
- [x] Origin is GitLab or Bitbucket: `pr.action: "skipped_non_github"`; commit + push succeed; compare URL printed; exit 0.
- [x] Origin remote not configured: `pr.action: "skipped_no_remote"`; push fails with exit 5 (this is a push failure, not a PR skip).
- [x] `compareUrl` recognises both SSH and HTTPS remote forms for github.com, gitlab.com, bitbucket.org.
- [x] Unrecognised remote host with `gh` available: skip PR step, print branch + remote, exit 0.
- [x] Integration tests stub each detection path.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Slice 9: Pre-commit hook respect + single retry

- **Type**: AFK
- **Blocked by**: Slice 3.
- **User stories**: 7 (clear messages on hook failure).
- **Architecture refs**: AD-3 (`commit.reason: "hook_failed"`), IR-2, OTQ-3.

### What to build

Promote `commit()` to `commitWithRetry(cwd, files, options)` in `git-ops.ts`. On a `git commit` failure that indicates "files were modified" (hook auto-format), re-stage the original target file set exactly once and retry. On second non-zero exit, throw `ShipHookError` -> exit 4. Set `commit.reStaged: true` on retry success. No `--no-verify` ever passed.

### Acceptance criteria

- [x] A pre-commit hook that reformats `exploration.md` once: ship re-stages the file and the second commit attempt succeeds. `commit.reStaged: true`.
- [x] A pre-commit hook that reformats on every attempt: ship fails with exit 4 and includes the hook stderr in `commit.reason: "hook_failed"`.
- [x] A pre-commit hook that fails outright (e.g. lint error): ship fails with exit 4 and surfaces the hook output.
- [x] Ship never passes `--no-verify` to `git commit`.
- [x] Integration tests with real pre-commit hook scripts in tmpdir cover: format-on-commit retry succeeds, aggressive re-modify on retry fails, hook error fails.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Slice 10: `weave-ship` skill + lane-skill suggestion footers + `--message-body` / `--pr-body-extra` wiring

- **Type**: HITL
- **Blocked by**: Slice 3.
- **User stories**: 14 (preflight readiness check), 15 (multi-session synthesis), 16 (conditional ship suggestion), 17 (Plan-Mode preview).
- **Architecture refs**: `templates/skills/weave-ship/SKILL.md`, `src/lib/lane-suggestion.ts`, OTQ-5.

### What to build

New `templates/skills/weave-ship/SKILL.md` with: Plan-Mode preview path; preflight readiness check (Open Questions, PRD Readiness, latest session-note Unresolved Points, `tasks.md` open items); append-only synthesis of `--message-body` (commit body) and `--pr-body-extra` (appended to templated PR body, metadata block preserved); ask-before-invoke on unusual preflight findings. Wire the two flags through `src/commands/ship.ts` (commit body substitution; PR body append). Add a "Conditional Ship Suggestion" footer block to `templates/skills/weave-{capture,explore,prd,architect}/SKILL.md` (instructional text the agent emits when in-scope dirty files exist or when entering a next-lane skill with the prior artifact uncommitted). Add `src/lib/lane-suggestion.ts` exporting `freshWriteSuggestion(...)` and `nextLaneEntrySuggestion(...)` for consistent wording.

### Acceptance criteria

- [x] `templates/skills/weave-ship/SKILL.md` exists with the workflow described in `architecture.md` -> `Proposed Architecture` -> `templates/skills/weave-ship/SKILL.md`.
- [x] In Plan Mode, `weave-ship` skill prints preflight findings + proposed commit message + appended PR body block + resolved lane + in-scope file list and stops; no CLI invocation.
- [x] In normal mode with clean preflight, `weave-ship` skill optionally synthesises `--message-body` and `--pr-body-extra` and invokes `weave ship`.
- [x] In normal mode with unusual preflight (e.g. `Not ready` exploration shipped from PRD lane), the skill warns and asks for explicit confirmation.
- [x] The skill never replaces the PR title or the templated PR body metadata block (CLI-only).
- [x] `weave ship --message-body "<text>"` substitutes the commit body verbatim.
- [x] `weave ship --pr-body-extra "<text>"` appends `<text>` after the templated PR body metadata block.
- [x] `templates/skills/weave-{capture,explore,prd,architect}/SKILL.md` each include a Conditional Ship Suggestion section with the wording from `lane-suggestion.ts`.
- [x] `src/lib/lane-suggestion.ts` exports the two pure renderers; unit tests cover all the documented inputs.
- [x] `tests/agent-skills.test.ts` and `tests/cli-skills.test.ts` cover the new `weave-ship` skill template install and `weave skill show weave-ship` content shape.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Slice 11: README + release notes for `weave ship`

- **Type**: HITL
- **Blocked by**: Slice 1, Slice 2, Slice 3 (and benefits from slices 4-10 being landed for accuracy; can begin once core surface from #3 exists).
- **User stories**: foundation for adoption.
- **Architecture refs**: `Rollout and Migration`.

### What to build

Add a `## weave ship` section to `README.md` modelled after the existing `## weave change` section: synopsis, flags, flag descriptions, usage examples for the four common flows (commit + push + draft PR for exploration; commit + push + ready PR for implementation with auto-promotion; `--stash` happy path; multi-target). Document that `weave artifact current set` accepts `implementation` and `review` in addition to existing values. Add a release-notes draft entry calling out: new command, new lane values, `status.yml#stage` is now a display cache, `weave-ship` skill is new, lane skills updated with conditional ship-suggestion footers (re-sync via `weave agent update <agent>`).

### Acceptance criteria

- [x] `README.md` has a `## weave ship` section with synopsis, flags table, and at least four usage examples.
- [x] `README.md`'s `## weave artifact` section (or `## weave change` cross-references) mentions `implementation` and `review` as accepted lane values.
- [x] `README.md` lists `weave-ship` in the `## Using Weave Skills` skills table.
- [x] A release-notes draft (e.g. `CHANGELOG.md` entry, `RELEASE-NOTES.md`, or `weave-it/release-notes-<version>.md`) calls out the four user-facing changes listed under `Architecture` -> `Rollout and Migration`.
- [x] `npm run typecheck` clean; `npm test` green; `npm run build` green.

---

## Out of Scope (deferred per architecture)

The following items are deferred and will not be addressed by these slices. See `architecture.md` -> `Open Technical Questions` and `Product Questions Raised by Technical Design` for context:

- OTQ-1: Foreign-knowledge cross-reference refinement (v2).
- OTQ-2: `tasks.md` populated heuristic precision (depends on `weave-implement`).
- OTQ-3: Pre-commit hook re-modification on retry (broaden vs restrict).
- OTQ-4: Multi-target `weave artifact current set --target`.
- OTQ-5: Lane-skill suggestion footer template structure.
- OTQ-6: `git status` rename-path handling.
- OTQ-7: Concurrent ship serialisation with `--lock`.
- PQ-1: Foreign-knowledge cross-reference policy.
- PQ-2: Lane-keyed "How to review" pointer text wording (architecture proposes reasonable defaults).
- New lane skills (`weave-implement`, `weave-review`).
- Configurable `.weave/config.yml` knobs.
- Native non-GitHub PR creation.
- Closing PRs, merging PRs, branch cleanup after merge.
- Telemetry, usage metrics.

## Publishing

Breakdown is approved but not yet published to a tracker. To publish to GitHub later: run `gh issue create` per slice in dependency order against `arpit016/weave-it`. The previously prematurely-created issue `arpit016/weave-it#1` was closed as `not planned` and should not be re-used.
