---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-04T14:28:25.706Z
updated_at: 2026-06-04T16:07:31.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Add A Repo Folder

## Topic

Add a repo or folder to an existing Weave workspace post-creation, with automatic `.gitignore` and `.weave/workspace.yml` integration, and capture the git remote URL when the folder is a git repo.

## Current Understanding

A user has already created a Weave workspace via `weave init --mode workspace`. They now need a way to grow that workspace by registering additional repos or folders without re-running `init`. Today this gap is partially covered by `weave add`, but only at the session level: `weave add` writes to `~/.cache/weave/current-session.yml` and does not touch `.weave/workspace.yml` or the workspace `.gitignore`. As a result, repos added after workspace creation are invisible to teammates and to CI, and the outer workspace git repo will see the added folder as untracked.

The desired behavior is for `weave add` to become mode-aware:

- In repo mode, behavior is unchanged.
- In workspace mode, `weave add` becomes the canonical command for growing the workspace. It accepts a path (inside or outside the workspace) or a git URL, writes the `workspace.yml` `repos` entry, updates the workspace `.gitignore`, and captures the git remote URL when present.

This keeps the existing two-mode product model intact: single repo work uses repo mode, multi-repo work uses workspace mode, and the same `weave add` verb covers both.

## Open Questions

None remaining that affect product scope.

## Decisions

- `weave add` is mode-aware. The command detects the active mode via the workspace's `.weave/workspace.yml` `mode` field (or absence in pure repo mode).
- **Repo mode** behavior is unchanged. The command accepts only a path, registers it in the ephemeral session under `session.folders`, and does not write any committed files.
- **Workspace mode** accepts either a path or a git URL:
  - **Git URL**: Weave runs `git clone <url>` into the workspace root. The cloned directory is named from the URL's repo basename (e.g. `git@github.com:foo/bar.git` -> `./bar`). No naming override is provided in this change.
  - **Path inside the workspace**: Weave registers the folder in place.
  - **Path outside the workspace**: Weave adopts the folder by moving it into the workspace root, mirroring how `weave init --mode workspace` adopts the current git repo today.
- In all workspace-mode cases, after the folder is in place inside the workspace, Weave:
  - Appends `/<dirname>/` to the workspace `.gitignore` (idempotent: skips if already present).
  - Writes `.weave/workspace.yml` `repos.<slug> = { path: "<dirname>", kind, remote? }`.
  - Captures `remote.origin.url` if the folder has a `.git/`. Omits the `remote` field when absent or unset.
  - Does NOT write to `session.folders`. The workspace pointer stays as the only session entry, matching `weave init --mode workspace`'s existing behavior.
- **Non-git folders** in workspace mode are still registered and still gitignored. They appear under `repos.<slug>` with no `remote` field.
- **Already-registered paths** in workspace mode are an idempotent no-op. The command prints a clear "already registered" message and exits successfully.
- **`--id` and `--kind`** flags continue to work the same way they do today, controlling the `workspace.yml.repos.<id>.kind` value and the registry key respectively in workspace mode.
- Internally, the "register a repo into a workspace" step in `scaffoldWorkspace` (`src/lib/init-workspace.ts`) is factored out into a shared helper that both `weave init --mode workspace` and the new workspace-mode `weave add` branch call. This guarantees that adopting a repo at init time and adding a repo post-init produce identical workspace state.
- **Mode detection rule (shared by `weave add` and `weave workspace`).** Walk up from `cwd` to find `.weave/workspace.yml`. If found with `mode: workspace`, treat the active context as workspace mode. Otherwise treat it as repo mode. The rule is committed-truth-driven and survives session resets and fresh clones.
- **`weave workspace` becomes mode-aware** in this change. For each session folder, look at the folder's `.weave/workspace.yml` and decide per folder:
  - Workspace mode: read `repos` and include them in both text and JSON output. The JSON gains an additive `repos` field per workspace folder. The text output indents the repos list under each workspace folder line.
  - Repo mode (or `workspace.yml` missing/unparseable): fall back to today's behavior - show only the folder itself.
- **Graceful degradation** in `weave workspace`: if `workspace.yml` is missing or unparseable for a folder that session marks `kind: workspace`, show only the folder itself without a warning. No crash.
- **Known v1 limitations** (accepted, not blockers):
  - `weave change <subcommand> --target all` does not fan out to sub-repos in workspace mode; it still enumerates `session.folders`, which holds only the workspace.
  - `weave change <subcommand> --target <short-id>` does not resolve sub-repos in workspace mode unless they were lazy-grown into `session.folders` by a prior per-folder command.
  Both are acceptable because sub-repos in default workspace mode do not have their own `wiki/changes/`.

## Scenarios

- **User clones a third sub-repo into a workspace.** From inside `peoplebox-platform/`, runs `weave add git@github.com:peoplebox/billing.git`. Weave clones to `./billing/`, adds `/billing/` to `.gitignore`, writes `repos.billing = { path: "billing", kind: "app", remote: "git@github.com:peoplebox/billing.git" }`, and reports success.
- **User has already cloned a repo into the workspace.** From inside `peoplebox-platform/`, runs `weave add ./services/audit`. Weave registers it in place, adds `/services/audit/` to `.gitignore`, writes `repos.audit = { path: "services/audit", kind: "app", remote: "<discovered origin>" }`.
- **User wants to bring an external repo into the workspace.** From inside `peoplebox-platform/`, runs `weave add ../external-tooling`. Weave moves `external-tooling` into the workspace root, then registers and gitignores it.
- **User adds a non-git scratch folder.** Runs `weave add ./shared-notes` inside the workspace. Weave registers it, gitignores it, omits `remote`.
- **User retries an `add` for a repo already in `workspace.yml`.** Weave detects the duplicate, prints "already registered", exits 0 without modifying any files.
- **User runs `weave add ../neighbor` in repo mode.** Behavior is unchanged: ephemeral session entry, no workspace.yml or gitignore writes. (This corner of repo mode remains available but is not the recommended workflow once a workspace exists.)
- **User runs `weave workspace` after registering several repos.** In workspace mode, output shows the workspace folder line, indented underneath with each `repos.<id>` from `.weave/workspace.yml` (id, path, kind, remote when present). JSON output gains a `repos` array on the workspace folder entry.
- **Teammate clones the workspace fresh and runs `weave workspace`.** Their `session.folders` is empty until they `weave init` (or any session-creating command). Once a session exists with the workspace folder, `weave workspace` reads `.weave/workspace.yml.repos` and shows the same repo list the author saw - because the source of truth is committed, not session-local.

## Existing Behavior

- `weave init --mode workspace` already creates `.weave/workspace.yml` with `version`, `mode`, `name`, `repos`, and a workspace `.gitignore`. When run from inside a git repo, it adopts that repo: moves it into the workspace, adds `/<repo-name>/` to `.gitignore`, and records `repos.<id> = { path, kind, remote? }` (see `scaffoldWorkspace` in `src/lib/init-workspace.ts`).
- `weave add <path>` exists today but only touches the local session in `~/.cache/weave/current-session.yml` (see `addFolder` in `src/lib/add-folder.ts` and `addFolderToSession` in `src/lib/session-state.ts`). It does not update `.weave/workspace.yml` or `.gitignore`.
- `session.folders` and `workspace.yml.repos` are two registries. In workspace mode today, `session.folders` holds only the workspace pointer; `workspace.yml.repos` holds the committed list of sub-repos. The lazy-growth path in `ensureFolderInSession` adds a sub-repo to `session.folders` only when a per-folder change/artifact command touches it directly.
- `weave workspace` today reads only `session.folders` and does not inspect `.weave/workspace.yml`. The current knowledge doc explicitly documents this as a v0 gap: "it does not inspect `.weave/workspace.yml`; it does not list repos from workspace metadata". After this change, this gap is closed for workspace-mode folders.

## PRD Readiness

Ready.
