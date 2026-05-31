# Session Capture: Exploration - 2026-05-30

## Summary

Pre-exploration discussion (Plan Mode) for adding a single top-level CLI command, `weave ship`, that commits, pushes, and idempotently opens a PR for the active Weave change. The discussion started narrower (artifact-only ship after explore / PRD / architecture) and was widened mid-session: ship must work in every lane (exploration, PRD, architecture, implementation, review). The "non-artifact leak" guard therefore became lane-aware: what counts as in-scope vs leaked is decided by the `stage` field inside the per-change `status.yml` rather than a single fixed allow-list. A thin `weave-ship` skill that wraps the CLI was also accepted; new lane skills (`weave-implement`, `weave-review`) were deferred.

## Decisions Made

- New command is top-level: `weave ship` (not `weave artifact ship`). Ship operates on the active change, not a specific artifact.
- Trigger model: explicit CLI only. Skills never run git themselves; they print a `weave ship` suggestion at end of flow.
- Skill surface: add a thin `weave-ship` skill that synthesizes commit/PR text from change state and invokes the CLI in normal mode; in Plan Mode the skill stops at synthesis. Defer adding `weave-implement` / `weave-review` skills. Update existing lane skills (`weave-explore`, `weave-prd`, `weave-architect`, `weave-capture`) to print the suggestion line.
- Lane-aware scope table is driven by the `stage` field of `wiki/changes/<id>/status.yml`:
  - `exploration` / `prd` / `architecture`: in-scope = `wiki/changes/<id>/**`, `wiki/knowledge/**`, `.weave/sync.yml`. Leaks = `src/**`, `tests/**`, `templates/**`, `package*.json`, root configs.
  - `implementation` / `review`: in-scope = everything above plus `src/**`, `tests/**`, `templates/**`, `package.json`, `package-lock.json`, root configs.
  - Unknown stage: fall back to permissive impl-lane scope and print a warning naming the unknown value.
- Guard behaviour: leaked dirty files block ship by default. `--stash` auto-stashes them, runs ship, restores on exit. If restore conflicts, leave the stash ref intact and report it.
- Guard location: commit-time only. Lane-skill invocation does not assert a clean worktree.
- Per-invocation semantics: commit + push every time. PR opened the first time; on later invocations the existing PR URL is detected and printed.
- Commit message: `<type>(<change-id>): <stage> - <title>` with `type`, `title`, `stage` read from the per-change `status.yml`. Body lists changed in-scope files plus the `## Summary` of the latest session note for the active stage when present.
- PR title: `<type>: <title>`. PR body: templated block with title, current stage, links to existing change artifacts, and a "How to review" pointer derived from stage.
- Base branch: auto-detect via `git symbolic-ref refs/remotes/origin/HEAD`, fall back to `main`.
- PR tooling: `gh` with graceful fallback. When `gh` is missing or the remote is non-GitHub, push still completes and the CLI prints the host-appropriate compare URL when recognisable (github.com / gitlab.com / bitbucket.org).
- Multi-target / propagated changes: iterate each target independently (each its own git root). Per-target outcome reported. Any failure -> non-zero exit; remaining targets still attempt.
- Branch precondition: refuse unless current branch is `change/<active-change-id>`. Suggest `weave change switch <id>`.
- Push: first time `git push -u origin HEAD`; subsequent pushes plain `git push`.
- Hooks: respected. If pre-commit auto-modifies files, re-stage + retry once.
- Nothing to commit: skip commit silently, still push (catches earlier local commits), still ensure PR exists. Print `No in-scope changes to commit.`.
- Config: no `.weave/config.yml` in v1. Defaults + flags only.

## Options Considered

- **Trigger model**: explicit CLI [chosen]; auto-on-capture; skill-prompt-inline; hybrid `--ship` flag on capture.
- **Scope of artifact files (initial framing)**: change-folder + knowledge [chosen]; change-folder only; all of `wiki/**`; stage-tightened.
- **Guard action**: block + auto-stash via flag [chosen]; warn only; block hard; block with `--allow-impl` override.
- **Guard location**: commit time only [chosen]; commit + skill invocation; skill invocation only.
- **Command shape**: single `ship` with idempotent PR [chosen]; primitives + ship; ship only; three primitives only; under `weave change` namespace.
- **Skill suggestion**: `weave ship` one-liner [chosen]; explicit 3-step; commit only.
- **Commit/PR metadata source**: status.yml + latest session note `## Summary` [chosen]; skill-supplied hint; minimal template; prompt user.
- **Base branch**: auto-detect from `origin/HEAD` [chosen]; always `main`; configurable via file.
- **PR tooling**: `gh` with fallback [chosen]; hard require `gh`; pluggable provider abstraction; manual-only.
- **Multi-target**: iterate independent [chosen]; first-target only; all-or-nothing.
- **Branch precondition**: require `change/<id>` [chosen]; warn-and-proceed; no check.
- **Hooks policy**: respect with one retry [chosen]; respect strict; skip via `--no-verify`.
- **Config**: none in v1 [chosen]; add `.weave/config.yml`.
- **Lane scope rule (post-widening)**: stage-driven table [chosen]; two buckets only; no scope guard at all; `scope.yml` per change.
- **Skill surface**: `weave-ship` skill, defer impl/review skills [chosen]; CLI only; ship + impl/review skills together; CLI only without any new skills.

## Rejected Approaches

- Auto-running git on capture success (too surprising; mixes CLI-state ownership with skill synthesis).
- Hard-requiring `gh` (breaks teams without GitHub or without gh installed).
- Folding ship into the `weave change` namespace (would conflate publishing with lifecycle).
- A scope manifest (`scope.yml`) per change (too much setup for v1; the stage table covers the common cases).
- Adding `weave-implement` / `weave-review` skills now (out of scope; ship CLI must work without them).
- Adding `.weave/config.yml` for ship knobs in v1 (defaults + flags are enough).

## User Preferences

- Plan Mode discipline: artifacts are not written until the user exits Plan Mode and explicitly asks to start the change.
- Single-command UX preferred over multi-step primitives.
- Skill responsibilities should stay thin; the CLI owns mutating state.
- Avoid premature config files; ship with sensible defaults.

## Agent Recommendations

- Lock the stage-advancement mechanism in the PRD lane before architecture: without it the lane-aware guard is wrong in practice (every change reads `stage: exploration` forever today, since `createChange` is the only writer of the field — see `statusTemplate` in [src/lib/changes.ts](src/lib/changes.ts)).
- Lift `git`, `gitRequired`, and `currentBranch` from `src/lib/changes.ts` into `src/lib/git.ts` so ship and existing change commands share one git wrapper layer.
- Keep the lane-scope table in its own module (`src/lib/lane-scope.ts`) so it has a single source of truth and can be exhaustively tested.
- Make `--stage <name>` an early-released override on `weave ship` regardless of the chosen advancement mechanism, so users can unblock themselves while the broader stage flow stabilises.

## Unresolved Points

- Stage advancement mechanism (skill auto-bump on first next-artifact write, dedicated `weave change advance --to <stage>` command, dirty-mix inference, or combination + `--stage` flag).
- JSON output shape of `weave ship --json` (proposed: per-target `{ commit_sha, pushed, pr_url, pr_action: opened|existing|skipped, guard: { ok | blocked, leaked_files: [...] }, lane_used }`).
- Whether the lane-skill suggestion is conditional on detecting dirty in-scope files or printed unconditionally.
- Draft vs ready PR default. Possibly stage-driven (early lanes draft, implementation/review ready), but unconfirmed.
- How ship treats `wiki/knowledge/**` updates that are unrelated to the active change (bundle into the change PR vs warn naming each foreign-knowledge file).
- Whether `--stash` should persist the stash ref to a session note (e.g. `sessions/<date>-<id>-stash.txt`) for traceability.
- `gh` installed but unauthenticated UX: skip silently vs print `gh auth login` instruction vs fail loudly.
- Skill-vs-CLI responsibility split: does `weave-ship` ever override the CLI's commit message / PR body templates, or always defer to them?

## Live Artifact Updates Applied

- Replaced placeholder sections in `wiki/changes/260530-hb8a-weave-ship-command-for-git-automation/exploration.md` with the topic restatement, current understanding, decisions, scenarios, existing behavior, and PRD readiness from this session.
- Listed the open questions above as the Open Questions section in the live artifact (verbatim source of truth for the PRD lane).

## Next Resume Point

Resolve the stage-advancement mechanism first (decision blocks the PRD lane). Then convert the remaining open questions into PRD decisions via `/weave-prd`.
