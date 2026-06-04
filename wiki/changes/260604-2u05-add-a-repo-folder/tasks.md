---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-04T16:25:40.000Z
updated_at: 2026-06-04T16:25:40.000Z
source: architecture.md
---

# Tasks: Add a repo/folder

## Source Context

- PRD: `wiki/changes/260604-2u05-add-a-repo-folder/prd.md`
- Architecture: `wiki/changes/260604-2u05-add-a-repo-folder/architecture.md`
- Exploration: `wiki/changes/260604-2u05-add-a-repo-folder/exploration.md`
- Codebase: `src/lib/add-folder.ts`, `src/lib/init-workspace.ts`, `src/lib/show-workspace.ts`, `src/lib/git.ts`, `tests/init.test.ts`
- External references: none

## Local Tracking Status

External issue publishing status: not used. This change tracks implementation locally in this file.

## Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified
- `not_tested`: implementation appears complete, but automated verification could not be completed
- `invalid`: no longer applies after source context changed

## Active Task Index

| ID | Status | Type | Title | Blocked by |
| --- | --- | --- | --- | --- |
| T1 | todo | AFK | Register in-workspace path via weave add | None |
| T2 | todo | AFK | Adopt outside path into workspace via weave add | T1 |
| T3 | todo | AFK | Clone and register repo by git URL via weave add | T1 |
| T4 | todo | AFK | Idempotent re-add and repo-mode regression | T1 |
| T5 | todo | AFK | weave workspace lists repos in workspace mode | T1 |
| T6 | todo | AFK | Init adoption uses shared registerRepoIntoWorkspace | T1 |
| T7 | todo | AFK | Update README and core command reference knowledge | T5, T6 |

## T1: Register in-workspace path via weave add

Status: todo

Type: AFK

Blocked by: None - can start immediately

User stories covered: 4, 6 (foundation for 2, 3, 9)

Origin: none

Related finding: none

### What to build

Introduce `src/lib/workspace-mode.ts` with `findWorkspaceMode(startPath)` (walk up to `.weave/workspace.yml`, parse `mode`). Introduce `src/lib/workspace-repos.ts` with URL/path helpers, `readWorkspaceMetadata`, `appendGitignoreEntry` (precise `/<relativePath>/`, idempotent), `registerRepoInWorkspaceMetadata` (slug collision error), and `registerRepoIntoWorkspace`. Add `cloneRepo` to `src/lib/git.ts` for later slices but wire only what T1 needs.

Update `src/lib/add-folder.ts`: when `findWorkspaceMode(cwd)` returns workspace mode, handle **in-workspace path only** (resolve path, compute relative path, skip if already registered by path, `getGitRemote` when `.git/` exists, call `registerRepoIntoWorkspace`, do not call `addFolderToSession` for the sub-repo). Fall through to existing repo-mode path otherwise.

### Acceptance Criteria

- [ ] `findWorkspaceMode` returns workspace mode when cwd is inside a workspace with `mode: workspace` in `.weave/workspace.yml`
- [ ] `weave add ./<dir>` inside an empty workspace writes `repos.<slug>` with `path`, `kind`, and `remote` when origin exists
- [ ] `weave add ./<non-git-dir>` registers and gitignores without a `remote` field
- [ ] Precise gitignore line `/<relativePath>/` is appended once; second append is a no-op
- [ ] Workspace-mode add does not add the sub-repo to `session.folders`
- [ ] Repo-mode `weave add` code path is untouched in behavior (may add tests in T4)

### Verification

- Automated tests: `npm test` — new cases in `tests/init.test.ts` for in-workspace add and non-git folder
- Manual/smoke check: `npm run dev -- init --mode workspace ...` then `npm run dev -- add ./local-repo` and inspect `.weave/workspace.yml` and `.gitignore`

## T2: Adopt outside path into workspace via weave add

Status: todo

Type: AFK

Blocked by: T1

User stories covered: 5

Origin: none

Related finding: none

### What to build

Extend the workspace branch in `add-folder.ts`: when the resolved path is outside the workspace root, `movePath` the folder into the workspace root (basename as destination), refuse if destination exists, then register via `registerRepoIntoWorkspace` with discovered `remote`. Surface move failures without writing gitignore or workspace.yml.

### Acceptance Criteria

- [ ] `weave add ../external-repo` from inside the workspace moves the folder into the workspace root and registers it
- [ ] Dirty/untracked files in the adopted repo are preserved (no clean-worktree guard)
- [ ] Move failure does not modify `.gitignore` or `workspace.yml`

### Verification

- Automated tests: `npm test` — outside-path adoption case in `tests/init.test.ts`
- Manual/smoke check: create sibling repo, run `weave add ../sibling` from workspace, confirm move + registry

## T3: Clone and register repo by git URL via weave add

Status: todo

Type: AFK

Blocked by: T1

User stories covered: 1, 9

Origin: none

Related finding: none

### What to build

Extend workspace branch: if argument matches `^(git@|https?:\/\/|ssh:\/\/|git:\/\/)`, derive destination name from URL basename (strip `.git`), refuse if `join(workspacePath, destName)` exists, run `cloneRepo`, set `remote` to the URL passed, then `registerRepoIntoWorkspace`. On clone failure, do not write registry or gitignore.

### Acceptance Criteria

- [ ] `weave add <git-url>` clones into workspace root with default directory name
- [ ] `repos.<slug>.remote` stores the URL used for clone
- [ ] Existing destination directory refuses with clear error and no file writes
- [ ] Clone failure surfaces git error and leaves workspace.yml/gitignore unchanged

### Verification

- Automated tests: `npm test` — URL clone using local bare repo as remote (same pattern as init adoption tests)
- Manual/smoke check: `weave add` with a real small public repo URL (optional)

## T4: Idempotent re-add and repo-mode regression

Status: todo

Type: AFK

Blocked by: T1

User stories covered: 7, 8

Origin: none

Related finding: none

### What to build

Path-based duplicate detection before clone/move/register: if `repos.*.path` already matches, return success with "already registered" and modify no files (including when `--id` differs). Confirm existing repo-mode tests in `tests/init.test.ts` still pass without behavioral change.

### Acceptance Criteria

- [ ] Re-running `weave add` on an already-registered path is a no-op with exit 0
- [ ] Different `--id` for same path still no-ops
- [ ] Repo-mode add still writes only to session; no workspace.yml or gitignore writes
- [ ] All pre-existing init and repo-mode add tests pass

### Verification

- Automated tests: `npm test` — duplicate add case + full suite green
- Manual/smoke check: `weave add` same path twice in workspace; repo-mode add from T1-era fixture

## T5: weave workspace lists repos in workspace mode

Status: todo

Type: AFK

Blocked by: T1

User stories covered: 11, 12, 14

Origin: none

Related finding: none

### What to build

Update `src/lib/show-workspace.ts`: per `session.folders` entry, call `findWorkspaceMode(folder.path)`. When workspace mode and metadata parses, attach `repos: [{ id, path, kind, remote? }]` to JSON output and render indented `Repos:` block in text output. On missing/malformed `workspace.yml`, show folder line only (no warning, no crash). Repo-mode folder output unchanged. Empty `repos` omits text block; JSON uses `repos: []` for shape stability.

### Acceptance Criteria

- [ ] Workspace-mode `weave workspace --json` includes additive `repos` array on the workspace folder entry
- [ ] Text output indents registered repos under the workspace folder line
- [ ] Malformed or missing workspace.yml degrades silently for that folder
- [ ] Repo-mode session output matches pre-change behavior for the same session fixture
- [ ] Mixed session (repo folder + workspace folder) renders each in its own mode shape

### Verification

- Automated tests: `npm test` — workspace JSON/text with repos, malformed yaml, repo-mode regression
- Manual/smoke check: after T1–T3 adds, run `weave workspace` and `weave workspace --json`

## T6: Init adoption uses shared registerRepoIntoWorkspace

Status: todo

Type: AFK

Blocked by: T1

User stories covered: 10 (indirect)

Origin: refactor

Related finding: R1

### What to build

Refactor `src/lib/init-workspace.ts` so adopted-repo and pre-seeded `repos` at init use the same `registerRepoIntoWorkspace` / gitignore helpers as `weave add`. Keep `scaffoldWorkspace` behavior: `writeFileIfMissing` for initial empty workspace.yml and gitignore template; use shared helpers when registering the adopted repo. All existing workspace init tests must pass.

### Acceptance Criteria

- [ ] `weave init --mode workspace` from inside a git repo produces identical `repos` + gitignore shape as equivalent `weave add` would
- [ ] Existing init workspace tests pass without weakening assertions
- [ ] After init adoption, `weave workspace` shows the adopted repo in Repos block (validates T5 + init parity)

### Verification

- Automated tests: `npm test` — existing init adoption test + `showWorkspace` shows adopted repo
- Manual/smoke check: init from nested dir inside app repo, then `weave workspace`

## T7: Update README and core command reference knowledge

Status: todo

Type: AFK

Blocked by: T5, T6

User stories covered: rollout discoverability (PRD Rollout Considerations)

Origin: none

Related finding: none

### What to build

Update `README.md` sections for `weave add` (mode-aware: path vs URL, workspace vs repo) and `weave workspace` (workspace-mode repos listing, JSON `repos` field). Update `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md`: add `Command: weave add`, revise `Command: weave workspace`, remove bullets that say workspace does not inspect `workspace.yml` or list repos.

### Acceptance Criteria

- [ ] README documents workspace-mode and repo-mode behavior for both commands
- [ ] Knowledge behavior.md matches implemented CLI behavior
- [ ] Examples cover URL clone, in-workspace path, outside adoption, and `weave workspace --json` repos shape

### Verification

- Automated tests: `npm test` (no doc tests required)
- Manual/smoke check: read docs against `npm run dev -- add --help` and `weave workspace --help` output

## QA Findings

Finding Status Legend:

- `new`: reported but not yet triaged
- `accepted`: triaged and accepted as a real defect
- `fixed`: implementation believed to address the defect
- `verified`: fix confirmed by re-test
- `duplicate`: already covered by another finding
- `not_reproducible`: could not be reproduced
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

Refactor Status Legend:

- `proposed`: identified but not yet accepted
- `accepted`: agreed to do as part of this change
- `deferred`: logged for later; no `T#` yet
- `done`: completed and verified behavior-preserving
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |
| R1 | accepted | init-workspace.ts | T6 | Extract adopted-repo registration to shared workspace-repos helpers |

## Invalid Tasks

None.

## Verification

Not run yet.
