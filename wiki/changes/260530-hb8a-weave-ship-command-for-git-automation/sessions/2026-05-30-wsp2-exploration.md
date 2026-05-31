# Session Capture: Exploration - 2026-05-30

## Summary

Second exploration round (Plan Mode) for `weave ship`, resuming from `2026-05-30-wsp1-exploration.md`'s next-resume-point. The round resolved all four PRD-blocking open questions and the four secondary unresolved points. The biggest shift came from a user push-back on stage advancement: the existing `weave artifact current` signal (already set by lane skills on entry, already mutable in any direction) is sufficient for tracking the active lane, so ship does not need a `status.yml.stage` source-of-truth or a new `weave change advance` command. `ArtifactName` will be extended to include `implementation` and `review` to keep that signal expressive across all lanes. Draft-vs-ready PR is lane-driven with one-way auto-promotion. The `weave-ship` skill adds preflight + append-only narrative enrichment on top of the CLI's authoritative templates, and warns + asks for explicit confirmation when preflight finds something unusual. Conditional lane-skill suggestion lines fire on lane-artifact write events. Foreign-knowledge bundling, stash persistence, and gh-unauthenticated UX defaults were locked. The exploration is now `Ready` for `weave-prd`; only the JSON output shape remains and is technical (deferred to architecture).

## Decisions Made

- **Lane source-of-truth (revised)**: lane is resolved by, in priority order: (1) `--lane <name>` CLI flag, (2) `weave artifact current` value for the active change, (3) artifact-presence inference (weave-next-style: populated `tasks.md` -> implementation; `architecture.md` -> architecture; `prd.md` -> prd; otherwise exploration). No new advancement mechanism is introduced.
- **`status.yml.stage`** is downgraded to a display cache. It will be updated by the same skills/CLI that set artifact context. It is read by `weave change list/current/status` for at-a-glance output. The lane-aware guard does not consult it.
- **`ArtifactName` extension**: extend to include `implementation` and `review`. Naming dissonance (no `<lane>.md` artifact files for those values) is captured as a technical implication for the architecture lane.
- **No `weave change advance` command**. Backward lane moves are free via `weave artifact current set <name>`.
- **Draft vs ready PR**: lane-driven with auto-promotion.
  - First-open: draft for `exploration` / `prd` / `architecture`; ready for `implementation` / `review`.
  - Auto-promote draft -> ready when lane crosses into `implementation` / `review`.
  - Never auto-demote ready -> draft.
  - `--draft` / `--ready` CLI flags override at any time.
- **Skill-vs-CLI split**: CLI templates are authoritative for metadata. Skill may pass `--message-body <text>` to enrich commit body and `--pr-body-extra <text>` to append a "Decisions made this session" block to the templated PR body. PR title is CLI-only. PR body templated metadata block is CLI-only (skill cannot replace, only append).
- **Skill preflight policy**: skill warns and asks for explicit confirmation before invoking the CLI when preflight finds something unusual (e.g. shipping a `Not ready` exploration from PRD lane).
- **Lane-skill suggestion conditionality**: print conditionally, tied to lane-artifact write events. End of capture / lane skill flow with a fresh artifact write -> "Run `weave ship` to commit, push, and open a PR.". Entry of a next-lane skill when prior-lane artifact is uncommitted -> "Run `weave ship` first to commit your <lane> work before continuing.". Silent when no dirty in-scope files.
- **Foreign-knowledge bundling**: bundle dirty `wiki/knowledge/**` files unrelated to the active change into the change PR but warn, listing each foreign-knowledge file in the ship output for later split.
- **`--stash` ref persistence**: print stash ref + recovery commands (`git stash list`, `git stash pop <ref>`) on restore failure. No file is written under `sessions/` or `.weave/`.
- **gh installed but unauthenticated**: non-fatal warn. Push completes. PR step skipped. Print `gh auth login` instruction + compare URL. Exit 0. User reruns ship after authenticating.

## Options Considered

- **Stage advancement mechanism**: hybrid (skill auto-bump forward + `weave change advance` for any direction + `--stage` override) [initially recommended, then displaced]; auto-bump only; explicit command only; approval-gated; **use existing `weave artifact current` instead** [chosen].
- **Backward stage moves**: any-direction; forward-only; allowed with `--allow-backward` warning. Resolved by the artifact-current approach (any direction is free).
- **`status.yml.stage` fate**: delete; **keep as display cache** [chosen]; repurpose for change-level lifecycle (open / shipped / abandoned).
- **Implementation / review lanes signal**: **extend `ArtifactName` to include them** [chosen]; don't extend, use inference + `--lane`; add a separate `weave change lane <name>` command.
- **Draft vs ready PR**: **lane-driven with auto-promotion** [chosen]; always draft; always ready; lane-driven without auto-promotion.
- **Skill split**: **preflight + narrative enrichment with append-only PR body** [chosen]; pure wrapper; skill owns all generated text; preflight-only.
- **Preflight blocking**: warn-only; **warn and ask for explicit confirmation** [chosen]; block by default with `--force`.
- **Suggestion conditionality**: **conditional, tied to lane-artifact write events** [chosen]; unconditional; no suggestion at all.
- **Foreign-knowledge files**: **bundle but warn** [chosen]; exclude (require separate ship); bundle silently.
- **Stash persistence**: **print only, no file** [chosen]; persist to `sessions/`; persist to `.weave/`.
- **gh unauthenticated UX**: **non-fatal warn, exit 0** [chosen]; fail with non-zero exit; silent skip.

## Rejected Approaches

- Hybrid auto-bump + explicit command + override: rejected once it became clear the existing `weave artifact current` signal already covers the same territory without new state.
- A new `weave change advance --to <stage>` command: redundant given `weave artifact current set`.
- Approval-gated stage advancement (advance only on artifact `approved`): defers on a flow that doesn't exist yet; over-rigorous for v1.
- Inference-only lane resolution (look at dirty file mix): magical and fragile; rejected as primary signal but kept as the third-priority fallback.
- Forward-only lane moves: would prevent legitimate re-exploration during PRD or architecture rounds.
- "Always draft" or "always ready" PR: defeats the lane-aware purpose of the design.
- Skill owning all generated text: too much variability; CLI-only baseline must remain meaningful.
- Unconditional suggestion line: noisy when nothing is dirty.

## User Preferences

- Prefer reusing existing primitives over introducing new state. The artifact-context approach won precisely because it required no new mechanism.
- Backward lane moves are normal product activity; they should be cheap.
- Skill should add value beyond a courtesy alias - preflight + narrative enrichment is the right kind of value.
- Suggestion lines should fire only when they are actually actionable.

## Agent Recommendations

- Lift the `git`, `gitRequired`, and `currentBranch` helpers from `src/lib/changes.ts` into `src/lib/git.ts` before adding ship plumbing, so both feature areas share one git-wrapper layer.
- Keep the lane-resolution logic and the lane-scope table in dedicated modules (`src/lib/lane-resolution.ts` and `src/lib/lane-scope.ts`) for testability and a single source of truth.
- The `ArtifactName` extension introduces a real naming dissonance because `implementation` and `review` have no `<lane>.md` file. Architecture lane should decide whether to (a) introduce a separate `LaneName` superset, (b) accept the dissonance and have `artifactFileName` return `undefined` / throw for the new values, or (c) rename `ArtifactName` internally to `LaneName` and adapt callers.
- The display-cache update path for `status.yml.stage` should live in `src/lib/artifact-context.ts`'s `setCurrentArtifact`, so any caller that updates artifact context also updates the display cache atomically.

## Unresolved Points

- **JSON output shape of `weave ship --json`** (technical, deferred to architecture lane). Proposed shape: per-target object with `lane_used`, `lane_source: "flag" | "artifact_current" | "inferred"`, `commit_sha`, `pushed`, `push_set_upstream`, `pr_url`, `pr_action: "opened_draft" | "opened_ready" | "promoted_to_ready" | "existing" | "skipped_no_gh" | "skipped_unauth" | "skipped_non_github"`, `guard: { ok, leaked_files }`, `stash: { used, restored, ref? }`, `foreign_knowledge_files`. Architecture lane confirms field names and pairs them with an exit-code map.

## Live Artifact Updates Applied

- Rewrote `## Topic` to drop the `status.yml.stage` framing and use the artifact-context-based lane resolution.
- Updated `## Current Understanding` to reflect that lane is already trackable today via `weave artifact current` and to drop the "stage never advances" framing as a blocker.
- Replaced the `## Open Questions` section with the single remaining technical question (JSON output shape).
- Promoted all round-2 resolutions into `## Decisions`. Reworked the lane-aware scope table to be lane-driven instead of stage-driven.
- Updated `## Scenarios` to use lane terminology and to add the auto-promotion, conditional-suggestion, lane-mismatch, backward-move, and gh-unauthenticated scenarios.
- Updated `## Existing Behavior` to add the artifact-context observations (already set by lane skills on entry; supports `exploration | prd | architecture` today).
- Flipped `## PRD Readiness` from `Not ready` to `Ready`.
- Updated frontmatter `updated_at` to `2026-05-30`.

## Next Resume Point

Run `/weave-prd` to convert the now-Ready exploration into `prd.md`. The PRD lane should formalise (1) the user-facing CLI behaviour around `weave ship`, (2) the `weave-ship` skill flow including preflight + confirmation prompts, and (3) acceptance criteria for the lane-aware guard. The remaining technical question (JSON shape) belongs in the architecture lane after the PRD lands.
