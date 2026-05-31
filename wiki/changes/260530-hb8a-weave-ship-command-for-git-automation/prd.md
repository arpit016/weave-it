---
artifact: prd
status: draft
owner: product
created_at: 2026-05-30
updated_at: 2026-05-30
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Weave Ship Command For Git Automation PRD

## Problem Statement

Developers using Weave-It capture product, PRD, and architecture work in artifact files (`exploration.md`, `prd.md`, `architecture.md`, plus session notes) under `wiki/changes/<id>/`. Each change lives on its own `change/<id>` branch.

To get those artifacts into a reviewable pull request today, developers must run a multi-step git sequence themselves: stage the changed files, write a commit message that includes the change id and lane, push the branch (with `-u origin HEAD` the first time), then either click around GitHub or run `gh pr create` separately, then later mark the PR ready when implementation lands.

This sequence is error-prone:

- Developers frequently forget the upstream flag and have to rerun push.
- Commit messages get sloppy (no change id, no lane signal).
- Implementation code (`src/**`, `tests/**`) sometimes leaks into commits made during exploration / PRD / architecture lanes, polluting docs-only PRs.
- Conversely, foreign artifact updates (`wiki/knowledge/**` unrelated to the active change) can leak into implementation commits.
- Reviewers get pinged prematurely on docs-only PRs because the PR is opened ready instead of draft.
- Multi-target propagated changes (one Weave change spanning multiple repos) require running the same sequence per repo.

The user's mental model is "ship this lane": one operation, lane-aware, idempotent, safe.

## Goals

- Provide a single CLI command, `weave ship`, that commits, pushes, and idempotently opens or tracks a PR for the active change.
- Make the operation lane-aware: the set of files staged and the leak guard's allow-list adapt to the user's current lane (`exploration`, `prd`, `architecture`, `implementation`, `review`).
- Make the PR draft/ready state match the lane: early-lane PRs open as drafts; implementation/review PRs open ready or auto-promote draft to ready.
- Make ship idempotent: subsequent invocations do not open duplicate PRs.
- Provide a thin `weave-ship` skill that adds preflight checks and append-only narrative enrichment on top of the CLI.
- Make ship safe: leaked non-lane files block the operation by default, with a `--stash` escape hatch.
- Keep the CLI usable without the skill: typing `weave ship` in a terminal must always produce a coherent commit and PR.

## Non-Goals

- Approval workflow or artifact lifecycle status changes (`reviewed`, `approved`).
- Automatic stage advancement of `status.yml`'s `stage` field. Lane is read from `weave artifact current` instead.
- A new `weave change advance` command, or any explicit lane-promotion command.
- Adding `weave-implement` and `weave-review` skills (deferred).
- Configurable `.weave/config.yml` knobs in v1. Defaults plus CLI flags only.
- Closing PRs, merging PRs, branch cleanup after merge.
- Native non-GitHub PR creation. GitLab and Bitbucket fall back to compare-URL printing.
- Custom commit-message and PR-body templates beyond the skill's append-or-replace surface.
- A web UI or IDE integration. CLI plus skill only.

## Actors

- **Developer**: the primary user. Runs `weave ship` directly in a terminal or invokes the `weave-ship` skill via an AI agent.
- **AI agent (Claude / Codex / OpenCode / Cursor / etc.)**: invokes the `weave-ship` skill and the lane skills (`weave-capture`, `weave-explore`, `weave-prd`, `weave-architect`).
- **Reviewer**: a teammate who reviews the PR. Notified by GitHub when the lane is `implementation` or `review` (PR is ready). Not pinged for early-lane shipments (PR is draft).
- **CI / automation**: scripted callers using `weave ship --json` for machine-readable output.
- **GitHub** (host): PR creation, draft promotion, and PR URLs are mediated by `gh`. Other hosts fall back to compare-URL printing.

## Current Behavior

Weave-It already provides:

- `weave change new <title>`: creates `wiki/changes/<id>/`, writes `status.yml` and a scaffolded `exploration.md`, creates and checks out the `change/<id>` branch.
- `weave change switch <ref>` and `weave change propagate`: enforce a clean worktree via an internal `assertCleanGitTargets` helper before changing change context.
- `weave artifact current set <name>`: per-user session-state pointer to which artifact (`exploration` / `prd` / `architecture`) the user is currently focused on. Lane skills already call this on entry.
- Existing git plumbing in `src/lib/git.ts` and `src/lib/changes.ts`: `findGitRoot`, `getGitRemote`, a private `currentBranch`, `ensureChangeBranch`, `assertCleanGitTargets`.

Weave-It does **not** provide:

- A commit, push, or PR-open command.
- Any automation around shipping change artifacts.
- A lane-aware leak guard.
- An end-of-flow shipping suggestion in the lane skills.

To get a change PR today, a developer must:

1. Run `git status` and inspect what is staged or dirty.
2. `git add wiki/changes/<id>/<files>` (and remember to add session notes and any knowledge updates).
3. `git commit -m "<message-they-type-by-hand>"`.
4. `git push -u origin HEAD` first time, plain `git push` after.
5. `gh pr create --draft` (with title and body they write by hand) or open GitHub in a browser.
6. When implementation lands, run `gh pr ready` themselves to take the PR off draft.
7. Repeat the entire sequence per repo for multi-target propagated changes.

## Proposed Product Behavior

Add a single top-level command `weave ship` that runs the full sequence on behalf of the developer.

`weave ship` runs in the active change's git root and:

1. Refuses to run unless the current branch is `change/<active-change-id>`. If not, it suggests `weave change switch <id>`.
2. Determines the active **lane** by looking at, in priority order:
   - The `--lane <name>` CLI flag.
   - The `weave artifact current` value for the active change.
   - Inference from artifact presence on disk (populated `tasks.md` -> `implementation`; `architecture.md` -> `architecture`; `prd.md` -> `prd`; otherwise `exploration`).
3. Computes the **in-scope** file set and the **leak** file set from the lane-aware scope table.
4. Runs the **leak guard**. If any leaked files are dirty, ship blocks with a list of leaked paths and a hint to use `--stash`.
5. Stages all in-scope dirty files. Detects "foreign-knowledge files" (dirty `wiki/knowledge/**` paths unrelated to the active change). Bundles them into the commit and reports them in the output.
6. If there is nothing in-scope to commit, prints `No in-scope changes to commit.` and skips the commit step.
7. Otherwise creates a commit with message `<type>(<change-id>): <lane> - <title>` and a body listing changed in-scope files plus the `## Summary` excerpt from the latest session note for the active lane (when present).
8. Pushes the branch. First push uses `git push -u origin HEAD`; subsequent pushes use plain `git push`.
9. If a PR already exists for this branch, prints its URL.
   - If lane is `implementation` or `review` and the PR is currently draft, auto-promotes draft to ready via `gh pr ready`.
   - Otherwise leaves PR state unchanged.
10. If no PR exists, creates one via `gh pr create`. Draft when lane is `exploration` / `prd` / `architecture`; ready when lane is `implementation` / `review`. Title `<type>: <title>`. Body is a templated metadata block (title, lane, links to existing change artifacts, "How to review" pointer derived from lane).
11. For multi-target propagated changes, repeats steps 1-10 in each target repo. Per-target outcome is reported.
12. Prints a summary including the commit SHA, push status, PR URL, leak status, foreign-knowledge files, and stash status (if `--stash` was used).

The new `weave-ship` skill wraps the CLI to add value:

- **Preflight check**: reads `exploration.md` (`Open Questions`, `PRD Readiness`), the latest session-note `Unresolved Points` for the active lane, and warns about anything unusual (e.g. shipping a `Not ready` exploration from the PRD lane).
- **Append-only enrichment**: optionally synthesizes a multi-session "Decisions made this session" block. Passes it via `--message-body <text>` (commit body) and / or `--pr-body-extra <text>` (appended to the templated PR body).
- **Ask-before-invoke**: when preflight surfaces something unusual, the skill warns and asks for explicit confirmation before invoking the CLI.
- **Plan-Mode aware**: in Plan Mode the skill prints preflight findings, the proposed commit message, and the appended PR body, then stops. No CLI invocation.

The lane skills (`weave-capture`, `weave-explore`, `weave-prd`, `weave-architect`) print a conditional `weave ship` suggestion line:

- After capture / lane-skill flow writes a fresh artifact: `Run weave ship to commit, push, and open a PR.`.
- At entry of next-lane skill when prior-lane artifact is uncommitted: `Run weave ship first to commit your <lane> work before continuing.`.
- Silent when no in-scope dirty files exist for the active change.

## User Workflows

### Workflow: Developer ships exploration

1. Developer opens the change branch and edits `exploration.md`, then runs `/weave-capture` (or directly edits the file).
2. `weave-capture` writes the artifact and a session note, then prints `Run weave ship to commit, push, and open a PR.`.
3. Developer types `weave ship`.
4. Ship resolves lane = `exploration` (from `weave artifact current`).
5. Ship runs the leak guard; the worktree is clean except for the change folder. Guard passes.
6. Ship stages `wiki/changes/<id>/exploration.md` and `wiki/changes/<id>/sessions/<file>.md`.
7. Ship creates a commit `feat(<id>): exploration - <title>` with a body listing the staged files.
8. Ship pushes with `-u origin HEAD`.
9. Ship calls `gh pr create --draft` and prints the PR URL.

### Workflow: Developer ships PRD on top of an existing draft PR

1. Developer runs `/weave-prd`, which sets artifact context to `prd` and writes `prd.md` (and a session note).
2. `weave-prd` prints the conditional ship suggestion.
3. Developer types `weave ship`.
4. Ship resolves lane = `prd`.
5. Ship stages the prd-related files and commits `feat(<id>): prd - <title>`.
6. Ship pushes.
7. Ship detects the existing draft PR via `gh pr view --json url,isDraft`. Prints its URL. Does **not** promote (lane is still PRD).

### Workflow: Developer ships first implementation work (with auto-promotion)

1. Developer either (a) runs a future `/weave-implement` skill, (b) sets lane manually via `weave artifact current set implementation`, or (c) passes `--lane implementation` to ship.
2. The worktree contains dirty `src/**`, `tests/**`, and `wiki/changes/<id>/tasks.md`.
3. Developer types `weave ship`.
4. Ship resolves lane = `implementation`.
5. Ship's scope table includes `src/**`, `tests/**`, `templates/**`, `package.json`, `package-lock.json`, root configs, plus the change folder. Guard passes.
6. Ship stages all dirty in-scope files and commits `feat(<id>): implementation - <title>`.
7. Ship pushes.
8. Ship sees the existing draft PR and auto-promotes it to ready via `gh pr ready`.
9. Ship prints PR URL and notes the auto-promotion.

### Workflow: Developer accidentally edits source code during exploration

1. Lane is `exploration`. Developer accidentally edits `src/cli.ts` while exploring.
2. Developer types `weave ship`.
3. Ship's leak guard detects `src/cli.ts` as a leak under exploration scope and prints a "Blocked" message listing the leaked file plus the `--stash` hint.
4. Developer reruns `weave ship --stash`.
5. Ship stashes `src/cli.ts`, runs the guard again (clean), commits, pushes, ensures PR. Restores the stash on exit.
6. If restore conflicts, ship prints the stash ref and recovery commands (`git stash list`, `git stash pop <ref>`).

### Workflow: Developer with no `gh` installed

1. Developer types `weave ship`.
2. Ship runs guard, commits, pushes successfully.
3. Ship checks for `gh`: not installed. Prints `gh not installed; PR step skipped. Compare URL: <github.com/.../compare/...>`. Exits 0.

### Workflow: Developer with `gh` installed but unauthenticated

1. Developer types `weave ship`.
2. Ship commits and pushes.
3. Ship runs `gh auth status`; non-zero exit. Prints `gh is installed but unauthenticated; run gh auth login to enable PR creation. Push completed; PR step skipped. Compare URL: <...>`. Exits 0.
4. After running `gh auth login`, the developer reruns `weave ship`. Step 8 succeeds and the PR opens.

### Workflow: Developer ships across multiple targets

1. Active change has two propagated targets in different repos.
2. Developer runs `weave ship` from one of them.
3. Ship iterates each target's git root: in target A, commits / pushes / opens PR; in target B, same.
4. Ship prints per-target outcomes.
5. If target A succeeds and target B fails, ship reports both outcomes and exits non-zero.

### Workflow: AI agent invokes the weave-ship skill (normal mode)

1. User says `/weave-ship` to the agent.
2. Agent reads change state, the latest session note for the active lane, exploration.md `Open Questions`, and `PRD Readiness`.
3. Preflight finds an unusual condition (e.g. `Open Questions` non-empty for current lane). Agent warns and asks for confirmation.
4. User confirms.
5. Agent synthesizes optional appended commit body and PR body extra, invokes `weave ship --message-body "..." --pr-body-extra "..."`.
6. Agent reports the CLI's output.

### Workflow: AI agent invokes the weave-ship skill in Plan Mode

1. User says `/weave-ship` while in Plan Mode.
2. Agent runs preflight and synthesis.
3. Agent prints: preflight findings, the proposed commit message, the appended PR body, the resolved lane, the in-scope file list. Stops.
4. No git mutations. No CLI invocation.

## User Stories

1. As a developer, I want a single command to commit, push, and open a PR for my change branch, so that I do not have to remember a multi-step git sequence.
2. As a developer, I want my early-lane PRs to open as drafts, so that reviewers are not pinged before the change is ready for review.
3. As a developer, I want my implementation PRs to open as ready (or auto-promote from draft to ready), so that I do not forget to mark the PR ready when implementation lands.
4. As a developer, I want ship to refuse to commit `src/**` while I am exploring, so that I do not accidentally pollute my docs-only PR with code.
5. As a developer, I want a `--stash` escape hatch when ship blocks me, so that an unexpected leak does not force me to manually `git stash` myself.
6. As a developer, I want ship to be idempotent so that running it twice in a row does not open duplicate PRs.
7. As a developer, I want clear messages when something is blocked or skipped, so that I know exactly what happened and what to do next.
8. As a developer with no `gh` installed, I want ship to still commit and push and tell me the compare URL, so that the absence of `gh` does not break my workflow.
9. As a developer with `gh` installed but unauthenticated, I want ship to tell me to run `gh auth login`, so that I can fix it and rerun.
10. As a developer working on a multi-target propagated change, I want ship to handle every target in one invocation, so that I do not have to repeat the sequence per repo.
11. As a developer in the wrong branch, I want ship to refuse and suggest `weave change switch <id>`, so that I do not accidentally commit on `main`.
12. As a developer who wants to override the resolved lane for one ship, I want a `--lane <name>` flag, so that I can unblock myself without persistently changing artifact context.
13. As a developer who wants to force the PR open as ready (or stay draft) regardless of lane defaults, I want `--ready` and `--draft` flags, so that I can override the default per invocation.
14. As an AI agent, I want a `weave-ship` skill that runs a preflight readiness check, so that I can warn the user before shipping a `Not ready` artifact.
15. As an AI agent, I want to enrich the commit body and PR body with multi-session synthesis, so that the PR captures more rationale than the latest single session note.
16. As an AI agent, I want the lane skills to print a conditional ship suggestion when a fresh artifact has been written, so that the user has an obvious next step.
17. As an AI agent in Plan Mode, I want the `weave-ship` skill to stop at preview, so that no git mutation occurs without the user's explicit consent.
18. As a CI script, I want `weave ship --json` to emit a machine-readable per-target outcome, so that I can chain ship into automation.
19. As a developer who shipped from PRD lane and now wants to revisit exploration, I want to run `weave artifact current set exploration`, ship more exploration changes, and have the leak guard match the new lane, so that backward lane moves are cheap.
20. As a developer who has been implementing for an hour while artifact context still says `exploration`, I want ship to block with a clear message pointing at `weave artifact current set implementation` or `--lane implementation`, so that I can correct the situation immediately.

## Functional Requirements

### Command surface

- The system should expose a top-level `weave ship` command.
- The command should accept these flags: `--lane <name>`, `--draft`, `--ready`, `--stash`, `--message-body <text>`, `--pr-body-extra <text>`, `--json`.
- The command should not introduce any other sub-primitives in v1 (no `weave ship commit`, `weave ship push`, or `weave ship pr`).

### Preconditions

- The system should refuse to run when there is no active Weave change. Error: `No active Weave change. Run weave change new or weave change switch first.`. Exit code 2.
- The system should refuse to run when the current git branch is not `change/<active-change-id>`. Error: `On branch <current>; expected change/<id>. Run weave change switch <id>.`. Exit code 2.
- The system should refuse to run when the cwd is not inside a git repo. Exit code 2.

### Lane resolution

- The system should resolve the active lane in priority order: `--lane` flag, then `weave artifact current` value, then artifact-presence inference.
- The artifact-presence inference rules are: populated `tasks.md` -> `implementation`; `architecture.md` present -> `architecture`; `prd.md` present -> `prd`; otherwise `exploration`.
- The system should accept the lane values: `exploration`, `prd`, `architecture`, `implementation`, `review`.
- If `--lane` is set to a value outside that set, the command should fail fast with a clear error.
- If `weave artifact current` returns a value outside that set, the system should warn naming the unknown value and fall back to permissive impl-lane scope.

### Lane-aware scope

- The system should treat the following paths as in-scope for lanes `exploration`, `prd`, `architecture`:
  - `wiki/changes/<active-change-id>/**`
  - `wiki/knowledge/**`
  - `.weave/sync.yml`
- The system should additionally treat the following paths as in-scope for lanes `implementation`, `review`:
  - `src/**`
  - `tests/**`
  - `templates/**`
  - `package.json`
  - `package-lock.json`
  - root config files (`tsconfig.json`, `tsup.config.ts`, etc.)
- The system should treat any dirty file outside the in-scope set for the resolved lane as a leak.

### Leak guard

- The system should block ship when one or more leaked files are dirty.
- The block message should list each leaked file and suggest `weave ship --stash`.
- When `--stash` is provided, the system should `git stash push` the leaked files, run the rest of ship, and `git stash pop` on exit.
- When the stash restore fails, the system should print the stash ref and recovery commands so the user can recover their work.

### Commit

- The system should stage all in-scope dirty files for commit.
- The system should produce a commit message of the form `<type>(<change-id>): <lane> - <title>` where `type` and `title` are read from `status.yml` and `lane` is the resolved lane.
- The commit body should list the staged files. When a session note for the active lane has a `## Summary` section, the body should append that summary.
- When `--message-body <text>` is passed, the system should substitute the entire commit body with the provided text.
- When there are no in-scope dirty files, the system should skip the commit step and print `No in-scope changes to commit.`.

### Foreign-knowledge files

- The system should detect dirty `wiki/knowledge/**` files that look unrelated to the active change ("foreign-knowledge files").
- The system should bundle foreign-knowledge files into the commit but list them in the per-target output so the user can split them later if needed.

### Push

- The system should push the current branch on every ship invocation.
- The system should set upstream (`-u`) on the first push for a branch (i.e. when `git rev-parse --verify origin/<branch>` fails) and use plain `git push` thereafter.
- When push is rejected (e.g. non-fast-forward), the system should fail with the underlying git error and a hint about pulling or rebasing.

### Pull request

- The system should ensure a PR exists for the change branch.
- When a PR already exists for the branch, the system should print its URL and not open a duplicate.
- When the lane is `exploration`, `prd`, or `architecture` and a PR is being opened for the first time, the system should open it as draft.
- When the lane is `implementation` or `review` and a PR is being opened for the first time, the system should open it as ready.
- When the lane is `implementation` or `review` and an existing PR for the branch is currently draft, the system should auto-promote it to ready (`gh pr ready`).
- The system should never auto-demote a ready PR to draft.
- When `--draft` or `--ready` is passed, the system should override the default for that invocation.
- The PR title should be `<type>: <title>` (read from `status.yml`).
- The PR body should be a templated metadata block including the change id, title, current lane, links to existing change artifacts, and a "How to review" pointer derived from lane. When `--pr-body-extra <text>` is passed, the system should append that text after the metadata block. The metadata block must remain in the body.
- The PR base branch should be auto-detected from `git symbolic-ref refs/remotes/origin/HEAD`, with `main` as the fallback when detection fails.

### Hooks

- The system should respect git hooks (no `--no-verify`).
- When a pre-commit hook auto-modifies staged files, the system should re-stage the modified files and retry the commit once before failing.

### gh availability

- When `gh` is not installed, the system should skip the PR step, print a clear message that `gh` is missing and the PR step was skipped, and print the compare URL when the host is recognised (github.com, gitlab.com, bitbucket.org). Exit 0 if push succeeded.
- When `gh` is installed but `gh auth status` is non-zero, the system should skip the PR step and print `gh is installed but unauthenticated; run gh auth login to enable PR creation. Push completed; PR step skipped. Compare URL: <...>`. Exit 0.
- When the remote host is not recognised, the system should print the branch name and remote URL and skip the PR step. Exit 0.

### Multi-target

- When the active change has multiple targets, the system should run the full ship sequence in each target's git root independently.
- The system should report per-target outcome.
- When any target fails, the system should continue with the remaining targets and exit non-zero at the end.

### Output

- The system should print a human-readable summary by default. When `--json` is passed, it should print a single JSON object with `targets: [<per-target outcome>]`.
- Each per-target outcome should include: `lane_used`, `lane_source`, `commit_sha`, `pushed`, `push_set_upstream`, `pr_url`, `pr_action`, `guard`, `stash`, `foreign_knowledge_files`. The exact field names and exit-code map are confirmed in the architecture lane.

### Skill: `weave-ship`

- The skill should perform a preflight readiness check: read `exploration.md` (`Open Questions`, `PRD Readiness`), the latest session note for the active lane (`Unresolved Points`), and any populated `tasks.md` open items.
- When preflight surfaces an unusual condition (e.g. shipping a `Not ready` exploration from PRD lane, or shipping from `review` lane with open implementation tasks), the skill should print findings and ask for explicit confirmation before invoking the CLI.
- The skill should optionally synthesize an appended commit body via `--message-body` and an appended PR body block via `--pr-body-extra`.
- The skill must not replace the templated PR title or the templated metadata block of the PR body.
- In Plan Mode, the skill should stop at preview: print preflight findings, the proposed commit message, the appended PR body block, the resolved lane, and the in-scope file list. The skill should not invoke the CLI.

### Lane skills: conditional suggestion

- After a lane skill (`weave-capture`, `weave-explore`, `weave-prd`, `weave-architect`) writes or updates a fresh artifact for the active change, the skill should print `Run weave ship to commit, push, and open a PR.`.
- When entering a next-lane skill (e.g. `weave-prd` starting) and the prior lane's artifact for the active change is uncommitted, the skill should print `Run weave ship first to commit your <prior-lane> work before continuing.`.
- When the active change has no dirty in-scope files, the skill should not print a suggestion.

### `status.yml.stage` display cache

- When something updates `weave artifact current` for a change (CLI or skill), the system should mirror that value into the change's `status.yml` `stage` field so that `weave change list / current / status` shows the same value.
- The system should not consult the `stage` field of `status.yml` for any logic decision.

### `ArtifactName` extension

- The system should accept `implementation` and `review` as valid `ArtifactName` values in addition to `exploration`, `prd`, `architecture`.
- For `implementation` and `review`, there is no `<lane>.md` artifact file. APIs that expect an artifact file (`artifactFileName`, `artifactFrontmatter`, `defaultArtifactSource`) need an explicit branch for these lanes that returns appropriate sentinel values or throws a documented error. The architecture lane decides the exact API shape.

## Permissions and Access Control

This change introduces no role-based permission model of its own. Effective permissions follow git and GitHub:

- The user must have write access to the local git repo.
- The user must have push access to the configured remote for `git push` to succeed.
- The user must have `gh` authentication configured for the same GitHub account that has PR-creation permission on the remote repo.
- For multi-target propagated changes, each target repo's permissions apply independently.

The CLI does not consult any Weave-It session state for authorisation; the underlying tools (git, gh) are the gates.

## States and Lifecycle

A change progresses through lanes (in usual order):

```text
exploration -> prd -> architecture -> implementation -> review -> (merged via GitHub)
```

Lane is read from `weave artifact current` (priority: `--lane` flag, then artifact-current, then artifact-presence inference). Lane transitions are driven by:

- **Forward**: a lane skill (e.g. `weave-prd`) calls `weave artifact current set <name>` on entry.
- **Backward**: the user calls `weave artifact current set <name>` directly, in either direction.
- **One-shot**: `weave ship --lane <name>` overrides for a single invocation.

The PR for a change has its own state model:

```text
none -> draft -> ready -> closed | merged
```

- `none -> draft`: ship opens a draft PR when lane is `exploration` / `prd` / `architecture` and no PR exists.
- `none -> ready`: ship opens a ready PR when lane is `implementation` / `review` and no PR exists.
- `draft -> ready`: ship auto-promotes when lane crosses into `implementation` or `review` and a draft PR exists. Or when `--ready` is passed.
- `ready -> draft`: never automatic. Only via `--draft` override.
- `closed | merged`: not handled by ship; outside of GitHub actions.

`status.yml` `stage` is a display cache, kept in sync with `weave artifact current` by the same code path that updates artifact context. It is never consulted by ship's logic.

## Notifications and Visibility

- **Reviewers** are notified by GitHub when a PR transitions from draft to ready (or when opened ready). Ship's lane-driven default ensures reviewers are not pinged for early-lane PRs.
- **CI**: GitHub typically runs CI against ready PRs. Lane-driven defaults align CI runs with implementation work, not docs work.
- **Output**: ship prints a per-target human-readable summary on stdout; warnings go to stderr. With `--json`, all output goes to stdout as a single JSON object.
- **Compare URL**: when the PR step is skipped (no `gh`, unauthenticated, non-GitHub host), the printed compare URL is the fallback so the user can open the PR manually in a browser.

## Edge Cases

- **No `gh` installed**: PR step skipped; commit + push succeed; compare URL printed; exit 0.
- **`gh` installed but unauthenticated**: PR step skipped; `gh auth login` instruction printed; exit 0.
- **Origin is non-GitHub**: PR step skipped; compare URL printed when host is recognised (gitlab.com, bitbucket.org); exit 0.
- **No remote configured**: push step fails; ship exits non-zero with the underlying git error.
- **Worktree clean (nothing dirty)**: ship prints `No in-scope changes to commit.`, push is a no-op, PR URL is printed if one exists.
- **Wrong branch (not `change/<id>`)**: ship refuses; suggests `weave change switch <id>`; exit 2.
- **Stale artifact context**: lane is `exploration` but the user is editing `src/**`. Guard blocks. Suggestion: `weave artifact current set implementation` or `--lane implementation`.
- **Backward lane move**: user did `weave artifact current set exploration` after previously shipping from PRD. The next ship correctly treats the change folder + knowledge as in-scope and would block any leaked impl files.
- **Foreign-knowledge file**: a dirty `wiki/knowledge/**` file unrelated to the active change is bundled into the commit but reported in the output.
- **Pre-commit hook reformats files**: ship re-stages and retries once; if the hook modifies again on retry, ship fails with the hook output.
- **Pre-commit hook fails**: ship fails with the hook output; nothing is pushed.
- **Push rejected (non-fast-forward)**: ship fails; suggests pull or rebase.
- **`gh pr create` fails**: ship reports the gh error; commit + push had succeeded; exit non-zero.
- **`gh pr ready` fails (auto-promotion)**: ship reports the gh error; commit + push had succeeded; exit non-zero.
- **Multi-target partial failure**: target A succeeds, target B fails; both reported; exit non-zero.
- **`--stash` restore conflict**: stash ref printed with recovery commands; ship exits non-zero.
- **Active change with no `status.yml`**: should not happen (`weave change new` always writes it); ship fails fast with a "change folder corrupt" message if it does.
- **`status.yml` lists a `stage` value the system does not recognise**: ignored. The `stage` field is a display cache only; ship's lane resolution never reads it.
- **`weave artifact current` returns an unknown value**: ship warns naming the unknown value and falls back to permissive impl-lane scope.

## Acceptance Criteria

- [ ] User can run `weave ship` and have commit, push, and PR creation occur in one step for the active change.
- [ ] User can run `weave ship --lane <name>` to override the resolved lane for one invocation without changing `weave artifact current`.
- [ ] User can run `weave ship --stash` to stash leaked files, ship, and restore on exit.
- [ ] User can run `weave ship --draft` and `weave ship --ready` to override the lane-driven PR default.
- [ ] User can run `weave ship --json` to get a per-target machine-readable result.
- [ ] User can run `weave ship --message-body <text>` to substitute the commit body.
- [ ] User can run `weave ship --pr-body-extra <text>` to append text to the templated PR body.
- [ ] System resolves lane from `--lane` flag, then `weave artifact current`, then artifact-presence inference, in that priority.
- [ ] System opens a draft PR when lane is `exploration` / `prd` / `architecture` and no PR exists.
- [ ] System opens a ready PR when lane is `implementation` / `review` and no PR exists.
- [ ] System auto-promotes a draft PR to ready when lane crosses into `implementation` / `review`.
- [ ] System never auto-demotes a ready PR to draft.
- [ ] System refuses to ship from a branch other than `change/<active-change-id>` and suggests `weave change switch`.
- [ ] System refuses to ship without an active Weave change and suggests `weave change new` / `weave change switch`.
- [ ] System blocks ship when leaked files are dirty for the resolved lane and lists each leaked path.
- [ ] System bundles foreign-knowledge files into the commit and lists them in the output.
- [ ] System uses `git push -u origin HEAD` for the first push of a branch and plain `git push` thereafter.
- [ ] System skips the commit step when no in-scope files are dirty and still pushes + ensures PR.
- [ ] System produces commit message `<type>(<change-id>): <lane> - <title>` from `status.yml` and the resolved lane.
- [ ] System uses PR title `<type>: <title>`.
- [ ] System uses a templated PR body metadata block (title, lane, artifact links, "How to review" pointer).
- [ ] System auto-detects the PR base branch from `origin/HEAD` with `main` as fallback.
- [ ] System exits 0 when push succeeds even if the PR step is skipped due to `gh` missing / unauthenticated / non-GitHub host.
- [ ] System exits 2 for precondition failures (no active change, wrong branch, no git repo).
- [ ] System exits non-zero for guard block, hook failures, push failures, gh PR errors, and partial multi-target failures.
- [ ] System respects git hooks; when pre-commit modifies files, system re-stages and retries once.
- [ ] System iterates each target for multi-target propagated changes and reports per-target outcome.
- [ ] System prints a stash ref and recovery commands when `--stash` restore fails.
- [ ] Lane skills print the conditional ship suggestion at end-of-flow when the artifact was just written.
- [ ] Lane skills print the conditional ship suggestion at next-lane entry when the prior lane's artifact is uncommitted.
- [ ] Lane skills are silent when no in-scope dirty files exist.
- [ ] `weave-ship` skill performs a preflight readiness check before invoking the CLI.
- [ ] `weave-ship` skill warns and asks for explicit confirmation when preflight finds something unusual.
- [ ] `weave-ship` skill may pass `--message-body` and `--pr-body-extra` derived from session synthesis.
- [ ] `weave-ship` skill cannot replace the PR title or the metadata block of the PR body.
- [ ] `weave-ship` skill stops at preview in Plan Mode and does not invoke the CLI.
- [ ] `weave artifact current set <name>` accepts `implementation` and `review` (in addition to existing values).
- [ ] When `weave artifact current` is updated, the change's `status.yml` `stage` field is updated to mirror the same value.

## Rollout Considerations

- **Internal rollout**: ship lands in a future weave-it CLI release. Existing users get the new command on upgrade. No migration is required for existing change folders.
- **Existing changes**: existing change folders (e.g. `260522-f3q9-change-workflow-scaffold`, `260525-w3ye-active-change-commands`) work with ship as-is. Their `status.yml` `stage` field may be a stale `exploration`, but ship does not consult it.
- **Backward compatibility**: `weave change new` continues to write `stage: exploration`. The new "display cache" semantics for the field are additive; no consumer relies on the old single-write semantics.
- **Skill installation**: existing installs of weave-it skills under `.claude/`, `.opencode/`, `.agents/`, etc. need a re-sync to pick up the updated `weave-explore`, `weave-prd`, `weave-architect`, `weave-capture` skills (with the new conditional suggestion lines) and the new `weave-ship` skill. The release notes should call this out.
- **Communication**: release notes should call out:
  - `weave ship` is the new way to ship change artifacts.
  - `weave artifact current set <name>` now also accepts `implementation` and `review`.
  - `status.yml` `stage` is now a display cache and may be updated whenever artifact context changes.
- **No customer-facing migration**: this is a developer-tooling change. Users update by upgrading the npm package and re-syncing skills.

## Analytics and Success Metrics

V1 is a CLI that does not phone home. Success is measured anecdotally by the team using weave-it on weave-it itself:

- Number of commits and PRs that adopt the lane-tagged commit format (`<type>(<id>): <lane> - <title>`).
- Reduction in PRs that mix early-lane and implementation work in a single commit (a leak-guard signal).
- Reduction in PRs that get pinged to reviewers prematurely (a draft-vs-ready signal).
- Time-to-first-ship for a new change (qualitative; expected to drop from "multiple manual git commands" to "one CLI command").
- Skill adoption: presence of multi-session synthesis blocks in PR bodies (`--pr-body-extra` usage, indirectly observable).

If telemetry is added in a future release, candidate signals include `weave ship` invocation count, guard-block frequency, and stash-flag usage.

## Revision History

- 2026-05-30: Initial PRD generated from `exploration.md`.

## Assumptions

- The change id is short enough (under ~80 chars) to fit in a commit subject and a GitHub PR title without truncation. Conventional-commits convention is observed for `<type>` values.
- A user who runs `weave ship` has the necessary git push permission and (when `gh` is installed and authenticated) the necessary GitHub PR-creation permission. Ship does not pre-check these.
- The active change branch (`change/<id>`) was created by `weave change new` or `weave change propagate`, so the upstream `origin/<branch>` does not exist on the first ship.
- The change folder always contains a valid `status.yml`. If it does not, ship can fail fast with a clear error.
- `gh pr view --json url,isDraft` (or equivalent) is sufficient to detect an existing PR for a branch.
- Foreign-knowledge files are uncommon enough that "bundle and warn" is the right default rather than "block by default". If experience proves otherwise, this becomes a future configurable.
- The "How to review" pointer text in the PR body can be derived deterministically from lane (e.g. `exploration` -> "Read exploration.md and Open Questions"; `prd` -> "Read prd.md sections X, Y, Z"; etc.). The exact text is decided in implementation.
- The user's terminal supports basic wrapped output; ship does not rely on a TTY for correctness.

## Open Questions

None at the product level. The exploration's only remaining open question - the JSON output shape for `weave ship --json` - is technical and is owned by the architecture lane.

## Out of Scope

- Approval workflow for `exploration.md` / `prd.md` / `architecture.md` (e.g. setting `reviewed_at`, `approved_at`, `approved_by`).
- Automatic stage advancement that mutates `status.yml` `stage` based on which artifact was last written.
- A `weave change advance --to <stage>` command, or any explicit lane-promotion command.
- New lane skills (`weave-implement`, `weave-review`).
- Configurable `.weave/config.yml` knobs for ship.
- Native non-GitHub PR creation.
- Closing PRs, merging PRs, branch cleanup after merge.
- Custom commit-message and PR-body templates beyond the skill's append-or-replace surface.
- Telemetry, usage metrics, or any phone-home behaviour.

## Further Notes

- The `weave-ship` skill should be installable across the same set of agent surfaces as the existing skills (`.claude`, `.opencode`, `.agents`, `cursor`, `codex`) per `.weave/agents.yml`.
- The lane-skill suggestion line wording is part of the user-facing surface; choose phrasing that matches the existing skills' tone.
- Treating `status.yml` `stage` as a display cache makes the field forward-compatible if the project later decides to repurpose it for change-level lifecycle (`open` / `shipped` / `abandoned`).
- For the future `weave-implement` and `weave-review` skills, the contract with ship is straightforward: they call `weave artifact current set implementation` or `weave artifact current set review` on entry, and ship picks up the lane via priority 2.
- A future `wiki/knowledge/` overhaul (multi-domain, cross-change ownership) may revisit the foreign-knowledge bundling decision. For now, "bundle and warn" is intentionally the simplest behaviour that does not strand work in the user's worktree.
- The remaining technical open question (JSON shape of `weave ship --json`) is recorded in the architecture-lane inputs. Suggested per-target shape: `{ lane_used, lane_source: "flag" | "artifact_current" | "inferred", commit_sha, pushed: bool, push_set_upstream: bool, pr_url, pr_action: "opened_draft" | "opened_ready" | "promoted_to_ready" | "existing" | "skipped_no_gh" | "skipped_unauth" | "skipped_non_github", guard: { ok: bool, leaked_files: string[] }, stash: { used: bool, restored: bool, ref?: string }, foreign_knowledge_files: string[] }`. The architecture lane confirms field names and pairs them with an exit-code map.
