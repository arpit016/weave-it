---
artifact: exploration
status: draft
owner: product
created_at: 2026-05-30
updated_at: 2026-05-30
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Weave Ship Command For Git Automation

## Topic

Add a single top-level CLI command, `weave ship`, that commits, pushes, and idempotently opens a PR for the active Weave change. Ship works in every lane (`exploration`, `prd`, `architecture`, `implementation`, `review`). The lane the user is in is read from `weave artifact current` (already set by lane skills on entry, mutable in any direction), with `--lane <name>` flag overriding for one invocation and artifact-presence inference as fallback - **not** from the `stage` field in `status.yml`. Add a thin `weave-ship` skill that runs a readiness preflight, optionally enriches commit / PR text via append-only synthesis, and invokes the CLI.

## Current Understanding

Today's surface, baselined for the design:

- CLI commands: `init`, `add`, `workspace`, `change {new|list|current|status|switch|propagate}`, `artifact current {get|set|clear}`, `agent`, `skill[s]`. No git-touching command beyond `weave change *`.
- Skills shipped under `templates/skills/`: `weave-new`, `weave-explore`, `weave-prd`, `weave-architect`, `weave-capture`, `weave-clarify`, `weave-propagate`, `weave-issues`, `weave-next`. There is no implementation-lane or code-review skill today.
- Existing git plumbing in `src/lib/git.ts` and `src/lib/changes.ts`: `findGitRoot`, `getGitRemote`, a private `currentBranch`, `ensureChangeBranch`, and `assertCleanGitTargets`. There is no commit / push / PR helper.
- Lane is already trackable in v1 today: `weave artifact current set <name>` is called by every lane skill on entry. The session-state value supports `exploration | prd | architecture` today; the design extends `ArtifactName` to also include `implementation` and `review`.
- The `stage` field of `wiki/changes/<id>/status.yml` is written exactly once (to `"exploration"`) by `createChange` and is never updated afterwards. It is read only for display in `weave change list / current / status`. Ship will not consult it; it will become a display cache that is kept in sync by whichever code path updates artifact context.

The proposed command consolidates commit + push + idempotent PR opening into one step. A new `weave-ship` skill provides a Plan-Mode-aware wrapper that runs preflight checks (open questions, unresolved points, PRD readiness) and synthesizes optional appended text for the commit body and PR body, then invokes the CLI in normal mode.

## Open Questions

- **JSON output shape of `weave ship --json`** (technical, deferred to the architecture lane). Proposed per-target object: `{ lane_used, lane_source: "flag" | "artifact_current" | "inferred", commit_sha, pushed: bool, push_set_upstream: bool, pr_url, pr_action: "opened_draft" | "opened_ready" | "promoted_to_ready" | "existing" | "skipped_no_gh" | "skipped_unauth" | "skipped_non_github", guard: { ok: bool, leaked_files: string[] }, stash: { used: bool, restored: bool, ref?: string }, foreign_knowledge_files: string[] }`. Architecture lane confirms field names and pairs them with an exit-code map.

## Decisions

- **Namespace**: top-level `weave ship`. Operates on the active change.
- **Trigger model**: explicit CLI only. Lane skills never run git themselves; they may print a conditional `weave ship` suggestion.
- **Lane source-of-truth**: lane is resolved by, in priority order:
  1. `--lane <name>` CLI flag (one-shot override).
  2. `weave artifact current` for the active change. Mutable in any direction via `weave artifact current set <name>`.
  3. Artifact-presence inference (weave-next-style): populated `tasks.md` -> `implementation`; `architecture.md` -> `architecture`; `prd.md` -> `prd`; otherwise `exploration`.
- **No new advancement mechanism**. No `weave change advance` command. Backward lane moves are free.
- **`status.yml.stage`** stays as a display cache, updated by the same skills/CLI that set artifact context. Read by `weave change list/current/status` only. The lane-aware guard does not consult it.
- **`ArtifactName` extension**: extend to include `implementation` and `review` so the artifact-context signal is expressive across all lanes.
- **Lane-aware scope table** (driven by the resolved lane):
  - `exploration` / `prd` / `architecture`: in-scope = `wiki/changes/<id>/**`, `wiki/knowledge/**`, `.weave/sync.yml`. Leaks (guarded) = `src/**`, `tests/**`, `templates/**`, `package*.json`, root configs.
  - `implementation` / `review`: in-scope adds `src/**`, `tests/**`, `templates/**`, `package.json`, `package-lock.json`, root configs (`tsconfig.json`, `tsup.config.ts`, etc.).
  - Unknown lane fallback: permissive impl-lane scope plus a warning naming the unknown value.
- **Guard behaviour**: leaked dirty files block ship by default. `--stash` auto-stashes leaked files, runs ship, and restores on exit. If restore conflicts, the stash ref and recovery commands are printed; no file is written under `sessions/` or `.weave/`.
- **Guard location**: commit-time only. Lane-skill invocation does not assert a clean worktree.
- **Foreign-knowledge files**: dirty `wiki/knowledge/**` files unrelated to the active change are bundled into the change PR but warned about in the ship output (each file listed) so the user can split later.
- **Command shape**: single command `weave ship`. No `commit` / `push` / `pr` sub-primitives in v1.
- **Per-invocation semantics**: commit + push every time. PR opened the first time; existing PR URL printed thereafter.
- **Draft vs ready PR**: lane-driven default with one-way auto-promotion.
  - First-open: draft when lane is `exploration` / `prd` / `architecture`; ready when lane is `implementation` / `review`.
  - When lane crosses into `implementation` / `review` and the PR is currently draft, auto-promote draft -> ready.
  - Never auto-demote ready -> draft.
  - `--draft` / `--ready` CLI flags override at any time.
- **Commit message**: `<type>(<change-id>): <lane> - <title>`. `type`/`title` from `status.yml`; `lane` from the resolved lane. Body lists changed in-scope files plus the `## Summary` of the latest session note for the active lane when present. Skill may pass `--message-body <text>` to substitute the body.
- **PR title / body**: title `<type>: <title>` (CLI-only, skill cannot replace). Body: templated metadata block (title, lane, links to existing artifacts, "How to review" pointer derived from lane). Skill may pass `--pr-body-extra <text>` for an appended block. The metadata block is CLI-only.
- **Skill surface**: `weave-ship` skill performs:
  - Preflight readiness check (open questions, unresolved points, PRD readiness markers).
  - Append-only narrative enrichment of commit body and PR body (via `--message-body`, `--pr-body-extra`).
  - Invokes `weave ship` after confirmation.
  - In Plan Mode: stops at preview (preflight findings + proposed commit message + appended PR body block + in-scope file list). No CLI invocation.
- **Skill preflight policy**: when preflight finds something unusual (e.g. shipping a `Not ready` exploration from PRD lane), skill warns and asks for explicit confirmation before invoking the CLI.
- **Lane-skill suggestion conditionality**: print conditionally, tied to lane-artifact write events.
  - End of capture / lane-skill flow with a fresh artifact write -> "Run `weave ship` to commit, push, and open a PR.".
  - Entry of next-lane skill (e.g. `weave-prd` starting) when prior-lane artifact is uncommitted -> "Run `weave ship` first to commit your <lane> work before continuing.".
  - Silent when no dirty in-scope files for the active change.
- **Defer** new lane skills `weave-implement` and `weave-review`. The ship CLI must work without them.
- **Base branch**: auto-detect via `git symbolic-ref refs/remotes/origin/HEAD`, fall back to `main`.
- **PR tooling**: `gh` with graceful fallback when missing or non-GitHub remote: skip PR step, push still completes, print compare URL when host is recognised (github.com / gitlab.com / bitbucket.org), exit 0.
- **`gh` installed but unauthenticated**: non-fatal warn. Push completes. PR step skipped. Print `gh auth login` instruction + compare URL. Exit 0. User reruns ship after authenticating.
- **Multi-target / propagated changes**: iterate each target independently (each its own git root). Per-target outcome reported. Any failure exits non-zero; remaining targets still attempt.
- **Branch precondition**: refuse unless current branch is `change/<active-change-id>`. Suggest `weave change switch <id>`.
- **Push**: first time `git push -u origin HEAD`; subsequent pushes plain `git push`.
- **Hooks**: respected. If pre-commit auto-modifies files, re-stage and retry once.
- **Nothing to commit**: skip commit silently, still push (catches earlier local commits), still ensure PR exists. Print `No in-scope changes to commit.`.
- **Config**: no `.weave/config.yml` in v1; everything is driven by `status.yml` (display cache only), artifact context, `origin/HEAD` detection, and CLI flags.

## Scenarios

### Ship after exploration

Lane = `exploration` (set by `weave-explore`). Only `exploration.md` and a session note are dirty. Ship runs the lane-aware guard (no leaks), commits, pushes with `-u`, opens a draft PR via `gh`, and prints the PR URL.

### Ship after PRD

Lane = `prd`. `prd.md` and a PRD session note are dirty. Ship commits, pushes, detects the existing draft PR, leaves it draft, and prints its URL.

### Ship after implementation (with auto-promotion)

Lane = `implementation` (set via `weave artifact current set implementation` or `--lane implementation`, or inferred from populated `tasks.md`). `src/**`, `tests/**`, and `tasks.md` are dirty. The guard treats all of those as in-scope. Ship commits, pushes, and auto-promotes the existing draft PR to ready (or opens a ready PR first time).

### Leaked code during exploration

Lane = `exploration`. The user accidentally edited `src/cli.ts`. Ship blocks with a leak list. The user retries with `--stash`: leaked changes are stashed, the artifact commit + push + PR proceed, and the stash is restored at exit. If restore fails, the stash ref and recovery commands are printed.

### Leaked artifact during implementation

Lane = `implementation`. The user accidentally touched a knowledge file unrelated to the active change. Ship still commits it (under impl-lane scope) but prints a warning naming the foreign-knowledge file for review.

### Lane-mismatch / stale artifact context

Artifact context says `exploration` but the user is editing `src/**`. Ship blocks (treats `src/**` as a leak under exploration scope) and suggests either `weave artifact current set implementation` or `--lane implementation` for a one-shot override.

### Backward lane move

User shipped from `prd` once, then runs `weave artifact current set exploration` and continues exploration work. The next ship correctly treats `wiki/knowledge/**` etc. as in-scope and would block leaked impl files.

### Empty ship

Nothing dirty. Ship prints `No in-scope changes to commit.`, push is a no-op, and the existing PR URL is printed.

### gh missing / non-GitHub remote

`gh` is not installed (or origin is GitLab / Bitbucket). Ship runs the guard, commits, and pushes successfully. The PR step is skipped; ship prints a compare URL when the host is recognised, otherwise prints branch + remote and exits 0.

### gh installed but unauthenticated

`gh` is installed but `gh auth status` is non-zero. Ship runs the guard, commits, pushes. Prints `gh is installed but unauthenticated; run gh auth login to enable PR creation. Push completed; PR step skipped. Compare URL: ...`. Exits 0. After running `gh auth login`, the user reruns `weave ship` to open the PR.

### Wrong branch

The user is on `main`. Ship refuses and suggests `weave change switch <id>`.

### Multi-target propagated change

A change spans two folders in different repos. Ship iterates both: two commits, two pushes, two PRs. Per-target outcomes reported. Any failure -> exit non-zero; remaining targets still attempt.

### Pre-commit hook reformats

A pre-commit hook modifies a staged file. Ship re-stages the modified file and retries the commit once before giving up.

### Skill flow (normal mode)

The user runs the `weave-ship` skill. Skill reads change state and the latest session note, runs preflight (open questions, unresolved points, PRD readiness). If preflight is clean, skill synthesizes optional commit-body and pr-body-extra, invokes `weave ship` with those flags. If preflight finds something unusual (e.g. shipping a `Not ready` exploration from the PRD lane), skill warns and asks for explicit confirmation before invoking.

### Skill flow (Plan Mode)

The user runs the `weave-ship` skill in Plan Mode. Skill prints preflight findings, the proposed commit message, the appended PR body block, and the in-scope file list, then stops. No git mutations occur.

### Conditional suggestion (lane-skill)

End of `weave-capture` writing a fresh `exploration.md`: prints `Run weave ship to commit, push, and open a PR.`. The user later starts `weave-prd` while the exploration commit is still uncommitted: `weave-prd` entry prints `Run weave ship first to commit your exploration work before continuing.`. With nothing dirty, no suggestion is printed.

## Existing Behavior

- `weave change new` writes `status.yml` with `stage: exploration` exactly once (`statusTemplate` in `src/lib/changes.ts`); nothing currently advances the field. Going forward it becomes a display cache that mirrors artifact context.
- `weave change switch` and `weave change propagate` already enforce a clean worktree via `assertCleanGitTargets`; that helper is reusable but is not invoked at lane-skill entry.
- `ensureChangeBranch` already creates / checks out the `change/<id>` branch and returns a status; `weave ship` reuses the same branch convention as its precondition.
- `src/lib/git.ts` only exposes `findGitRoot` and `getGitRemote`. A `git`/`gitRequired` execFile pair is duplicated inside `src/lib/changes.ts`; lifting them into `src/lib/git.ts` is part of the proposed refactor for ship.
- `weave artifact current set <name>` is already implemented (`src/commands/artifact.ts`) and stores per-user session state. Lane skills already call it on entry (e.g. `weave-explore` opens with `weave artifact current set exploration --json`). The accepted values today are `exploration | prd | architecture` (`ArtifactName` in `src/lib/artifact-metadata.ts`); the design extends them to include `implementation` and `review`.
- Per-artifact YAML frontmatter on `exploration.md` / `prd.md` / `architecture.md` carries a separate `status` field (`draft` / `reviewed` / `approved`) that is artifact-level lifecycle, not change-level. Ship does not consult it.
- Lane skills under `templates/skills/weave-{explore,prd,architect,capture}/SKILL.md` already print a completion message; the addition is a conditional `weave ship` suggestion line at end of flow + at entry when prior-lane artifact is uncommitted.
- `templates/skills/weave-ship/` and `src/commands/ship.ts` do not exist yet.
- `weave-next` already infers state from artifact presence and content; ship's third-priority fallback inference reuses the same heuristics.

## PRD Readiness

Ready. Only the JSON output shape remains, and it is technical (deferred to the architecture lane per the weave-explore skill's technical-boundary rule).
