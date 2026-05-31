---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-05-30
updated_at: 2026-05-31
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md
---

# Weave Ship Command Architecture

## Summary

`weave ship` is a new top-level CLI command, paired with a thin `weave-ship` skill, that commits, pushes, and idempotently opens or tracks a GitHub PR for the active Weave change. It is lane-aware: the set of files staged and the leak guard's allow-list adapt to the user's current SDLC lane (`exploration`, `prd`, `architecture`, `implementation`, `review`). Lane is resolved from a `--lane` CLI flag, then `weave artifact current` (a session-state value already set by every lane skill on entry), then artifact-presence inference. Multi-target propagated changes iterate session-discovered targets independently and report per-target outcomes.

The implementation introduces a small set of cohesive modules that keep concerns testable and that share a single git wrapper layer:

- `src/lib/lane.ts` (a new `LaneName` superset and a `resolveLane()` priority chain),
- `src/lib/lane-scope.ts` (a static lane-scope table and a `partitionDirty()` helper),
- `src/lib/git-ops.ts` (commit / push / stash helpers built on the existing `src/lib/git.ts` wrapper),
- `src/lib/gh.ts` (a thin shell over the `gh` CLI with detection, auth check, PR view / create / ready),
- `src/lib/ship.ts` (the orchestrator),
- `src/commands/ship.ts` (the Commander entry),
- `src/lib/lane-suggestion.ts` (a pure renderer reused by skill templates),
- `templates/skills/weave-ship/SKILL.md` (preflight + append-only enrichment, Plan-Mode-aware preview).

The duplicate `git`/`gitRequired`/`currentBranch` helpers private to `src/lib/changes.ts` are lifted into `src/lib/git.ts` so both feature areas share one wrapper. `ArtifactName` keeps its narrow file-backed meaning and the persisted `current_artifact.artifact` field widens to a new `LaneName = ArtifactName | "implementation" | "review"` type. `setCurrentArtifact` mirrors lane changes into the change's `status.yml#stage` as a display cache, so `weave change list / current / status` continue to render an at-a-glance stage.

Ship is a pure orchestrator: it derives every output field from live `git`, live `gh`, or already-existing Weave state on disk. It writes only commits, pushes, and PRs. It introduces no new on-disk schema beyond the `LaneName` widening and adds no caching, no ship-specific session notes, and no metrics in v1.

The major risks are operational: process orchestration (commit + push + gh + stash) has many failure paths that must each yield a deterministic exit code, the stash restore conflict path must surface recovery commands clearly, and the `LaneName` widening is a one-way schema compat (new data may not load in older CLIs).

## PRD Context

PRD path: `wiki/changes/260530-hb8a-weave-ship-command-for-git-automation/prd.md`.

Product goals this architecture supports:

- A single CLI command, `weave ship`, that commits, pushes, and idempotently opens or tracks a PR for the active change.
- Lane-aware staging and leak guard.
- Lane-driven draft/ready PR with one-way auto-promotion (draft for early lanes, ready for `implementation`/`review`, never auto-demote).
- Idempotent PR ops (re-running ship does not open duplicate PRs).
- A thin `weave-ship` skill that adds preflight checks and append-only narrative enrichment but cannot replace authoritative metadata.
- Safe-by-default behaviour: leaked non-lane files block the operation; `--stash` is opt-in.
- The CLI is usable without the skill.

Product non-goals that shape the design:

- No artifact lifecycle status mutation (`reviewed`, `approved`).
- No automatic stage advancement; lane is read from `weave artifact current`, not from `status.yml#stage`.
- No `weave change advance` or other explicit lane-promotion command.
- No `weave-implement` / `weave-review` skills in v1.
- No `.weave/config.yml` knobs in v1.
- No PR closing / merging / branch cleanup.
- No native non-GitHub PR creation.
- No telemetry.

Product assumptions or ambiguities that matter technically:

- "Foreign-knowledge files unrelated to the active change" - the PRD says "bundle and warn"; the architecture defaults the heuristic to `any dirty wiki/knowledge/** path` (see `Architecture Decisions`).
- The `weave ship --json` output shape - the PRD proposes a per-target shape and explicitly delegates field-name and exit-code pairing to this architecture (see `Architecture Decisions`).
- The "How to review" PR-body pointer text per lane - architecture uses a small lane-keyed lookup, not configurable in v1.

## Current System

The Weave-It CLI is a TypeScript / Node.js (>=22.12) Commander-based binary. ESM modules with `.js` import specifiers (NodeNext resolution). Tests run under vitest using tmpdir + real `git init` for integration coverage. No runtime network dependencies today.

### Entry points and command shape

- `src/cli.ts` registers all top-level commands: `init`, `add`, `workspace`, `change`, `artifact`, `agent`, `skills`, `skill`.
- Each command lives under `src/commands/<name>.ts` and follows the same shape: a Commander factory function, a JSON-or-text writer, and a `runAction` error wrapper that maps `ChangeCommandError` to a structured `{ status: "error", code, message, details? }` object on `--json` and a stderr line otherwise.
- `weave change new` / `switch` / `propagate` are the only commands that touch git today; they share `assertCleanGitTargets` and `ensureChangeBranch`.

### Git plumbing

- `src/lib/git.ts` exposes `findGitRoot(cwd)` and `getGitRemote(cwd)` only. Internally it uses a private `git()` wrapper that wraps `execFile("git", args, { cwd })` with stdout-trim and a "return undefined on failure" semantics.
- `src/lib/changes.ts` duplicates this private `git()` wrapper, adds a `gitRequired()` (the throwing variant), and a private `currentBranch()`. These are reused inside `ensureChangeBranch`, `assertCleanGitTargets`, and the `branchMatch` rendering.
- No commit / push / stash / PR helper exists.
- No `gh` integration exists.

### Change and lane primitives

- `src/lib/changes.ts` is the change manager. Key functions:
  - `createChange()` writes `wiki/changes/<id>/`, `status.yml`, `exploration.md`, the `sessions/` folder, ensures the `change/<id>` branch via `ensureChangeBranch`, and persists `current_change` + `current_artifact: exploration` to session state via `setCurrentChangeForPath` / `setCurrentArtifactForPath`.
  - `propagateChange()` enforces clean worktrees via `assertCleanGitTargets`, copies the source change folder to other targets, and updates session state.
  - `switchChange()` enforces clean worktrees, calls `ensureChangeBranch`, and updates session state.
  - `currentChange()` / `statusChange()` read session state with a fallback "infer from `change/<id>` branch" path that auto-saves the inferred change.
  - `statusTemplate()` writes `stage: exploration` exactly once at change creation. No code path advances the field today.
  - `readChangeMetadata()` reads `status.yml` and is the only consumer of the `stage` field (rendered in `weave change list / current / status` text output).
- `src/lib/artifact-metadata.ts` defines `ArtifactName = "exploration" | "prd" | "architecture"`, `artifactNames`, `isArtifactName(value)`, and three helpers - `artifactFileName(artifact)`, `artifactFrontmatter(options)`, `defaultArtifactSource(artifact)`. These helpers assume every `ArtifactName` corresponds to a `<name>.md` file under the change folder.
- `src/lib/artifact-context.ts` defines `currentArtifact()` / `setCurrentArtifact()` / `clearCurrentArtifact()` and persists per-folder `current_artifact` in session state. `setCurrentArtifact` enforces a single-target invariant and computes `path = path.join(target.current.path, artifactFileName(artifact))`. `parseArtifact()` validates against `isArtifactName`.
- `src/commands/artifact.ts` exposes `weave artifact current [get|set|clear]`. Argument validation at the CLI boundary uses `parseArtifactName(value)` and is also gated by `isArtifactName`.

### Session state

- `src/lib/session-state.ts` defines `CurrentSession`, `SessionFolder`, `SessionCurrentChange`, `SessionCurrentArtifact`. The session file is YAML, persisted via `writeFileAtomic` at `~/.cache/weave/current-session.yml` (overridable by `WEAVE_SESSION_PATH`).
- Per-folder fields: `path`, `name`, `kind`, optional `git_remote`, optional `current_change`, optional `current_artifact`.
- Session state is local-only - it is never committed.

### Filesystem layout under a change folder

Today, after `weave change new` and a few lane skill runs, a change folder typically contains:

```text
wiki/changes/<id>/
  status.yml              # title, type, branch, stage (cache-only after this design)
  exploration.md          # always
  prd.md                  # after weave-prd
  architecture.md         # after weave-architect
  sessions/               # session notes by `weave-capture` and lane skills
    YYYY-MM-DD-<short>-<lane>.md
  tasks.md                # not present today; future weave-implement
```

### Lane skills and templates

- `templates/skills/{weave-explore, weave-prd, weave-architect, weave-capture, weave-clarify, weave-issues, weave-new, weave-next, weave-propagate}/SKILL.md` are the source for installed agent skills. Each ends with a "Completion Response" section that prints a short status line and the artifact path.
- `weave agent install <agent>` installs the templated skills into `.claude/skills/`, `.opencode/commands/`, `.agents/skills/`, etc. Hash-tracked in `.weave/agents.yml` so user-edited files are preserved.
- The `weave-explore`, `weave-prd`, `weave-architect`, and `weave-capture` skills already call `weave artifact current set <name>` on entry. They never invoke git.

### Test patterns

- `tests/changes.test.ts` covers `createChange` / `currentChange` / `statusChange` / `switchChange` / `propagateChange` using `mkdtemp` + `git init` + a `commitAll` helper. `tests/artifact-context` style coverage exists alongside it.
- `tests/agent-skills.test.ts` and `tests/cli-skills.test.ts` cover skill installation, hashing, and re-sync semantics.
- `tests/init.test.ts` covers `weave init` scaffolding.

### What is missing for ship

- No commit / push / PR primitive.
- No `gh` detection or invocation.
- No leak-guard or scope partitioner.
- No `LaneName`. The `current_artifact.artifact` field cannot today carry `implementation` or `review`.
- No display-cache mirror writing `status.yml#stage`.
- No conditional ship suggestion in the lane skills.
- No `weave-ship` skill template.

## Proposed Architecture

The proposed implementation organises ship into cohesive single-responsibility modules layered above a shared git wrapper, plus targeted edits to the existing artifact-context and lane-skill surfaces.

### Module map

```text
src/
  cli.ts                            # registers shipCommand()
  commands/
    artifact.ts                     # widens parseArtifactName -> LaneName
    ship.ts                         # NEW: weave ship CLI surface
    change.ts                       # unchanged
  lib/
    git.ts                          # extended: lifted git/gitRequired/currentBranch from changes.ts
    git-ops.ts                      # NEW: getDirtyFiles, stage, commitWithRetry, push, stash, compareUrl, defaultBaseBranch
    gh.ts                           # NEW: ghAvailable, ghAuthOk, findPrForBranch, createPr, markPrReady
    lane.ts                         # NEW: LaneName type and resolveLane()
    lane-scope.ts                   # NEW: in-scope globs and partitionDirty()
    lane-suggestion.ts              # NEW: pure renderer for the conditional ship-suggestion line
    ship.ts                         # NEW: orchestrator, returns ShipResult / ShipTargetResult
    artifact-metadata.ts            # re-exports LaneName for convenience
    artifact-context.ts             # widens to LaneName, mirrors stage to status.yml
    changes.ts                      # drops duplicate git helpers (now in git.ts)
    session-state.ts                # SessionCurrentArtifact.artifact widens to LaneName

templates/
  skills/
    weave-ship/SKILL.md             # NEW
    weave-{capture,explore,prd,architect}/SKILL.md   # add conditional ship-suggestion footer

tests/
  ship.test.ts                      # NEW (integration, tmpdir + real git)
  lane.test.ts                      # NEW (unit)
  lane-scope.test.ts                # NEW (unit)
  lane-name-compat.test.ts          # NEW (schema widening)
```

### `src/lib/lane.ts`

Defines the lane signal and resolution.

- `export type LaneName = ArtifactName | "implementation" | "review";`
- `export const laneNames: LaneName[]`.
- `export function isLaneName(value: string | undefined): value is LaneName`.
- `export interface ResolveLaneInput { flag?: string; sessionLane?: LaneName; changePath: string; }`
- `export interface ResolveLaneResult { lane: LaneName; source: "flag" | "artifact_current" | "inferred"; warning?: string; }`
- `export async function resolveLane(input: ResolveLaneInput): Promise<ResolveLaneResult>`:
  1. If `input.flag` is non-empty: validate via `isLaneName`; throw a typed `ShipPreconditionError("invalid_lane", ...)` if invalid; otherwise return `{ lane: flag, source: "flag" }`.
  2. Else if `input.sessionLane` is set: if it's a known `LaneName`, return `{ lane, source: "artifact_current" }`; if unknown, return `{ lane: "implementation", source: "inferred", warning: "Unknown lane '<x>' in session state; falling back to permissive impl-lane scope." }`.
  3. Else: infer from artifact presence in `input.changePath`:
     - If `tasks.md` exists and contains at least one line matching `/^\s*-\s*\[/m` after the YAML frontmatter -> `implementation`.
     - Else if `architecture.md` exists -> `architecture`.
     - Else if `prd.md` exists -> `prd`.
     - Else -> `exploration`.
- The inference function is pulled out as `inferLaneFromArtifacts(changePath)` so it is independently unit-testable.

### `src/lib/lane-scope.ts`

The lane-scope table and partitioner. Globs are matched against repo-relative POSIX paths.

- `export interface ScopeRule { included: string[]; }` (only positive globs - everything else is a leak).
- `export function inScopeGlobs(lane: LaneName, changeId: string): string[]`:
  - For `exploration | prd | architecture`:
    - `wiki/changes/<changeId>/**`
    - `wiki/knowledge/**`
    - `.weave/sync.yml`
  - For `implementation | review`: above plus
    - `src/**`
    - `tests/**`
    - `templates/**`
    - `package.json`
    - `package-lock.json`
    - `tsconfig.json`
    - `tsup.config.ts`
    - `vitest.config.ts`
- `export interface DirtyFile { path: string; index: string; worktree: string; }` - parsed from `git status --porcelain=v1 -z`.
- `export interface PartitionResult { inScope: string[]; leaks: string[]; foreignKnowledge: string[]; }`
- `export function partitionDirty(files: DirtyFile[], lane: LaneName, changeId: string): PartitionResult`:
  - Foreign-knowledge: any path matching `wiki/knowledge/**` (always treated as in-scope-but-flagged for v1; see `Architecture Decisions`).
  - In-scope: matches an `inScopeGlobs(lane, changeId)` glob.
  - Leak: dirty AND not in-scope.

### `src/lib/git.ts` (extended)

Lift the duplicate helpers from `changes.ts` and export them.

- Existing exports retained: `findGitRoot(cwd)`, `getGitRemote(cwd)`.
- Added exports: `git(args, cwd)` (silent, returns `undefined` on failure), `gitRequired(args, cwd)` (throws on non-zero exit), `currentBranch(cwd)`.
- `changes.ts` imports these instead of redefining them. Behaviour-preserving change.

### `src/lib/git-ops.ts`

A thin layer of higher-level git operations on top of `git.ts`.

- `export async function getDirtyFiles(cwd: string): Promise<DirtyFile[]>` - parses `git status --porcelain=v1 -z`. Tolerates paths with spaces and unicode. Spawns with `LANG=C` for deterministic stderr.
- `export async function stageFiles(cwd: string, files: string[]): Promise<void>` - one `git add --` invocation; uses `--pathspec-from-file=-` and stdin for very large file sets.
- `export interface CommitOptions { subject: string; body: string; }`
- `export interface CommitResult { sha: string; reStaged: boolean; }`
- `export async function commitWithRetry(cwd: string, files: string[], options: CommitOptions): Promise<CommitResult>`:
  - Run `git commit -m <subject> -m <body>` once.
  - On exit code != 0 with stderr indicating "files were modified" / dirty index, re-stage `files` exactly once and retry.
  - On second non-zero exit, throw `ShipHookError(stdout + stderr)`.
  - On success after retry, set `reStaged = true` and read the SHA via `git rev-parse HEAD`.
- `export interface PushResult { setUpstream: boolean; }`
- `export async function push(cwd: string, branch: string): Promise<PushResult>`:
  - `git rev-parse --verify origin/<branch>` to detect existing upstream.
  - If missing: `git push -u origin HEAD`. Else: `git push`.
  - On non-zero exit, throw `ShipPushError(stderr, hint)`.
- `export interface StashResult { ref: string; }`
- `export async function stashLeaks(cwd: string, files: string[]): Promise<StashResult>` - `git stash push --keep-index --include-untracked -m "weave-ship-leak <changeId> <ts>" -- <files>`. Returns the stash ref via `git rev-parse stash@{0}`.
- `export interface PopStashResult { ok: boolean; conflict?: string; }`
- `export async function popStash(cwd: string, ref: string): Promise<PopStashResult>` - tries `git stash pop <ref>`; on non-zero exit, returns `{ ok: false, conflict: stderr }` and leaves the stash entry intact (we deliberately don't pop on conflict).
- `export async function defaultBaseBranch(cwd: string): Promise<string>` - `git symbolic-ref --short refs/remotes/origin/HEAD` -> `origin/main` -> `main`. Falls back to literal `"main"`.
- `export function compareUrl(remote: string, base: string, head: string): string | undefined` - pure function; recognises `github.com`, `gitlab.com`, `bitbucket.org` (both SSH and HTTPS forms). Returns `undefined` for unrecognised hosts.

All `git-ops` helpers either throw a typed `ShipError` subclass or return a structured result. Stderr is captured for inclusion in `ShipTargetResult`.

### `src/lib/gh.ts`

- `export async function ghAvailable(): Promise<boolean>` - `which gh` (cross-platform via spawn) returning a boolean.
- `export async function ghAuthOk(cwd: string): Promise<boolean>` - `gh auth status` exit code 0 -> true.
- `export interface GhPr { url: string; isDraft: boolean; number: number; state: "OPEN" | "CLOSED" | "MERGED"; }`
- `export async function findPrForBranch(cwd: string, branch: string): Promise<GhPr | undefined>` - `gh pr view <branch> --json url,isDraft,number,state`. `undefined` when there is no PR for the branch (gh exits non-zero).
- `export interface CreatePrInput { title: string; body: string; base: string; head: string; draft: boolean; }`
- `export async function createPr(cwd: string, input: CreatePrInput): Promise<{ url: string }>`.
- `export async function markPrReady(cwd: string, branch: string): Promise<void>`.

`gh.ts` never auto-installs `gh` and never prompts. Detection failures are non-fatal at the orchestrator level.

### `src/lib/ship.ts`

The orchestrator. One pure function.

- `export interface ShipOptions {
  cwd: string;
  flag?: { lane?: string; draft?: boolean; ready?: boolean; stash?: boolean; messageBody?: string; prBodyExtra?: string; };
  json?: boolean;
  sessionPath?: string;
  now?: Date;
}`
- `export async function ship(options: ShipOptions): Promise<ShipResult>`:
  1. Load session state. Resolve the active change id from session state's `current_change` for the cwd target. Throw a `ShipPreconditionError("no_active_change")` if none.
  2. **Multi-target discovery**: iterate every session folder where `current_change.id === activeChangeId`. The cwd's target is included if it has the matching `current_change`. Each target is processed independently in a `try` block; per-target errors are caught and stored in `ShipTargetResult.precondition`/`commit`/`push`/`pr`/`stash` slots.
  3. Per-target sequence (executed in `runShipForTarget(target, options)`):
     1. Resolve git root via `findGitRoot`. If missing: `precondition.reason = "not_git_repo"`, `exit_code = 2`, return.
     2. Get `currentBranch`. If `!= change/<id>`: `precondition.reason = "wrong_branch"`, `exit_code = 2`, return.
     3. Read `status.yml` for `<type>` and `<title>`. If missing or unparseable: `precondition.reason = "change_corrupt"`, `exit_code = 2`, return.
     4. Resolve lane via `resolveLane({ flag, sessionLane, changePath })`. Surface any lane warning into `ShipResult.message`.
     5. Get dirty files via `getDirtyFiles`.
     6. Partition via `partitionDirty(files, lane, changeId)`.
     7. **Guard**: if `leaks.length > 0`:
        - Without `--stash`: `guard.ok = false`, `guard.leaked_files = leaks`, `commit.skipped = true`, `commit.reason = "guard_blocked"`, `exit_code = 3`. Return.
        - With `--stash`: call `stashLeaks(cwd, leaks)`. Record `stash.used = true`, `stash.ref`. Continue.
     8. **Stage**: if `inScope.length === 0`:
        - `commit.skipped = true`, `commit.reason = "no_in_scope_changes"`. Skip to push.
        - Else: `stageFiles(cwd, [...inScope, ...foreignKnowledge])`. Set `staged_files`.
     9. **Commit message**: subject = `<type>(<id>): <lane> - <title>`. Body = listed staged files + a blank line + the latest active-lane session note's `## Summary` excerpt (when present). If `flag.messageBody` is set, body is replaced verbatim by it. `commitWithRetry(cwd, files, { subject, body })`. On `ShipHookError`: `commit.reason = "hook_failed"`, `exit_code = 4`. Pop stash if used. Return.
     10. **Push**: `push(cwd, branch)`. Record `push.pushed = true`, `push.set_upstream`. On `ShipPushError`: `exit_code = 5`. Pop stash. Return.
     11. **PR**: `ghAvailable()` + `ghAuthOk(cwd)`. Recognise the remote host:
         - Not `gh` available: `pr.action = "skipped_no_gh"`, exit 0. Print compare URL when host recognised.
         - `gh` available but not auth: `pr.action = "skipped_unauth"`, exit 0. Print compare URL + auth hint.
         - Remote not GitHub: `pr.action = "skipped_non_github"`, exit 0. Print compare URL when recognised.
         - No remote: `pr.action = "skipped_no_remote"`, exit 0.
         - GitHub: `findPrForBranch(cwd, branch)`:
           - PR missing: `createPr({ title: "<type>: <title>", body: prBody, base: defaultBaseBranch(cwd), head: branch, draft: laneIsEarly })`. `pr.action = "opened_draft" | "opened_ready"` per lane / `--draft` / `--ready`.
           - PR exists, lane is `implementation | review`, current is draft (and not `--draft`): `markPrReady(cwd, branch)`. `pr.action = "promoted_to_ready"`.
           - PR exists otherwise: `pr.action = "existing"`.
     12. **Stash pop**: if `stash.used`, call `popStash(cwd, stash.ref)`. Record `stash.restored`, `stash.conflict`. On conflict: `exit_code = 7`.
  4. After all targets: `process exit_code = max(target.exit_code)`. `ShipResult.message` is composed (text mode) or `JSON.stringify(result, null, 2)` (json mode).

The `<type>` / `<title>` for the commit subject and PR title are read from `status.yml` once and cached in memory for the per-target pass. The "How to review" pointer in the templated PR body is selected from a small lane-keyed map (`exploration -> "Read exploration.md and Open Questions."`, etc.) baked into `ship.ts`.

### `src/commands/ship.ts`

The Commander entry. Flags:

- `--lane <name>` - one-shot lane override (priority 1 in the lane-resolution chain). Affects only this single invocation; never persisted. Validates against `LaneName`; invalid values fail fast with exit 2 (`invalid_lane`). Does not relax the branch precondition.
- `--draft` / `--ready` - draft/ready PR override on first open and on auto-promotion eligibility checks. `--draft` never auto-demotes a ready PR.
- `--stash` - opt-in leaked-file stash. Without it, leaks block ship at exit 3.
- `--message-body <text>` - replaces the commit body verbatim.
- `--pr-body-extra <text>` - appended to the templated PR body. Metadata block remains intact.
- `--json` - machine-readable output. Writes only `ShipResult` to stdout; nothing to stderr.

The action calls `ship({ ... })` and writes either `result.message` or `JSON.stringify(result, null, 2)`. `process.exitCode = result.exit_code` (computed in `ship.ts`).

Registered last in `src/cli.ts` after `artifactCommand()` so order in `--help` reads naturally.

### `--lane` semantics

The `--lane` flag is the highest-priority signal in lane resolution (priority 1 over `weave artifact current` and over artifact-presence inference). For a single ship invocation, it changes four downstream surfaces inside the per-target sequence:

1. **Scope partition** (`lane-scope.ts`). The lane-keyed scope table decides which dirty files are in-scope vs leaked. Switching `--lane exploration` -> `--lane implementation` widens in-scope to include `src/**`, `tests/**`, `templates/**`, `package.json`, `package-lock.json`, and the top-level configs. Switching back narrows.
2. **Commit subject**. Format is `<type>(<id>): <lane> - <title>`. The `<lane>` token comes directly from the resolved lane.
3. **PR draft/ready default on first open**. Draft for `exploration | prd | architecture`; ready for `implementation | review`. Combinable with `--draft` / `--ready` for further override.
4. **Auto-promotion eligibility**. Auto-promote draft -> ready fires only when the resolved lane is `implementation | review` and the existing PR is currently a draft (and `--draft` was not passed).
5. **PR body "How to review" pointer text**. Lane-keyed lookup baked into `ship.ts`.

`--lane` does **not**:

- Persist anywhere. `weave artifact current` is unchanged after ship exits.
- Relax the branch precondition (still must be on `change/<active-id>`).
- Bypass `status.yml` validation.
- Mirror anything to `status.yml#stage` (that mirror lives in `setCurrentArtifact`, which fires only from `weave artifact current set`).

### Operational distinction: persistent vs one-shot lane changes

| Concern | Mechanism | Persistence |
| --- | --- | --- |
| "I'm switching lanes for the rest of this session" | `weave artifact current set <name>` | Persists in session state; mirrors to `status.yml#stage` |
| "Just this one ship should use a different lane" | `weave ship --lane <name>` | One-shot; nothing persisted |
| "Open draft (or ready) regardless of lane default" | `weave ship --draft` / `--ready` | One-shot; only affects PR posture, not scope or commit subject |

If a user reaches for `--lane` more than once for the same conceptual lane change, the right move is `weave artifact current set <name>` so the lane sticks. `--lane` is intentionally ephemeral so it does not drift the persistent signal.

### `src/lib/lane-suggestion.ts`

A pure renderer for the conditional ship-suggestion lines used by lane skills. Returns the text to print or `undefined`.

- `export function freshWriteSuggestion(input: { hasInScopeDirty: boolean }): string | undefined`
- `export function nextLaneEntrySuggestion(input: { priorLane: LaneName; priorLaneDirty: boolean }): string | undefined`

Skill templates render the suggestion text directly (the renderer is invoked by the agent as part of running the skill, not by Weave at install time). The function exists primarily to keep wording consistent and to cover via unit tests.

### `src/lib/artifact-metadata.ts`

- Keep `ArtifactName = "exploration" | "prd" | "architecture"`.
- Re-export `LaneName` from `./lane.js` so callers can `import { LaneName } from "./artifact-metadata.js"` if convenient.
- Helpers `artifactFileName`, `artifactFrontmatter`, `defaultArtifactSource` keep their `ArtifactName` signatures unchanged. These are file-only.

### `src/lib/artifact-context.ts`

- Widen `parseArtifact(value: string)` to accept `LaneName`. Validation uses `isLaneName`. Error message updated to enumerate `exploration | prd | architecture | implementation | review`.
- `setCurrentArtifact()` is the single place that mutates `current_artifact` and the display cache:
  - Compute `artifactState.path`:
    - If `isArtifactName(lane)`: `path.join(target.current.path, artifactFileName(lane))`.
    - Else (`implementation | review`): `target.current.path` (the change folder root).
  - After `saveCurrentSession`, call `mirrorStageToStatusYml(target.path, target.current.path, lane)` (new helper).
- `mirrorStageToStatusYml(targetRoot, changeRelativePath, lane)`:
  - Read `wiki/changes/<id>/status.yml`.
  - Set `stage = lane`, `updated_at = now.toISOString()`.
  - Write atomically via `writeFileAtomic`.
  - Failure to mirror is non-fatal (logged to stderr, never throws). The display cache is best-effort by design.
- `clearCurrentArtifact()` does NOT clear `status.yml#stage`. The display cache remains as the last set value.

### `src/lib/session-state.ts`

- `SessionCurrentArtifact.artifact: LaneName` (TS type widening; on-disk schema unchanged in field name).
- No migration. Older session files with `artifact: exploration|prd|architecture` continue to load and serialize unchanged.

### `src/commands/artifact.ts`

- `parseArtifactName(value: string): LaneName` widens to `LaneName` (delegates to `isLaneName`).
- `weave artifact current set <name>` accepts the wider set: `exploration | prd | architecture | implementation | review`.
- Help text updated.

### `src/lib/changes.ts`

- Drop the duplicate `git()` and `gitRequired()` definitions; import from `./git.js`.
- Drop the private `currentBranch()`; import from `./git.js`.
- No behaviour change.

### `src/cli.ts`

- Register `program.addCommand(shipCommand());` after `artifactCommand()`.

### Lane skill template updates

Each of `templates/skills/weave-{capture, explore, prd, architect}/SKILL.md` gets a "Conditional Ship Suggestion" section appended to its existing "Completion Response" section. The skill instructs the agent to:

1. After writing or revising the active artifact, run `git status --porcelain` for the active change folder + lane scope.
2. If at least one in-scope file is dirty, append `Run \`weave ship\` to commit, push, and open a PR.` to the completion response.
3. At skill entry (`weave-prd` / `weave-architect`), if a prior-lane artifact for the active change is dirty (uncommitted), print `Run \`weave ship\` first to commit your <prior-lane> work before continuing.` before the main flow.
4. Otherwise stay silent.

The CLI does not write or read this text. The wording is templated in the skill markdown so installed agents reproduce it consistently.

### `templates/skills/weave-ship/SKILL.md`

A new skill template with the following workflow:

1. Plan-Mode guard. If in Plan Mode, run preflight + synthesis but stop before invoking the CLI; print the proposed commit message, the appended PR body block, the resolved lane, the in-scope file list.
2. Resolve context: `weave workspace --json`, `weave change current --json`, `weave artifact current --json`.
3. Read the latest active-lane session note's `## Summary` and `## Decisions Made` / `## Unresolved Points` sections.
4. Read `exploration.md#Open Questions`, `exploration.md#PRD Readiness`, populated `tasks.md` open items.
5. Preflight: surface unusual conditions:
   - `Open Questions` non-empty for current lane.
   - `PRD Readiness: Not ready` while shipping from `prd` or later.
   - Lane `review` while open `tasks.md` items remain unchecked.
   - Mismatch between `weave artifact current` and artifact-presence inference.
6. If unusual: print findings, ask the user explicit yes/no confirmation, abort on no.
7. Synthesis (optional): build `--message-body` (a multi-session "Decisions made this session" digest from the last N session notes for the active lane) and `--pr-body-extra` (the same digest, formatted for PR markdown).
8. Invoke `weave ship --message-body "<text>" --pr-body-extra "<text>"`. Pipe output to user.

Restrictions: the skill must not pass `--draft` / `--ready` / `--lane` unless the user explicitly asked. The skill must not replace the PR title or the templated PR body metadata block.

## Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant CLI as weave ship
    participant SS as Session State
    participant Lane as lane.ts
    participant Scope as lane-scope.ts
    participant Git as git-ops.ts
    participant Gh as gh.ts
    U->>CLI: weave ship [--lane --draft --ready --stash --message-body --pr-body-extra --json]
    CLI->>SS: loadCurrentSession()
    CLI->>SS: discover targets where current_change.id matches
    loop per target
        CLI->>Git: findGitRoot, currentBranch
        alt branch != change/<id> or not git
            CLI-->>U: precondition fail; exit 2
        else
            CLI->>Lane: resolveLane({flag, sessionLane, changePath})
            Lane-->>CLI: { lane, source, warning? }
            CLI->>Git: getDirtyFiles
            CLI->>Scope: partitionDirty(files, lane, changeId)
            Scope-->>CLI: { inScope, leaks, foreignKnowledge }
            alt leaks present and not --stash
                CLI-->>U: guard block + leak list; exit 3
            else leaks present and --stash
                CLI->>Git: stashLeaks
            end
            alt inScope empty
                CLI-->>U: "No in-scope changes to commit."
            else
                CLI->>Git: stageFiles(inScope + foreignKnowledge)
                CLI->>Git: commitWithRetry(subject, body)
            end
            CLI->>Git: push(branch)
            alt gh missing or unauth or non-github
                CLI-->>U: skip PR; print compare URL; exit 0
            else
                CLI->>Gh: findPrForBranch
                alt PR missing
                    CLI->>Gh: createPr(draft|ready by lane)
                else PR exists and lane in (impl|review) and isDraft and not --draft
                    CLI->>Gh: markPrReady
                else
                    Note over CLI,Gh: existing
                end
            end
            alt stash used
                CLI->>Git: popStash(ref)
                alt conflict
                    CLI-->>U: stash ref + recovery commands; exit 7
                end
            end
        end
    end
    CLI-->>U: per-target summary or ShipResult JSON
```

State transitions for the PR:

```text
none -> draft           # ship opens draft for exploration | prd | architecture
none -> ready           # ship opens ready for implementation | review
draft -> ready          # auto-promote when lane crosses to impl | review
ready -> draft          # only via --draft (never automatic)
closed | merged         # not handled by ship
```

State transitions for the lane signal:

```text
forward             # a lane skill calls `weave artifact current set <name>` on entry
backward            # user calls `weave artifact current set <name>` directly, in either direction
one-shot           # `weave ship --lane <name>` overrides without persisting
```

## Architecture Decisions

### AD-1. Two types: `ArtifactName` (file-backed) + `LaneName` (superset)

- **Decision**: keep `ArtifactName = "exploration" | "prd" | "architecture"` for artifacts that map to a `<name>.md` file. Introduce `LaneName = ArtifactName | "implementation" | "review"` for the broader lane signal. Widen `SessionCurrentArtifact.artifact: LaneName` and accept the wider set in `weave artifact current set`. For non-file lanes, `current_artifact.path` is set to the change folder root.
- **Rationale**: file-only helpers (`artifactFileName`, `artifactFrontmatter`, `defaultArtifactSource`) keep their tight contract. The lane signal expands without requiring those helpers to introduce sentinel returns. The on-disk field name (`artifact`) does not change, so backward compatibility is straightforward.
- **Consequences**: callers writing files still go through `ArtifactName`. Lane consumers (`ship.ts`, `lane.ts`, future `weave-implement` / `weave-review`) consume `LaneName`. `current_artifact.path` semantics shift slightly for the new lanes (folder, not file).

### AD-2. Multi-target via session-state discovery

- **Decision**: when iterating multi-target propagated changes, ship discovers targets by enumerating session folders where `current_change.id === <active id>`. The cwd's target is included if it has a matching `current_change`. Folders without a session-tracked `current_change` for this id are skipped silently.
- **Rationale**: aligns with the existing `currentChange({ target: 'all' })` pattern in `src/lib/changes.ts` and the `weave change propagate` workflow that updates session state for every target. Filesystem discovery (scanning `wiki/changes/<id>/` across folders) was rejected because it would iterate orphaned change folders or session-disconnected repos.
- **Consequences**: users who skip `weave change propagate` (e.g. manually copy a change folder) will not have their additional target shipped. Documented; future enhancement could add a `--target <id|all>` override.

### AD-3. `weave ship --json` output shape and exit-code map

- **Decision**: `weave ship --json` emits a single `ShipResult` to stdout. The shape, locked here:

```ts
type LaneName = "exploration" | "prd" | "architecture" | "implementation" | "review";

type PrAction =
  | "opened_draft"
  | "opened_ready"
  | "promoted_to_ready"
  | "existing"
  | "skipped_no_gh"
  | "skipped_unauth"
  | "skipped_non_github"
  | "skipped_no_remote"
  | "error";

type CommitSkipReason = "no_in_scope_changes" | "guard_blocked" | "hook_failed";

type PreconditionReason = "no_active_change" | "wrong_branch" | "not_git_repo" | "change_corrupt";

interface ShipTargetResult {
  target_path: string;
  target_id?: string;
  change_id: string;
  branch: string;
  lane_used: LaneName;
  lane_source: "flag" | "artifact_current" | "inferred";
  precondition: { ok: boolean; reason?: PreconditionReason; expected?: string; actual?: string };
  guard: { ok: boolean; leaked_files: string[] };
  staged_files: string[];
  foreign_knowledge_files: string[];
  commit: { sha?: string; skipped: boolean; reason?: CommitSkipReason };
  push: { pushed: boolean; set_upstream: boolean; error?: string };
  pr: { url?: string; action: PrAction; error?: string };
  stash: { used: boolean; restored: boolean; ref?: string; conflict?: string };
  exit_code: number;
}

interface ShipResult {
  status: "ok" | "error";
  targets: ShipTargetResult[];
  message: string;
}
```

  Per-target `exit_code` is included so callers can attribute multi-target failures. Process exit code = `max(t.exit_code for t in targets)`.

- **Exit-code map**:

  | Code | Meaning |
  | --- | --- |
  | `0` | All targets ok (commit succeeded or skipped-no-changes; push ok; PR ok or documented skip). |
  | `1` | Unexpected error (caught at orchestrator boundary). |
  | `2` | Precondition failure (no active change, wrong branch, not a git repo, change folder corrupt). |
  | `3` | Guard block (leaked files, no `--stash`). |
  | `4` | Hook failure (commit aborted by pre-commit; or hook re-modifies after retry). |
  | `5` | Push failure (non-fast-forward, network error). |
  | `6` | gh PR error (`createPr` or `markPrReady` failed). |
  | `7` | Stash restore conflict (commit + push succeeded; stash entry remains). |

- **Rationale**: this resolves the only open product question in `prd.md` and `exploration.md`. The shape mirrors the orchestrator's per-step state machine, so callers (CI, scripts, the skill) can reason about ship outcomes without parsing human text. The exit-code map is dense at the low end so common failures are easy to remember.
- **Consequences**: any future field addition is additive; never rename existing keys without a major version bump. JSON-mode writes only `ShipResult` to stdout; warnings continue to go to stderr in human mode and are suppressed in JSON mode.

### AD-4. Ship is a pure orchestrator; no new persistent state

- **Decision**: every field in `ShipTargetResult` is derived from one of three live sources, and ship adds no new on-disk schema or files of its own:
  - **Live git** (`status --porcelain=v1 -z`, `branch --show-current`, `rev-parse`, `commit`, `push`, `stash`, `symbolic-ref refs/remotes/origin/HEAD`).
  - **Live gh** (`pr view --json url,isDraft`, `pr create`, `pr ready`, `auth status`, `--version`).
  - **Existing local Weave state** - session state at `~/.cache/weave/current-session.yml`, `wiki/changes/<id>/status.yml`, `wiki/changes/<id>/sessions/*.md`, `wiki/changes/<id>/{exploration,prd,architecture,tasks}.md`. Plus in-memory derived values for `lane_source`, `commit.skipped/reason`, `exit_code`.
  Ship's only side effects are: a git commit, a git push, a GitHub PR via `gh` (or a documented skip), and the `ShipResult` to stdout. Ship does NOT write to session state, does NOT mirror to `status.yml#stage` (that mirror lives in `setCurrentArtifact` and only fires from `weave artifact current set`), does NOT cache PR URLs, does NOT write any session notes. `--lane` is one-shot.
- **Rationale**: keeps ship idempotent and recoverable. Re-running ship after any partial failure recomputes state from current git/gh, so retries are safe. Avoids an additional source of drift between local cache and remote state.
- **Consequences**: every invocation incurs a `gh pr view` round-trip, which is acceptable for an interactive CLI. Ship cannot detect "we already pushed this exact commit" without re-running git; that is fine because git itself short-circuits on a no-op push.

### AD-5. `status.yml#stage` is a display cache, mirrored from `setCurrentArtifact`

- **Decision**: `status.yml#stage` is read only by `weave change list / current / status` for display; ship never consults it. The mirror write happens in `setCurrentArtifact` (a new helper `mirrorStageToStatusYml`). `clearCurrentArtifact` does not roll the field back. `createChange` continues to write `stage: exploration` once at change creation. Mirror write failures are non-fatal (logged to stderr).
- **Rationale**: a single write path eliminates drift. Callers that update artifact context (CLI, future skills) get the cache update for free without any extra ceremony. Failure to mirror should never block a successful `weave artifact current set`.
- **Consequences**: the field becomes additive-write rather than "written once". Older CLIs ignore changes they don't write; the field is forward-compatible.

### AD-6. `gh` and the remote host are detected at use-time

- **Decision**: ship checks `ghAvailable()` and `ghAuthOk()` immediately before the PR step in each target. Origin is parsed for host recognition (`github.com`, `gitlab.com`, `bitbucket.org`). Each skip path produces a distinct `pr.action` value and a clear human-mode message.
- **Rationale**: detection is cheap (one process spawn each). Detecting at the start of ship would force a global pre-flight that fails the entire run for one bad target; detecting at use time keeps per-target containment. Cached detection state would risk staleness if the user runs `gh auth login` mid-run and reruns ship.
- **Consequences**: small additional latency per target. No `gh` version pinning; ship documents the minimum (`gh >= 2.0`) but does not enforce it.

### AD-7. `--stash` is opt-in; default behaviour is to block on leaks

- **Decision**: leaked dirty files block ship by default with a clear list and a `--stash` hint. `--stash` opt-in invokes `git stash push -- <leaked-files>`, runs ship, and `git stash pop` on exit. On stash restore conflict, ship prints the stash ref + recovery commands and exits 7.
- **Rationale**: matches PRD; safe by default. Implicit auto-stash would let ship modify the user's worktree silently, which is dangerous.
- **Consequences**: the first time a developer hits a leak, they must read the message and rerun. This is intentional friction.

### AD-8. Lift the duplicate git wrappers from `changes.ts` into `git.ts`

- **Decision**: lift the private `git()`, `gitRequired()`, and `currentBranch()` from `src/lib/changes.ts` into `src/lib/git.ts` and export them. `git-ops.ts` and `gh.ts` use this single layer. `changes.ts` imports from it; no behaviour changes.
- **Rationale**: removes duplication; a single layer is easier to test, mock, and instrument.
- **Consequences**: a small mechanical refactor in `changes.ts`. No persistent behaviour change.

### AD-9. Foreign-knowledge default heuristic: any dirty `wiki/knowledge/**` is foreign

- **Decision**: in v1, ship classifies any dirty path under `wiki/knowledge/**` as "foreign-knowledge". Foreign-knowledge files are bundled into the commit and listed in `ShipTargetResult.foreign_knowledge_files`.
- **Rationale**: `wiki/knowledge/` is workspace-shared and not change-owned; "bundle and warn" is the simplest deterministic rule. Cross-reference-aware classification (only treat as foreign when not referenced by an artifact) is a future refinement.
- **Consequences**: developers shipping intentional knowledge updates see them listed in the output. Refinement is tracked in `Open Technical Questions`.

### AD-10. Single orchestrator function with per-target containment

- **Decision**: `ship.ts` exports one `ship(options)` function. Per-target work is wrapped in a `try/catch` so one target's failure does not abort the run; remaining targets still attempt. Per-target structured outcome is returned; the process exit code is `max(t.exit_code)`.
- **Rationale**: keeps the command flow linear and testable. Tests stub the git-ops and gh modules to exercise every branch deterministically.
- **Consequences**: typed `ShipError` subclasses (`ShipPreconditionError`, `ShipHookError`, `ShipPushError`, `ShipGhError`, `ShipStashError`) are caught at the per-target boundary and translated to the structured result.

### AD-11. No `.weave/config.yml` in v1

- **Decision**: behaviour is fixed by code (lane scope globs, foreign-knowledge heuristic, exit-code map, etc.). Only CLI flags vary.
- **Rationale**: PRD non-goal; defers config schema design until usage data drives it.
- **Consequences**: any user wanting different scope must edit code or use `--lane`. Future config layer can be added without breaking semantics by treating absence-of-config as today's defaults.

## Rejected Alternatives

### Extend `ArtifactName` directly to include `implementation` and `review`

- **Why rejected**: `artifactFileName`, `artifactFrontmatter`, and `defaultArtifactSource` would need sentinel returns or `throw "not_a_file_lane"`. The single-union shape blends two concerns (file-backed artifact vs broader lane signal). The cost of carrying both types is small.
- **When viable**: if future lanes all have a backing file (e.g. `tasks.md` for `implementation`), folding back into one type would be cleaner.

### Rename `ArtifactName` to `LaneName` everywhere

- **Why rejected**: every call site and existing test must change. The on-disk session state field name (`artifact`) would either remain a misnomer or require a schema migration. The narrow file-only meaning is genuinely useful for typing the file helpers.
- **When viable**: as part of a broader internal-API cleanup that already touches every caller.

### Filesystem discovery for multi-target

- **Why rejected**: would iterate orphaned change folders or session-disconnected repos. Surprising for users who use `weave change propagate` to manage multi-target work.
- **When viable**: if a future workflow lets users carry change folders without the corresponding session-state hint.

### Sub-primitives `weave ship commit` / `weave ship push` / `weave ship pr`

- **Why rejected**: PRD non-goal in v1. Single command keeps the surface small and the operation idempotent.
- **When viable**: if users routinely want to skip commit / push / PR independently, the sub-primitives can be added without breaking the top-level shape.

### `weave change advance --to <stage>` command

- **Why rejected**: `weave artifact current set <name>` already covers any-direction lane moves with no new state. Avoids a redundant primitive.
- **When viable**: if change-level lifecycle (open / shipped / abandoned) is repurposed onto `status.yml#stage` later, an explicit advance command may make sense for that distinct concern.

### Auto-stash by default, no `--stash` opt-in

- **Why rejected**: silently mutating the user's worktree is dangerous. Even with restore-on-exit, a stash conflict can strand work.
- **When viable**: if user feedback shows the opt-in friction outweighs the safety benefit, this can be flipped to a config knob (with `--no-stash` opt-out) without breaking the CLI shape.

### Persisting stash refs to `sessions/` or `.weave/`

- **Why rejected**: stash refs are short-lived; persisting them invites stale state across multiple ship invocations. Print-on-failure is sufficient and matches `git stash` UX.
- **When viable**: if stash workflows become long-lived (multi-day partial work), a `.weave/ship-stash.yml` could be added.

### Caching PR URL in session state

- **Why rejected**: cache invalidation is hard. `gh pr view --json url` is fast enough; idempotency is preserved naturally by querying live state.
- **When viable**: if `gh` round-trips become a noticeable bottleneck (rare for an interactive CLI).

### Native (non-`gh`) GitHub PR creation via Octokit

- **Why rejected**: adds a runtime dependency, requires token management, and duplicates `gh`'s authentication UX. PRD non-goal.
- **When viable**: if Weave wants to support PR creation in environments without `gh` (CI containers, restricted shells).

## Constraints and Tradeoffs

- **Repo conventions**: ESM with `.js` import specifiers (NodeNext resolution); Commander for CLI; vitest for tests; YAML for serialised state. New modules follow these without exception.
- **No new runtime dependencies**: `gh` and `git` are runtime tools detected at use-time. No `octokit`, no `simple-git`. Cost: we wrap `gh` shell calls and parse `git` text output. Benefit: install footprint and supply chain stay narrow.
- **Locale safety**: `git` text output is locale-sensitive in some places. We normalise by spawning with `LANG=C` and using `--porcelain` flags that are stable across versions.
- **Process lifecycle**: ship is a short-lived CLI; orchestration uses promise chains rather than streaming. Long-running git operations (`push` over slow networks) are not parallelised across targets in v1; they are sequential to keep output deterministic.
- **Lane scope is hardcoded**: globs are baked into `lane-scope.ts`. Tradeoff: any user wanting different scope must use `--lane` or fork. PRD non-goal in v1; future config layer can hoist.
- **Foreign-knowledge bundling is hardcoded**: same tradeoff. Open Technical Question tracks the cross-reference-aware variant.
- **Single orchestrator pattern**: per-target failures are contained in-process. This trades observability of partial failures (which we capture in `ShipResult.targets`) for the simplicity of one entry point.
- **Backward-compat is one-way**: `LaneName` widening means new session files (`artifact: implementation`) are not loadable in older CLIs. Acceptable given that session state is a per-developer cache, not shared persistence.
- **Pre-commit hooks**: ship respects them; one auto-modify retry is allowed, then the operation fails. Tradeoff: extremely noisy hooks (e.g. format-on-save loops) can fail twice in a row; ship surfaces the hook stderr so the user can fix the hook.
- **Idempotency**: ship's idempotency is a function of git/gh observability. A `gh pr view` failure (e.g. transient gh service hiccup) could cause ship to skip the PR step on one run and create a duplicate on the next; we mitigate by retrying `findPrForBranch` once on transient errors.
- **JSON mode purity**: `--json` writes only `ShipResult` to stdout and writes nothing to stderr. Warnings that human mode prints (e.g. lane warnings) are surfaced in `ShipResult.message` instead.

## Integration Points

### git (subprocess, required)

- Commands wrapped in `src/lib/git.ts` and `src/lib/git-ops.ts`: `status --porcelain=v1 -z`, `add`, `commit`, `push`, `stash`, `branch --show-current`, `rev-parse`, `symbolic-ref`, `config --get`, `checkout`.
- Spawn via `execFile("git", args, { cwd, env: { ...process.env, LANG: "C" } })`.
- Minimum version: git >= 2.30 (porcelain v1 -z output stable; `symbolic-ref refs/remotes/origin/HEAD` widely supported).
- Failure modes surfaced as typed `ShipError` subclasses.

### gh (subprocess, optional)

- Commands wrapped in `src/lib/gh.ts`: `--version`, `auth status`, `pr view --json url,isDraft,number,state`, `pr create --title --body --base --head [--draft]`, `pr ready`.
- Detection happens at use-time per target.
- Recognised hosts for compare-URL fallback: `github.com`, `gitlab.com`, `bitbucket.org` (both SSH and HTTPS remote forms).
- Minimum recommended `gh` version: `>= 2.0` (for `pr view --json` and `pr ready` syntax). Not enforced; older versions surface as `gh --version` parse failures and a recommendation in the warning.

### Session state (`~/.cache/weave/current-session.yml`)

- Read for: target discovery (folders with matching `current_change.id`), `current_change.id` / `branch`, `current_artifact.artifact` (now `LaneName`).
- Written by `setCurrentArtifact` (existing) and `setCurrentChangeForPath` (existing). Ship does not write session state.
- Schema bump: `SessionCurrentArtifact.artifact` widens to `LaneName`. Field name unchanged on disk.

### `wiki/changes/<id>/status.yml`

- Read for: `<type>` and `<title>` (used in commit subject and PR title); `change_id` fallback.
- Written by `setCurrentArtifact` via `mirrorStageToStatusYml` (display cache). Ship does not write `status.yml`.
- Atomic writes via `writeFileAtomic`.

### `wiki/changes/<id>/sessions/*.md`

- Read for: latest active-lane session note's `## Summary` excerpt, used in the commit body and (by the skill, not the CLI) for preflight context.
- Filename pattern: `YYYY-MM-DD-<short>-<lane>.md`. Newest-first order by filename lexicographically suffices for v1.

### `wiki/changes/<id>/{exploration,prd,architecture,tasks}.md`

- Read for: artifact-presence inference (`lane.ts`).
- Read by the `weave-ship` skill for preflight (`Open Questions`, `PRD Readiness`, etc.).
- Written by lane skills, not by ship.

### Skill templates

- `templates/skills/weave-ship/SKILL.md` is bundled and installed by `weave agent install <agent>` like all other skills (per `src/lib/agent-skills.ts`).
- Existing lane skill templates (`weave-{capture,explore,prd,architect}/SKILL.md`) get a Conditional Ship Suggestion section. Hash-tracked install in `.weave/agents.yml` means pre-existing user installs need a `weave agent update <agent>` to pick up the suggestion footer.

## Rollout and Migration

### Versioning

- Minor bump in `package.json` (additive feature; no breaking CLI changes for existing commands).
- Release notes call out:
  1. `weave ship` is the new way to commit, push, and open a PR for the active change.
  2. `weave artifact current set` accepts `implementation` and `review` in addition to existing values.
  3. `status.yml#stage` is now a display cache; it may be updated whenever artifact context changes.
  4. The `weave-ship` skill is new; lane skills updated with conditional ship-suggestion footers; rerun `weave agent update <agent>` to pick up the changes.

### Schema migration

- **Session state**: `SessionCurrentArtifact.artifact` widens its accepted set. No migration step; older session files (`artifact: exploration|prd|architecture`) load unchanged. New writers may set `artifact: implementation|review`; older readers (older CLI versions) will reject these with the existing `Unsupported artifact:` error. This is a one-way compat: old data works in new CLI; new data may not work in old CLI. Acceptable given session state is per-developer cache.
- **`status.yml`**: adding a write path that mirrors `stage` is additive. Older CLIs ignore changes to a field they don't update.

### Skill installation

- Existing installs need a re-sync to pick up the updated lane skills' suggestion footer and the new `weave-ship` skill. `weave agent update <agent>` is hash-tracked: any user-edited skill is preserved; only unmodified ones are re-installed.
- The new `weave-ship` skill installs alongside the existing skills under `.claude/skills/`, `.opencode/commands/`, `.agents/skills/` per the agent's install map.

### Rollback

- Revert the npm package version. Session state remains forward-compatible for the `exploration | prd | architecture` lanes; if a user previously ran `weave artifact current set implementation` with the new CLI, the older CLI will fail to parse that value. Recovery: run `weave artifact current clear` from any new-CLI install, or hand-edit the YAML.

### Backfill / dual-write / dual-read

- Not applicable. No data migration; session state widening is additive.

### User communication

- Release notes section: "What's new", "Migration notes", "Skills to re-sync".
- A `weave skill show weave-ship` example in the README. The "## `weave change`" section gets a "see also: `weave ship`" reference.

## Observability and Operations

### Output channels

- **Human mode (default)**: per-target summary on stdout. One block per target with the lines: `Target`, `Lane`, `Guard`, `Commit`, `Push`, `PR`, `Stash`, `Foreign-knowledge`. Warnings (lane fallback, gh-not-installed, gh-unauth, non-GitHub host, foreign-knowledge files, lane-mismatch hints) go to stderr.
- **JSON mode (`--json`)**: a single `ShipResult` object on stdout. Nothing on stderr.

### Logs and dashboards

- No telemetry / metrics in v1 (PRD non-goal). No remote logging.
- Local diagnostic logging is captured in the `ShipResult` itself: every step's structured outcome plus optional `error` strings.

### Health checks

- `weave ship --json` from a CI scratch repo can serve as a smoke test. Exit code 0 with `pr.action !== "error"` indicates a healthy operation.

### Expected failure modes

| Failure | Code | User message |
| --- | --- | --- |
| No active change | 2 | `No active Weave change. Run weave change new or weave change switch first.` |
| Wrong branch | 2 | `On branch <current>; expected change/<id>. Run weave change switch <id>.` |
| Not a git repo | 2 | `Path is not in a git repository: <target>.` |
| `status.yml` corrupt | 2 | `Change folder corrupt: missing or unparseable status.yml at <path>.` |
| Guard block | 3 | `Leaked files outside <lane> scope: <files>. Use --stash to set them aside, or weave artifact current set <other-lane> / weave ship --lane <other-lane> to change scope.` |
| Hook fail | 4 | `Pre-commit hook failed: <stderr>.` |
| Push fail (non-fast-forward) | 5 | `Push rejected: <stderr>. Pull or rebase first.` |
| `gh pr create` fail | 6 | `gh pr create failed: <stderr>.` |
| `gh pr ready` fail | 6 | `gh pr ready failed: <stderr>.` |
| Stash restore conflict | 7 | `Stash restore conflict. Stash entry retained as <ref>. Recover with: git stash list && git stash pop <ref>.` |
| Unexpected | 1 | `Unexpected error: <message>.` |

### Recovery and support workflows

- **Stash restore conflict (exit 7)**: developer runs `git stash list` to find the entry and `git stash pop <ref>`; if conflict persists, manual merge. Ship leaves the stash entry intact deliberately.
- **Lane-mismatch false-block**: hint message points to `weave artifact current set <impl-lane>` or `weave ship --lane <name>`. Idempotent recovery.
- **Multi-target partial failure**: ship reports each target's outcome; user reruns ship in just the failed target (per-target idempotency makes this safe).
- **Pre-commit re-fail**: the hook output is included in `commit.error`. Developer fixes the hook or stages the auto-modifications manually before retrying.
- **Foreign-knowledge surprise**: developer sees the `foreign_knowledge_files` list and decides to `git revert` or split into a separate change. Ship does not block.

## Testing Strategy

### Unit tests (vitest)

- `tests/lane.test.ts`:
  - `resolveLane` priority order: flag > sessionLane > inferred.
  - All five inferred branches based on artifact presence (populated `tasks.md`, `architecture.md`, `prd.md`, none).
  - Unknown lane in session state -> impl-lane fallback with warning.
  - Invalid `--lane` flag -> `ShipPreconditionError("invalid_lane")`.
- `tests/lane-scope.test.ts`:
  - In-scope vs leak partitioning across all five lanes.
  - Foreign-knowledge classification for `wiki/knowledge/**`.
  - `inScopeGlobs` for unknown lane (impl-lane permissive set).
  - Path edge cases (paths with spaces, paths with unicode, deep nesting).
- `tests/git.test.ts` (extended):
  - Lifted helpers behave identically to the previous private versions.
- `tests/git-ops.test.ts`:
  - Pure helpers (`compareUrl` parsing for github/gitlab/bitbucket SSH and HTTPS forms; `defaultBaseBranch` fallback ladder).
- `tests/gh.test.ts`:
  - Detection helpers via injectable `which` / spawn wrappers; no real `gh` required for CI.
- `tests/lane-suggestion.test.ts`:
  - Both renderers return text or `undefined` for the documented inputs.

### Integration tests (vitest, real `git init` in tmpdir)

- `tests/ship.test.ts`:
  1. Exploration ship happy path: clean worktree, only `exploration.md` dirty, commit + push to a fake bare upstream, `gh` stubbed to return PR-not-found, `createPr` invoked with draft.
  2. Guard block: dirty `src/cli.ts` while lane is `exploration`, no `--stash` -> exit 3.
  3. `--stash` happy path: dirty `src/cli.ts` + `exploration.md`, lane exploration, `--stash` -> commit only `exploration.md`, push, PR; stash popped at end.
  4. `--stash` restore conflict: stash content modified externally during run -> exit 7, stash ref printed.
  5. No `gh` skip: `gh` not on PATH -> commit + push succeed, `pr.action: "skipped_no_gh"`, exit 0.
  6. `gh` unauth skip: `gh auth status` exit 1 -> `pr.action: "skipped_unauth"`, exit 0.
  7. No remote skip: `origin` not configured -> push fails (exit 5) (not the same as the skip cases).
  8. Multi-target session-state discovery: two session folders, both with the matching `current_change`, both ship, both report.
  9. Pre-commit hook reformat retry: hook modifies `exploration.md` first time -> ship re-stages and retries; second commit succeeds with `commit.reStaged: true`.
  10. Pre-commit hook re-fail: hook modifies on retry -> exit 4.
  11. Wrong branch precondition: on `main` -> exit 2.
  12. Lane override: `--lane implementation` while session lane is `exploration` -> different scope; `lane_source: "flag"`.
  13. Auto-promotion: existing draft PR + lane crosses to `implementation` -> `pr.action: "promoted_to_ready"`.
  14. Idempotency: run ship twice in a row with no changes -> second run prints `No in-scope changes to commit.` and `pr.action: "existing"`, exit 0.
  15. JSON mode purity: `--json` writes single ShipResult to stdout; `process.stderr.write` not called.

- The integration tests stub `gh` with a small fake binary (test-only) that responds via env-var-controlled fixtures, so CI does not require GitHub API access.

### Schema / compatibility tests

- `tests/lane-name-compat.test.ts`:
  - Loading older session files (`artifact: exploration|prd|architecture`) under the new TS types succeeds.
  - Saving and re-loading `artifact: implementation|review` round-trips cleanly.
  - Validate that `parseArtifactName("implementation")` succeeds and `parseArtifactName("invalid")` fails with a clear error.

### Skill template tests

- `tests/agent-skills.test.ts` (extended): a case for the new `weave-ship` skill file shape (frontmatter present, sections in order, includes Plan-Mode guard).
- `tests/cli-skills.test.ts` (extended): `weave skill show weave-ship` returns the expected content.

### Manual verification

- Real `gh pr create` against a sandbox GitHub repo for the exploration -> PRD -> architecture -> implementation happy path; record results in PR description.

### Coverage targets

- Unit: full coverage of `lane.ts`, `lane-scope.ts`, `lane-suggestion.ts`, the pure helpers in `git-ops.ts` and `gh.ts`.
- Integration: every documented exit code (0, 1, 2, 3, 4, 5, 6, 7) is exercised by at least one test.
- No live `gh` calls in CI.

## Security and Data Integrity

### Authorization

- Ship calls `git` and `gh` as the user's process identity; permissions follow the user's git credentials and `gh` token.
- Ship does not store, transmit, or read credentials. There is no Weave-It-managed authentication state.
- For multi-target propagated changes, each target repo's own credentials apply independently.

### Sensitive data handling

- Commit messages and PR bodies include text from `status.yml` (`title`, `type`, `id`), the latest active-lane session note's `## Summary`, and (optionally) skill-synthesized `--message-body` / `--pr-body-extra`. All of this is user-authored text. Ship does not redact.
- The `weave-ship` skill template explicitly instructs the agent: "Do not put secrets, tokens, or credentials in session-note `## Summary` blocks. They will be copied verbatim into commit and PR bodies."
- No `wiki/changes/<id>/**` content is ever sent to a remote service by ship; the only egress is `git push` and `gh pr create` (which embed the commit and PR body in the GitHub repo / PR).

### Validation and invariants

- Lane names validated against `LaneName` set (`exploration | prd | architecture | implementation | review`). Unknown values fall back with a warning.
- Branch precondition validates exact match `change/<active-id>`. No string-prefix or fuzzy matching.
- `git status --porcelain=v1 -z` parsing handles paths containing spaces, quotes, control characters, and unicode (via the `-z` NUL-separator output).
- `getDirtyFiles` rejects relative path components (`..`) defensively even though git emits repo-relative paths.
- `partitionDirty` uses POSIX-style globs against forward-slash repo-relative paths; on Windows paths are normalised to forward slashes before matching.
- All filesystem writes go through `writeFileAtomic` to avoid torn writes (display cache mirror to `status.yml`).

### Auditability and retention

- Every successful ship leaves a permanent audit trail: a git commit with the lane in its subject (`<type>(<id>): <lane> - <title>`) and a PR with a templated metadata block. No log retention to manage.
- The change folder under `wiki/changes/<id>/` and the `sessions/*.md` notes provide the longer-form rationale, separately committed.

### Abuse and misuse risks

- Ship can be scripted (CI), but it always runs in the user's git context. No new attack surface beyond `git` and `gh` themselves.
- A malicious pre-commit hook could alter the commit; ship retries once and surfaces the hook output, but ultimately respects the hook (no `--no-verify`). Mitigation: users review the diff before pushing, and ship surfaces the staged-files list explicitly.
- A malicious `gh` shim on PATH could capture credentials. Mitigation: outside Weave's control; same risk exists for any tool that invokes `gh`.

## Implementation Risks

### IR-1. Stash restore conflict UX

- **Risk**: a developer using `--stash` could lose their leaked work if the recovery message is unclear, or if the stash entry is silently dropped.
- **Impact**: data loss in the worst case; user trust loss in the typical case.
- **Mitigation**: print the stash ref and explicit recovery commands (`git stash list`, `git stash pop <ref>`); leave the stash entry in place on conflict (don't auto-pop); exit 7; integration test covers the conflict path.

### IR-2. Pre-commit hook race after auto-modification

- **Risk**: an aggressive hook (e.g. format-on-save) could modify files repeatedly, causing infinite retry or stale staged trees.
- **Impact**: ship hangs or commits incorrect content.
- **Mitigation**: hard cap at one retry; explicit re-stage of the original target file set (not "everything dirty"); integration tests for both retry-succeeds and retry-fails.

### IR-3. `gh` text-output drift

- **Risk**: future `gh` versions change output format, breaking detection or PR-view parsing.
- **Impact**: ship may fail to detect existing PRs (creating duplicates) or skip the PR step erroneously.
- **Mitigation**: rely on `gh pr view --json url,isDraft,number,state` whose schema is contract-stable; defensively handle missing fields; pin tested `gh` versions in release notes; surface raw `gh` stderr in `pr.error` so users can debug.

### IR-4. Multi-target partial failure ordering

- **Risk**: target B fails after target A succeeds; mixed state across repos confuses the user.
- **Impact**: developer needs to recover one repo while another is already shipped.
- **Mitigation**: per-target containment; structured `ShipResult.targets` so the user sees exactly what happened where; non-zero exit; ship is idempotent so re-running in target B alone fixes it.

### IR-5. Foreign-knowledge classification false-positives

- **Risk**: legitimate, intentional knowledge updates classified as "foreign" -> noisy output.
- **Impact**: developer trust erodes; users start ignoring the warning; defeats the safety purpose.
- **Mitigation**: clear labelling in human mode ("listed for split, not a block"); `Open Technical Question` tracks the cross-reference-aware variant; if data shows the heuristic is wrong, refine in v2.

### IR-6. Lane-mismatch false-blocks

- **Risk**: developer is editing source code with stale `weave artifact current` (e.g. forgot to switch from `exploration` to `implementation`); ship blocks unexpectedly.
- **Impact**: developer friction; "ship is broken" perception.
- **Mitigation**: clear hint in the block message: `Run weave artifact current set implementation, or weave ship --lane implementation, to commit code-touching work.`; the inferred-lane fallback eventually surfaces the right answer if a populated `tasks.md` exists; integration test covers the message format.

### IR-7. `LaneName` widening one-way compat

- **Risk**: a user with mixed-version installs (older CLI elsewhere, newer CLI here) writes `artifact: implementation`; older CLI fails.
- **Impact**: "weave broken" reports from users with stale installs.
- **Mitigation**: documented in release notes; older CLI's `Unsupported artifact:` error already names the bad value clearly; recovery is `weave artifact current clear`.

### IR-8. Idempotency vs concurrent ships

- **Risk**: two `weave ship` runs in quick succession (e.g. user double-invokes) could race on `gh pr view` -> both create a PR.
- **Impact**: duplicate PRs, manual cleanup.
- **Mitigation**: `gh` itself rejects duplicate PRs for the same head branch with a typed error; ship surfaces that error and reports `pr.action: "error"` with `pr.error: "<gh stderr>"` rather than crashing. A future `--lock` flag can add explicit serialisation if this becomes common.

### IR-9. Templated PR body drift between CLI versions

- **Risk**: changing the templated PR body in a future release would alter existing PRs on next ship.
- **Impact**: unexpected PR body diffs in unrelated commits.
- **Mitigation**: ship updates the PR body only on creation; subsequent runs don't rewrite the body. `--pr-body-extra` is appended on creation only; re-running ship does not re-append.

### IR-10. Cross-platform path semantics

- **Risk**: glob matching of repo paths differs subtly on Windows (backslashes vs forward slashes).
- **Impact**: leak guard misses leaks or false-flags in-scope files on Windows.
- **Mitigation**: normalise to forward slashes before matching; explicit cross-platform tests (skipped on non-Windows CI for now; enabled if Windows support becomes a goal).

## Assumptions

- The Weave-It session-state schema can be widened (`SessionCurrentArtifact.artifact: LaneName`) without a formal migration; older session files continue to load.
- Users have `git >= 2.30` (porcelain v1 -z stable) and a modern POSIX shell.
- `gh >= 2.0` when installed (for `pr view --json` and `pr ready` syntax). Older versions surface as a recommendation, not a hard fail.
- The default base branch can be detected via `git symbolic-ref refs/remotes/origin/HEAD` in most repos. The `main` literal fallback is rarely hit and acceptable when it is.
- Branch precondition (`change/<id>` exact match) is sufficient. Ship does not need to re-validate against `weave change current` beyond what `change status` already does.
- "Populated `tasks.md`" can be detected heuristically (`- [` line after frontmatter). If a future `tasks.md` format changes, the heuristic adapts; documented in `Open Technical Questions`.
- Session notes have a `## Summary` section when the latest one is selected for the commit body. A missing `## Summary` is non-fatal: the body falls back to listing staged files only.
- The `weave-ship` skill's preflight finds findings deterministically (same artifacts -> same findings). Two independent invocations on the same state produce comparable output; this is necessary for the Plan-Mode preview to be a useful pre-check.
- Per-target sequential iteration is acceptable for v1. Parallelism (across targets) is deferred until users actually have many propagated targets where latency matters.
- The repository's pre-commit hooks (when present) operate on a small bounded number of files. Hooks that scan the entire repo on every commit may be slow but functionally correct under our retry policy.
- The `wiki/knowledge/**` foreign-knowledge default heuristic captures intent for v1 users; refinement is deferred.

## Open Technical Questions

### OTQ-1. Foreign-knowledge cross-reference refinement

Should ship treat `wiki/knowledge/**` paths cross-referenced from the active change's `exploration.md` / `prd.md` / `architecture.md` as "in-scope, not foreign", and only the rest as foreign?

- **Decision blocked**: only the v2 refinement; v1 ships with the simple `any-dirty-knowledge-is-foreign` rule.
- **Inputs needed**: real usage data on how often legit knowledge updates accompany change shipments. If common, the refinement is worth the cost.

### OTQ-2. `tasks.md` populated heuristic precision

The v1 inference rule for `implementation` lane is: `tasks.md` exists AND has at least one line matching `/^\s*-\s*\[/m` after the YAML frontmatter.

- Should it require an explicit checkbox shape (`- [ ]` or `- [x]`)?
- Should an empty `tasks.md` (header only) count as `architecture` (the lane that wrote it) or as `implementation` (the lane that consumes it)?
- **Decision blocked**: precision tuning; defer until the `weave-implement` skill exists and emits a stable `tasks.md` shape.

### OTQ-3. Pre-commit hook re-modification on retry

If the pre-commit hook modifies a different set of files on retry (e.g. introduces new files), does ship re-stage everything dirty under in-scope, or restrict to the original target list?

- v1 default: re-stage the original list only; on second hook modification, bail with hook output.
- **Decision blocked**: whether to broaden to "stage all dirty in-scope" on retry. Risk: drift between intended commit content and hook side effects.

### OTQ-4. Multi-target `weave artifact current set <lane> --target <id>`

The multi-target ship discovery model implies `weave artifact current set` could accept a target list and mirror `status.yml#stage` per target.

- v1 default: single-target only (matches existing `setCurrentArtifact` ambiguity check).
- **Decision blocked**: only multi-target lane setting; defer until users have explicit need.

### OTQ-5. Skill suggestion footer placement in lane-skill templates

Append to the existing "Completion Response" section, or add a dedicated "Next Step" section?

- v1 default: append to "Completion Response" with a clear divider line and conditional emission (only when in-scope dirty exists).
- **Decision blocked**: only template structure; the wording is locked in `lane-suggestion.ts`.

### OTQ-6. `git status` output parsing for renamed paths

`git status --porcelain=v1 -z` emits renames as `R <path1> <path2>` (single record with both paths). The v1 `getDirtyFiles` parser will normalize renames as a delete-of-old + add-of-new for partition purposes.

- **Decision blocked**: only whether to track renames specifically (e.g. for foreign-knowledge classification when the rename crosses scope boundaries). v1 default: treat both halves equally; a renamed file in scope is in scope.

### OTQ-7. Concurrent ship serialisation

If two `weave ship` runs race (user double-invocation, or CI + interactive), `gh pr create` will reject the duplicate. Should ship add a local lock file to prevent the race entirely?

- v1 default: rely on `gh`'s server-side rejection; surface the error.
- **Decision blocked**: only the `--lock` opt-in if usage data shows duplicates are common.

## Product Questions Raised by Technical Design

### Foreign-knowledge cross-reference policy

Would users expect `wiki/knowledge/billing.md` to be treated as "in-scope" (silent) when `exploration.md` references it directly, and only treat unreferenced knowledge edits as "foreign-but-bundled"? PRD currently says "bundle and warn for everything"; technical design proposes the same default. A stricter "in-scope when cross-referenced" model is a follow-up.

### "How to review" pointer text per lane

The PRD states the PR body includes a "How to review" pointer derived from lane. Architecture proposes a small lane-keyed lookup baked into ship.ts:

- `exploration` -> "Read exploration.md and the Open Questions section."
- `prd` -> "Read prd.md, focusing on Goals, Acceptance Criteria, and Functional Requirements."
- `architecture` -> "Read architecture.md, focusing on Architecture Decisions, Implementation Risks, and Testing Strategy."
- `implementation` -> "Read tasks.md and review the diff against architecture.md's Implementation Risks."
- `review` -> "See the latest review comments on this PR; the diff addresses them."

Is this lane-keyed text correct, or should the PRD specify exact wording? Architecture takes the reasonable defaults above unless the PRD revises.

## Revision History

- 2026-05-30: Initial architecture generated from `prd.md` and codebase review.
- 2026-05-31: Expanded the `src/commands/ship.ts` flag descriptions and added "`--lane` semantics" + "Operational distinction: persistent vs one-shot lane changes" subsections under `Proposed Architecture`. Captures the four downstream surfaces `--lane` affects (scope partition, commit subject, PR draft/ready default, auto-promotion eligibility, PR body pointer text) and the "do not reach for `--lane` repeatedly" guidance. No structural / decision changes.
