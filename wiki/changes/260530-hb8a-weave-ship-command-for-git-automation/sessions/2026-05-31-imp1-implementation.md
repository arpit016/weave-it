# Session Capture: Implementation - 2026-05-31

## Summary

First implementation-lane session for the `weave ship` change. Executed all 11 vertical slices from `tasks.md` end-to-end, in dependency order: foundational refactors first (1, 2), tracer-bullet ship (3), then feature dimensions (4-10) and docs (11). Implementation tracks `architecture.md` faithfully — no architecture decisions revisited. Verification at the end: `npm run typecheck` clean, `npm test` green (91 tests across 7 files; +30 new tests covering git wrappers, lane widening, and ship orchestration), `npm run build` green. The `weave ship` command is registered in `weave --help` and its own `--help` lists every flag from the spec. Branch is `change/260530-hb8a-weave-ship-command-for-git-automation`; nothing has been committed or pushed yet — the first ship is intentionally deferred until after this session capture so the user can review the diff in one piece.

## Decisions Made

- **DEC-IMP-1. Stash restore lifecycle in `shipOneTarget`**: split per-target work into `shipOneTarget` (outer) and `shipOneTargetInner` so the stash always pops in a finally-style block, even when commit/push/PR fail. Restore status reflected in `ShipTargetResult.stash.restored` and `stash.conflict`.
- **DEC-IMP-2. `git status -z` parsing must not go through the trimming `git()` wrapper**: the porcelain format starts with a leading space character for unstaged-only changes (e.g. `' M wiki/x.md'`); `String.prototype.trim()` ate that space and shifted every path one byte. Added a private `gitRaw(args, cwd)` helper in `git-ops.ts` that returns raw stdout. The trimming `git()` wrapper stays the right choice everywhere else.
- **DEC-IMP-3. Bundled foreign-knowledge files emit a stderr warning at stage time**: matches AD-9 ("bundle into the commit and list in `ShipTargetResult.foreign_knowledge_files`") and gives the user a visible breadcrumb so the bundling never feels silent.
- **DEC-IMP-4. Lane resolution is async**: `resolveLane()` calls `inferLaneFromArtifacts()` (which reads `tasks.md`, `architecture.md`, `prd.md`) when neither the `--lane` flag nor a session-tracked lane is present. Sync inference would have either broken the artifact-presence rule or required pre-loading.
- **DEC-IMP-5. Multi-target ship anchors on the cwd's active change**: orchestrator first resolves the cwd target, then expands to all session folders whose `current_change.id` equals the anchor change id. `--target all` is honoured directly without the expansion step. Filesystem-based discovery was already rejected in AD-2.
- **DEC-IMP-6. Pre-commit hook retry: re-stage the same file list and retry `git commit` once**: matches the architecture's "single retry on hook auto-modification" rule. If the second commit also fails, surface `commit.skipped: true` with `reason: "hook_failed"`. Resolves OTQ-3 in the simplest direction (re-stage original list only; no broadening).
- **DEC-IMP-7. PR-skip checks must run AFTER `gh` availability and auth, not before**: tested both orders; running `getRemoteUrl()` first caused `skipped_non_github` to mask `skipped_unauth` in environments where origin happens to be a non-GitHub mirror. Architecture's intent is "give the user the most actionable next step"; `unauth` is more actionable than `non_github` because the user can run `gh auth login`. Final order: `no_gh -> unauth -> no_remote -> non_github`.
- **DEC-IMP-8. Test fixture uses `git remote set-url --push origin <fake-bare>` instead of replacing origin**: keeps `git config --get remote.origin.url` returning the github.com URL (so `parseGithubRepo` succeeds) while letting `git push -u origin HEAD` actually push to a local bare repo. Avoids the "non_github masks the test" trap from DEC-IMP-7.

## Options Considered

- **Stash on guard block, default vs opt-in**: kept `--stash` as opt-in per AD-7. Considered making stash automatic, rejected — silently mutating the user's working tree without consent violates the "guard tells you what's wrong, you fix it" UX.
- **Where to put the foreign-knowledge stderr warning**: at stage time vs at commit time vs at completion. Chose stage time so the warning prints before any side effect that depends on the bundling.
- **Async vs sync lane resolution**: sync would have meant either dropping artifact-presence inference (regression vs architecture) or pre-loading the artifact set into the session. Both worse than `await`-ing one disk read.

## Rejected Approaches

- **Pre-flight gh/remote check at orchestrator start**: would have aborted multi-target runs because of one bad target. AD-6 already rejected this; implementation honours it.
- **Caching PR URLs in session state**: AD-4 already rejected (no new persistent state). Each ship re-derives via `gh pr view --json url,number,isDraft,state`.
- **Treating `.weave/sync.yml` as in-scope for any lane**: it is not. Tests that produced dirty `.weave/sync.yml` were rewritten to commit it before the ship test runs.

## User Preferences

- "Keep everything as is to verify once" — implementation proceeded without revisiting architecture or PRD; final verification batched into a single `typecheck && test && build` run at the end.
- Wants to bootstrap-dogfood: the first real `weave ship` run will be the one that lands `weave ship` itself.
- Wants to stop before commit/push so the diff can be reviewed in a single piece before going to remote.

## Agent Recommendations

- After this session, run `weave ship --json` from this branch. Implementation lane is now the resolved lane (auto-detected via `tasks.md` heuristic AND mirrored to `status.yml#stage` AND set as the current artifact context — three independent signals all agree).
- Expect: one commit with subject `feat(260530-hb8a-weave-ship-command-for-git-automation): implementation - Weave ship command for git automation`, push with `-u origin HEAD`, and a ready (non-draft) PR opened via `gh pr create`.
- After landing, the open technical questions OTQ-1 through OTQ-7 remain deferred per the architecture session's resolution. They do not block the v1 ship.

## Unresolved Points

- No new unresolved technical points. All seven OTQs and both PQs from architecture remain explicitly deferred.
- Future enhancement (out of v1 scope): `weave-implement` skill that walks `tasks.md` slice-by-slice. Today the human/agent picks slices manually.

## Live Artifact Updates Applied

- `tasks.md` — flipped 90 acceptance-criteria checkboxes from `[ ]` to `[x]`, set frontmatter `status: complete`, and added an "Implementation Status" summary table mapping each of the 11 slices to its final state plus the verification batch (`typecheck`/`test`/`build`).
- `status.yml` — `stage: implementation` (mirrored automatically by `weave artifact current set implementation`; updated_at bumped accordingly).
- No edits to `exploration.md`, `prd.md`, or `architecture.md`. Architecture and PRD are still the contract; nothing in implementation contradicted them.

## Next Resume Point

Run `weave ship --json` from `change/260530-hb8a-weave-ship-command-for-git-automation`. This is the first real ship and will exercise: implementation-lane scope partition (everything under `src/**`, `tests/**`, `templates/**`, `wiki/changes/<id>/**`, `README.md`, `package.json`); commit subject formatter; `git push -u origin HEAD`; `gh pr create` with the ready posture (impl-lane default, no `--draft`); and the structured `ShipResult` JSON. If anything in the result is unexpected, the structured `targets[]` payload is the canonical source — message text is human-friendly only.
