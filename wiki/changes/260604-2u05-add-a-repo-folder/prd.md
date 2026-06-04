---
artifact: prd
status: draft
owner: product
created_at: 2026-06-04T15:40:00.000Z
updated_at: 2026-06-04T16:07:31.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Add Repo Or Folder To A Weave Workspace PRD

## Problem Statement

A user who has created a Weave workspace (`weave init --mode workspace`) currently has no first-class way to grow that workspace with additional repos or folders. The existing `weave add <path>` command only updates the ephemeral local session in `~/.cache/weave/current-session.yml`; it does not update the committed `.weave/workspace.yml` registry, does not append entries to the workspace `.gitignore`, and does not record the git remote URL of the added folder.

This creates four concrete pain points:

- **Repos added after workspace creation are invisible to teammates and CI.** Only the user's machine knows about them.
- **The workspace's outer git repo treats added sub-folders as untracked or accidentally tracked content.** Users either commit garbage by mistake or hand-edit `.gitignore` after every add.
- **There is no convenient way to bring a remote repository (by URL) into the workspace.** The user has to leave the workspace context, run `git clone`, then come back and try to register the result.
- **`weave workspace` does not surface registered repos.** Even when init adopts a sub-repo into `workspace.yml.repos`, `weave workspace` does not display it. The user has no single command to verify the workspace state and instead has to open `.weave/workspace.yml` manually.

The result is that after the workspace is created, users fall back to manually editing `.gitignore` and `.weave/workspace.yml`, and have no way to introspect the workspace short of reading those files by hand.

## Goals

- Make `weave add` the canonical, ergonomic command for growing an existing Weave workspace.
- Persist newly added repos and folders in the committed workspace registry so teammates and CI see the same workspace shape.
- Automatically gitignore added folders so the outer workspace git repo stays clean by default.
- Capture the git remote URL of any added folder that has a `.git/`, so the workspace `.weave/workspace.yml` records where each sub-repo came from.
- Support adding a remote repository by git URL in a single command, with the clone landing inside the workspace.
- Make `weave workspace` observable: in workspace mode it should display the registered repos from `.weave/workspace.yml`, so users (and teammates with fresh clones) have a single command to see the workspace state.
- Preserve existing repo-mode behavior of `weave add` and `weave workspace` without behavioral change.
- Make `weave add` and `weave workspace` agree on what mode the active context is in, using a shared committed-truth check (`.weave/workspace.yml.mode`).

## Non-Goals

- Removing or otherwise modifying any repo-mode behavior of `weave add` or `weave workspace`.
- Refactoring the dual-registry split between `session.folders` and `workspace.yml.repos`.
- Renaming `workspace.yml.repos` to a more generic term (despite the field now also holding non-git folders).
- Providing flags to override the clone destination directory name when adding by URL.
- Providing a `weave remove` or `weave unadd` complement for un-registering a previously added repo.
- Updating any existing remote URLs already recorded in `workspace.yml.repos`; the field is set on first registration and is not auto-refreshed.
- Cloning credentials handling, SSH key management, or auth prompts beyond what `git clone` does natively.
- Closing the `--target all` and `--target <short-id>` gaps for sub-repos in workspace mode. These remain accepted v1 limitations because sub-repos in default workspace mode do not have their own `wiki/changes/`.
- Pre-populating `session.folders` with workspace sub-repos (eagerly or lazily) for the sake of `weave workspace` display. `session.folders` stays as today's per-folder runtime-state store; the workspace repo list lives in `workspace.yml.repos`.

## Actors

- **Developer using Weave**: runs `weave add` from inside a workspace to bring an additional repo or folder under workspace tracking.
- **Teammate of the workspace owner**: pulls the workspace repo and expects the registered `repos` and `.gitignore` entries to reflect the team's working set.
- **Automation / agent**: invokes `weave add` non-interactively to add a known repo by URL or path.

## Current Behavior

### `weave init --mode workspace`

`weave init --mode workspace` creates a workspace with `.weave/workspace.yml`, a workspace-level `.gitignore`, and `wiki/`. When run from inside an existing git repo, init adopts that repo: moves it into the new workspace root, adds `/<repo-name>/` to the workspace `.gitignore`, and writes `repos.<id> = { path, kind, remote? }` in `workspace.yml`. The capture of `remote.origin.url` happens here.

### `weave add <path>` (today)

`weave add` is mode-agnostic. Regardless of whether the active context is a repo-mode project or a workspace-mode project, the command:

- Resolves the target path.
- Calls `ensureWeaveScaffold` on it (creating `wiki/` and `.weave/sync.yml` if missing).
- Adds an entry to `~/.cache/weave/current-session.yml` under `session.folders`.
- Prints a message and exits.

It does NOT:

- Read or update `.weave/workspace.yml`.
- Read or update the workspace `.gitignore`.
- Distinguish between a path inside the workspace, a path outside, or a git URL.

### `weave workspace` (today)

`weave workspace` is mode-agnostic and reads only the local session in `~/.cache/weave/current-session.yml`. For each entry in `session.folders` it prints the folder id, absolute path, and `kind`. In workspace mode, that is just the workspace itself.

It does NOT:

- Inspect `.weave/workspace.yml`.
- List repos registered in workspace metadata.
- Differentiate output by mode.

### Current limitations

- Adds made post-init are invisible to anyone who isn't the original user.
- Outer workspace git repo sees untracked or accidentally-staged content for every added sub-folder.
- Git remote URLs are captured only at init time for the initially adopted repo. Subsequently added repos have no recorded remote.
- `weave workspace` cannot be used to inspect the workspace's registered sub-repos. The user must open `.weave/workspace.yml` directly to see them.

### Current workarounds

- Users manually edit `.weave/workspace.yml` and `.gitignore` after running `weave add`, or skip Weave registration entirely and just hand-edit both files.
- To bring a remote repo into the workspace, users `cd` out of the workspace, run `git clone`, optionally move the clone in, then run `weave add` and hand-edit registry + gitignore.
- To verify the workspace state, users `cat .weave/workspace.yml` instead of running a Weave command.

## Proposed Product Behavior

Both `weave add` and `weave workspace` become mode-aware. Mode detection is shared: walk up from the relevant folder path looking for `.weave/workspace.yml`. If found with `mode: workspace`, treat the context as workspace mode. Otherwise treat it as repo mode. The rule is committed-truth-driven, so it survives session resets and works for teammates with a fresh clone.

### `weave add` repo mode (unchanged)

- Accepts only a `<path>` argument.
- Writes an entry to `session.folders` in `~/.cache/weave/current-session.yml`.
- Does not write any committed files. No `workspace.yml`, no `.gitignore`.
- This mode remains available but is not the recommended workflow once a workspace exists.

### `weave add` workspace mode (new behavior)

- Accepts either a `<path>` or a `<git-url>`.
- The argument is treated as a git URL if it begins with a recognized git scheme (`git@`, `https://`, `http://`, `ssh://`, `git://`). Otherwise it is treated as a filesystem path.

For a **git URL**:

- Weave runs `git clone <url>` into the workspace root.
- The cloned directory name comes from the URL's repo basename (`git@github.com:foo/bar.git` -> `./bar`, `https://example.com/foo/bar` -> `./bar`).
- No flag is provided to override the destination name. Users who want a different name can clone manually and then `weave add ./renamed-dir`.
- If the destination directory already exists, the command refuses with a clear error.

For a **path inside the workspace**:

- Weave registers the folder in place.

For a **path outside the workspace**:

- Weave adopts the folder by moving it into the workspace root, mirroring how `weave init --mode workspace` adopts the current git repo today.

For all three workspace-mode cases, after the folder is in place inside the workspace, Weave:

- Appends `/<dirname>/` to the workspace `.gitignore`. The append is idempotent: if the exact entry already exists, it is not duplicated.
- Writes `.weave/workspace.yml` entry under `repos.<slug> = { path: "<dirname-or-relative-path>", kind, remote? }`.
- Captures `remote.origin.url` via `git config --get remote.origin.url` if the folder has a `.git/`. Omits the `remote` field if the folder has no `.git/` or no origin remote.
- Does NOT write to `session.folders`. The workspace pointer stays as the only session entry, matching `weave init --mode workspace`'s existing behavior.

### Non-git folders

A non-git folder added in workspace mode is treated identically to a git folder, except that the `remote` field is omitted from the `workspace.yml.repos` entry.

### Idempotency

If the path or URL resolves to a folder already registered in `workspace.yml.repos`, the command exits successfully with a clear "already registered" message and modifies nothing.

### `weave workspace` repo mode (unchanged)

- Reads `session.folders` from `~/.cache/weave/current-session.yml` and displays each folder's id, path, and `kind`.
- Identical to today's behavior for any session folder whose mode resolves to repo (no `.weave/workspace.yml`, or `mode: repo`).

### `weave workspace` workspace mode (new behavior)

For each entry in `session.folders` whose mode resolves to workspace (`.weave/workspace.yml` exists at that folder and has `mode: workspace`):

- Read the workspace's `.weave/workspace.yml`, parse the `repos` field.
- Include the parsed repos in the output. The text output indents a `Repos:` block under the workspace folder line, listing each `repos.<id>` with its id, relative `path`, `kind`, and `remote` if present. The JSON output gains an additive `repos` field on the workspace folder entry. The schema of each repos entry is `{ id, path, kind, remote? }`.
- Existing JSON fields on the workspace folder entry are unchanged. The new `repos` field is purely additive, so existing consumers that ignore unknown fields keep working.
- If `.weave/workspace.yml` is missing or unparseable for a folder that session marks `kind: workspace`, degrade gracefully: show only the folder line, no Repos block, no warning, no crash.

The mixed case (a session with both repo-mode folders and workspace-mode folders) is handled per folder using the shared mode-detection rule.

## User Workflows

### Workflow: User clones a new sub-repo into a workspace by URL

1. User is `cd`'d into their workspace, e.g. `peoplebox-platform/`.
2. User runs `weave add git@github.com:peoplebox/billing.git`.
3. Weave detects workspace mode by reading `.weave/workspace.yml`.
4. Weave detects the argument is a URL by its scheme prefix.
5. Weave runs `git clone git@github.com:peoplebox/billing.git` in the workspace root.
6. Weave appends `/billing/` to the workspace `.gitignore`.
7. Weave writes `repos.billing = { path: "billing", kind: "app", remote: "git@github.com:peoplebox/billing.git" }` to `.weave/workspace.yml`.
8. Weave prints success and the resulting registration.

### Workflow: User registers a folder already inside the workspace

1. User has already manually cloned or scaffolded a folder inside their workspace, e.g. `peoplebox-platform/services/audit/`.
2. User runs `weave add ./services/audit`.
3. Weave detects workspace mode.
4. Weave verifies the path is inside the workspace.
5. Weave appends `/services/` (the top-level segment of the path) to `.gitignore`. (See Open Questions for nested-path gitignore rules.)
6. Weave writes `repos.audit = { path: "services/audit", kind: "app", remote: "<discovered origin>" }`.
7. Weave prints success.

### Workflow: User adopts an external repo into the workspace

1. User has a sibling repo at `../external-tooling` and decides it belongs in the workspace.
2. From inside the workspace, user runs `weave add ../external-tooling`.
3. Weave detects workspace mode.
4. Weave detects the path is outside the workspace.
5. Weave moves `external-tooling/` (including `.git/`) into the workspace root.
6. Weave appends `/external-tooling/` to `.gitignore`.
7. Weave writes `repos.external-tooling = { path: "external-tooling", kind: "app", remote: "<discovered origin or omitted>" }`.
8. Weave prints success including the source and destination paths.

### Workflow: User adds a non-git scratch folder

1. User creates `peoplebox-platform/shared-notes/` (a plain directory, no `.git/`).
2. User runs `weave add ./shared-notes`.
3. Weave detects workspace mode.
4. Weave appends `/shared-notes/` to `.gitignore`.
5. Weave writes `repos["shared-notes"] = { path: "shared-notes", kind: "app" }` (no `remote` field).
6. Weave prints success.

### Workflow: User retries an `add` for a folder already registered

1. User runs `weave add ./billing` a second time, or runs `weave add` on a URL whose default basename matches an existing registry entry.
2. Weave detects the duplicate against `workspace.yml.repos`.
3. Weave does not clone, move, modify `.gitignore`, or modify `workspace.yml`.
4. Weave prints a clear "already registered" message and exits 0.

### Workflow: User runs `weave add ../neighbor` in repo mode

1. User is in a repo-mode project (no workspace).
2. User runs `weave add ../neighbor`.
3. Weave behaves exactly as today: scaffolds `wiki/` in `../neighbor`, adds it to `session.folders`, prints success.
4. No `workspace.yml` or `.gitignore` writes.

### Workflow: User runs `weave workspace` to verify the workspace state

1. User has run `weave add billing`, `weave add audit`, and `weave add shared-notes` from inside `peoplebox-platform/`.
2. User runs `weave workspace`.
3. Weave loads the local session and finds the `peoplebox-platform` folder (kind: workspace).
4. Weave reads `peoplebox-platform/.weave/workspace.yml` and parses `repos`.
5. Weave prints the workspace folder line, then indents a `Repos:` block listing `billing`, `audit`, and `shared-notes` with their paths, kinds, and remotes (when present).
6. JSON output includes a `repos` array on the workspace folder entry.

### Workflow: Teammate runs `weave workspace` on a fresh clone

1. Teammate clones `peoplebox-platform` and creates a Weave session in it (for example by running `weave init` against the cloned workspace).
2. Teammate runs `weave workspace`.
3. Weave reads `peoplebox-platform/.weave/workspace.yml.repos` from the committed file and shows the same repo list the original author saw.
4. The teammate does not have any of the sub-repos on disk yet, but they can see what the workspace expects and clone each one (or wire up their own workflow on top of the `remote` field).

## User Stories

1. As a developer with a Weave workspace, I want to clone a new sub-repo into my workspace with a single command, so that I don't have to leave Weave context, run `git clone`, and then re-register the result.
2. As a developer, I want any folder I add to my workspace to be automatically gitignored from the outer workspace git repo, so that my workspace stays clean by default.
3. As a developer, I want the git remote URL of every sub-repo recorded in `.weave/workspace.yml`, so that my teammates can reconstruct the workspace by cloning from the recorded URLs.
4. As a developer who has manually placed a folder inside my workspace, I want `weave add ./that-folder` to register it without moving anything, so that the command is non-destructive when the folder is already in place.
5. As a developer who has an external repo I want to bring in, I want `weave add ../external-thing` to move it into the workspace and register it, so that I don't have to do the move manually before adding.
6. As a developer using a non-git scratch folder, I want `weave add` to still register and gitignore it even without a `.git/`, so that I have one consistent command for everything inside the workspace.
7. As a developer who accidentally re-runs `weave add` on something I already added, I want the command to be a clear, safe no-op, so that I don't break my workspace metadata or accidentally re-clone.
8. As a developer still using repo-mode `weave add`, I want the existing behavior preserved exactly, so that my existing repo-mode workflows do not break.
9. As an automation or agent, I want `weave add` to be non-interactive and deterministic given the same inputs, so that I can script workspace setup confidently.
10. As a teammate cloning a workspace that someone else built, I want `.weave/workspace.yml` and `.gitignore` to be the single source of truth for what's inside the workspace, so that I can reproduce the same shape on my machine.
11. As a developer who just registered several repos into a workspace, I want to run a single command to see all of them with their remotes and kinds, so that I can verify my workspace state without opening `.weave/workspace.yml` manually.
12. As a teammate with a fresh clone of a workspace, I want `weave workspace` to show the repo list that the original author committed, so that I know what to clone (and what kind of folder each is) before doing any work.
13. As a developer working across multiple Weave projects (some repo mode, some workspace mode), I want `weave workspace` to display each folder in its own mode's idiom, so that mixed sessions remain readable.
14. As an agent or automation, I want the JSON output of `weave workspace` to surface the workspace repos in an additive `repos` field, so that existing JSON consumers do not break.

## Functional Requirements

- The system should detect whether the current context is a Weave repo-mode project or workspace-mode project before deciding which `weave add` behavior to run.
- The system should preserve today's repo-mode `weave add` behavior exactly: session-only entry, no committed file writes, path argument only.
- The system should accept either a filesystem path or a git URL as the positional argument to `weave add` when running in workspace mode.
- The system should treat the argument as a git URL when it starts with `git@`, `https://`, `http://`, `ssh://`, or `git://`. All other arguments should be treated as filesystem paths.
- The system should, in workspace mode given a git URL, run `git clone <url>` into the workspace root. The cloned directory name should come from the URL's repo basename.
- The system should refuse to clone when the destination directory already exists, with a clear error message.
- The system should, in workspace mode given a path inside the workspace, register the folder in place without moving it.
- The system should, in workspace mode given a path outside the workspace, move the folder (including `.git/`) into the workspace root before registering it.
- The system should, in workspace mode, append `/<dirname>/` to the workspace `.gitignore` for every added folder. The append should be idempotent: if the exact entry already exists, do not duplicate it.
- The system should, in workspace mode, write a `repos.<slug>` entry in `.weave/workspace.yml` for every added folder. The entry should contain `path`, `kind`, and optionally `remote`.
- The system should capture `remote.origin.url` and store it as the `remote` field when the added folder has a `.git/` with an `origin` remote configured.
- The system should omit the `remote` field when the added folder is not a git repo or has no `origin` remote configured.
- The system should not write to `session.folders` in workspace mode. The session entry for the workspace itself stays as it is.
- The system should detect an already-registered folder by checking `workspace.yml.repos` for an existing entry pointing at the same resolved path. When such an entry is found, exit successfully without modifying any files.
- The system should respect existing `--id` and `--kind` flags. In workspace mode, `--id` controls the `repos.<id>` key and `--kind` controls the `repos.<id>.kind` field. Default `kind` is `app`.
- The system should produce the same workspace state for `weave add` as `weave init --mode workspace` would for an equivalent input. The "register a repo into a workspace" internals should be shared between the two commands.
- The system should determine "is the active context workspace mode or repo mode" by walking up from the relevant folder path to find `.weave/workspace.yml`. If found with `mode: workspace`, treat the context as workspace mode. Otherwise treat it as repo mode. The mode-detection rule should be a single shared helper used by both `weave add` and `weave workspace`.
- The system should, in `weave workspace`, evaluate the mode per session folder, not globally. A session with both repo-mode folders and workspace-mode folders should render each folder in its own mode's output shape.
- The system should, in `weave workspace` workspace mode, read `<folder>/.weave/workspace.yml` and include the parsed `repos` field in both text and JSON output. The JSON `repos` field is additive on the workspace folder entry. The text output indents a `Repos:` block under the workspace folder line.
- The system should, in `weave workspace`, degrade gracefully when `.weave/workspace.yml` is missing or unparseable for a folder marked `kind: workspace`. Show the folder line only, no Repos block, no warning, no crash.
- The system should not write to `session.folders` from `weave workspace`. The command remains read-only.
- The system should preserve `weave workspace`'s existing JSON shape for repo-mode folders. No existing fields are renamed or removed.

## Edge Cases

- **Destination directory already exists when cloning by URL**: refuse with a clear error. Do not delete or overwrite the existing directory.
- **URL clone fails (network, auth, bad URL)**: surface the underlying `git clone` failure. Do not write to `.gitignore` or `workspace.yml`.
- **Outside-path adoption fails mid-move (e.g., permission error)**: surface the underlying move failure. Do not write to `.gitignore` or `workspace.yml` if the move did not complete.
- **The added folder is a git repo with no `origin` remote** (e.g., a local-only `git init`): register as usual, omit `remote`.
- **The added folder is a git repo with multiple remotes**: capture only `remote.origin.url`. Other remotes are ignored.
- **The added folder has a `.git/` that is itself a worktree or submodule**: out of scope for this change. Treat it as a regular git repo and capture whatever `remote.origin.url` returns.
- **Already-registered path is re-added with a different `--id`**: still treat as duplicate based on resolved path, exit successfully, do not modify the existing entry.
- **Already-registered path is re-added with a different `--kind`**: out of scope. The existing registry entry is not modified. Future "update" support is a separate change.
- **User runs `weave add` from a subdirectory of the workspace**: the command should walk up to find the workspace root via `.weave/workspace.yml`. The added folder is still placed in (or registered relative to) the workspace root.
- **The workspace `.gitignore` has been hand-edited and uses a non-leading-slash form**: the idempotency check is a literal match on `/<dirname>/`. Hand-edited variants like `<dirname>/` would not be detected as duplicates and would be appended again, creating a second matching entry. This is acceptable because both entries still gitignore the directory correctly.
- **Symlinked paths**: paths are resolved via `realpath` before comparison, matching today's `addFolderToSession` behavior.
- **`weave workspace` with malformed `workspace.yml`**: degrade gracefully. Show only the folder line, no Repos block. Do not print a warning, do not crash, do not exit non-zero.
- **`weave workspace` with missing `workspace.yml` for a `kind: workspace` session folder**: same as malformed. Show only the folder line.
- **`weave workspace` for a session folder whose `workspace.yml` exists but has `mode: repo`**: treat as repo mode for display purposes. No Repos block. (This is an unusual state - kind in session disagrees with mode in workspace.yml - and we prefer workspace.yml as committed truth.)
- **`weave workspace` for a workspace whose `repos` field is empty**: show the workspace folder line followed by an empty Repos section, or omit the Repos block entirely. Either is acceptable; recommended: omit the empty block for cleanliness, but include an empty `repos: []` array in JSON for shape stability.
- **`weave workspace` with mixed-mode session folders**: each folder renders in its own mode's shape. Workspace-mode folders show a Repos block; repo-mode folders do not.
- **`--target all` and short-ID resolution for sub-repos in workspace mode**: known v1 limitations. `--target all` enumerates only `session.folders`, which holds just the workspace in workspace mode. `--target <short-id>` resolves only against `session.folders`, so a workspace sub-repo's short id will not resolve unless lazy-grown into the session by a prior per-folder command. These are accepted because sub-repos in default workspace mode do not have their own `wiki/changes/`.

## Acceptance Criteria

- [ ] In repo mode, `weave add <path>` behaves identically to today (session-only write, no committed files touched).
- [ ] In workspace mode, `weave add <path>` for a path inside the workspace appends `/<dirname>/` to `.gitignore` and writes a `repos.<slug>` entry in `.weave/workspace.yml`.
- [ ] In workspace mode, `weave add <git-url>` runs `git clone` into the workspace root, then appends `/<dirname>/` to `.gitignore` and writes `repos.<slug>` with `remote: <url>`.
- [ ] In workspace mode, `weave add <path>` for an outside path moves the folder into the workspace root before registering it.
- [ ] In workspace mode, `weave add` of a non-git folder still registers and gitignores the folder, with no `remote` field on the `repos.<slug>` entry.
- [ ] In workspace mode, `weave add` of a path or URL whose resolved destination is already in `workspace.yml.repos` exits successfully with an "already registered" message and modifies no files.
- [ ] In workspace mode, `weave add` does not write to `session.folders`.
- [ ] `weave init --mode workspace` and `weave add` produce equivalent `workspace.yml.repos` and `.gitignore` state for equivalent inputs (shared internal helper).
- [ ] `weave add` works non-interactively without prompts in both modes.
- [ ] Existing tests for `weave init --mode workspace` and existing repo-mode `weave add` continue to pass without modification.
- [ ] `weave add` of a URL where the destination already exists refuses with a clear error and does not modify `.gitignore` or `workspace.yml`.
- [ ] The `--id` flag controls the `repos.<id>` registry key in workspace mode; `--kind` controls the `kind` field.
- [ ] `weave add` and `weave workspace` use the same mode-detection helper and agree on the active mode for any given folder.
- [ ] In repo mode, `weave workspace` output is byte-identical to today's output for the same session state.
- [ ] In workspace mode, `weave workspace` reads `.weave/workspace.yml.repos` and includes the entries in its text output (indented Repos block) and JSON output (additive `repos` array on the workspace folder entry).
- [ ] In workspace mode, `weave workspace` shows registered repos for a teammate working from a fresh clone, provided their session points at the workspace folder.
- [ ] `weave workspace` degrades gracefully (no warning, no crash) when `.weave/workspace.yml` is missing or unparseable for a `kind: workspace` session folder.
- [ ] After init adopts a repo, `weave workspace` shows that adopted repo in its Repos block. (Free byproduct - validates that init's existing behavior is conformant with the new `weave workspace`.)
- [ ] A session with mixed repo-mode and workspace-mode folders renders each folder in its own mode's shape; repo-mode folders have no Repos block, workspace-mode folders do.

## Rollout Considerations

- **Pre-1.0 release**: this is a behavior expansion of two existing commands. There are no breaking changes to repo-mode `weave add` or repo-mode `weave workspace`, and no schema changes to `workspace.yml` or `session.yml`.
- **Existing workspaces**: workspaces created before this change have `workspace.yml.repos` populated only with whatever init adopted. After this change, users can run `weave add` to retroactively register sub-repos they previously added by hand. The new `weave workspace` immediately surfaces the adopted repo for any existing workspace - no migration script needed.
- **Documentation**: in this change update both the `weave add` and `weave workspace` sections of the README, and the core command reference knowledge doc (`wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md`). The doc currently lists "does not inspect `.weave/workspace.yml`" and "does not list repos from workspace metadata" as `weave workspace` non-behaviors; those bullets need to be removed and replaced with the new workspace-mode behavior.
- **Agent skills**: no skill changes are required. Skills that invoke `weave add` or `weave workspace --json` will naturally pick up the new behavior. The JSON shape is additive.
- **Communication**: a brief CHANGELOG entry describing "weave add is now workspace-aware: accepts git URLs, adopts outside paths, updates `.gitignore` and `workspace.yml`. weave workspace now lists registered repos in workspace mode" is sufficient.

## Revision History

- 2026-06-04: Initial PRD generated from `exploration.md` and same-session capture.
- 2026-06-04: Revised to lock in: (1) shared mode-detection rule by walking up to `.weave/workspace.yml`; (2) `weave workspace` becomes mode-aware and reads `workspace.yml.repos` in workspace mode; (3) graceful degradation when `workspace.yml` is missing/malformed; (4) explicit acceptance of `--target all` and short-ID limitations as known v1 behavior. Confirmed that workspace-mode `weave add` writes only to `workspace.yml.repos` and not to `session.folders`.

## Assumptions

- Users who care about workspace mode are already on a Weave version that supports `weave init --mode workspace`. This PRD does not need to handle "workspace exists but `workspace.yml` is malformed" beyond surfacing a sensible parse error.
- The `git clone` performed by `weave add <url>` inherits the user's git configuration (SSH keys, credential helpers, etc.) just like a manual `git clone` would. No additional auth handling is required.
- The `repos.<slug>` key is generated by slugifying the destination directory name, matching how `scaffoldWorkspace` does it today. `--id` overrides the slug.
- `.gitignore` is appended as plain text. The file's encoding and line endings match the existing file's conventions (preserved as-is). New entries are written with a trailing newline.
- The relative `path` stored in `workspace.yml.repos.<slug>.path` is the path from the workspace root to the folder. For a folder placed directly under the workspace root, this is just the directory name (e.g., `billing`). For a nested registration like `services/audit`, this is the multi-segment relative path.

## Open Questions

- **Nested-path gitignore entry**: for `weave add ./services/audit`, should the `.gitignore` entry be `/services/audit/` (precise) or `/services/` (broader)? Recommended: `/services/audit/` (precise). Open for confirmation during implementation.
- **`repos.<slug>` key for nested paths**: for `weave add ./services/audit`, should the slug be `audit` (basename) or `services-audit` (path-derived)? Recommended: `audit` to match today's basename-based slugification. Open for confirmation.
- **Symbol for "this is a URL" detection**: current proposal is scheme-prefix matching (`git@`, `https://`, `http://`, `ssh://`, `git://`). Open question whether additional schemes (e.g., custom enterprise schemes) need explicit support; default is "no, only the listed five".

## Out of Scope

- A complementary `weave remove` / `weave unadd` command to un-register a folder. Users who need this for now can hand-edit `workspace.yml` and `.gitignore`.
- Updating an existing `repos.<slug>` entry's `remote` or `kind` after first registration. The first-write value is durable until manually changed.
- Cloning credentials, SSH key prompts, or auth configuration management.
- Refactoring the dual-registry model (`session.folders` vs `workspace.yml.repos`).
- Renaming `repos` to a more generic term to better describe non-git folder entries.
- An `--into <dirname>` flag to override the URL clone destination name.
- Cross-workspace operations (e.g., moving a registered repo from one workspace to another).
- Adopting a Weave-initialized repo (one with its own `wiki/`) as a sub-repo of a workspace. Today's init refuses non-interactive adoption of the Weave source repo; the analogous safety net for `add` is open and may be deferred to a later change.
- Closing the `--target all` and `--target <short-id>` gaps for sub-repos in workspace mode (see Edge Cases). Solving these would require either eager population of `session.folders` from `workspace.yml.repos` or teaching change/artifact commands to read both registries - both larger refactors. Deferred.
- A `--repos-only` or `--no-repos` flag on `weave workspace` to filter output. Out of scope for v1; the default mode-aware behavior is sufficient.
- Validating that registered `repos.<slug>.path` entries actually exist on disk during `weave workspace`. The command reports what `workspace.yml` says; on-disk drift detection is a separate concern.

## Further Notes

- The implementation should extract a single shared helper (suggested name: `registerRepoIntoWorkspace({ workspacePath, sourcePath | url, id?, kind? })`) consumed by both `initWorkspaceFromGitRepo` in `src/lib/init-workspace.ts` and the new workspace-mode branch of `addFolder` in `src/lib/add-folder.ts`. This guarantees that adoption-at-init and add-after-init produce identical state.
- Mode detection should be a single shared helper (suggested name: `findWorkspaceMode(folderPath) -> { mode: "workspace" | "repo", workspacePath?: string }`). It walks up from the given path looking for `.weave/workspace.yml` and parses the `mode` field. Both `weave add` and `weave workspace` should use this helper - they must agree on the mode for any given folder.
- `show-workspace.ts` should call `findWorkspaceMode(folder.path)` for each session folder. For workspace-mode folders, read `<folder>/.weave/workspace.yml` and surface `repos`. Wrap the parse in try/catch (or equivalent) so a malformed file degrades silently.
- Knowledge doc `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md` should grow a new `Command: weave add` section, update the `weave workspace` section to document the new mode-aware output, and remove the "does not inspect `.weave/workspace.yml`" / "does not list repos from workspace metadata" non-behavior bullets. The README's `weave add` and `weave workspace` sections should be updated in parallel.
- Tests should add coverage for: each scenario in the User Workflows section; the idempotency and refusal cases in Edge Cases; `weave workspace` in repo mode (must be byte-identical to today); `weave workspace` in workspace mode with populated repos; `weave workspace` with malformed workspace.yml (graceful degradation); `weave workspace` with mixed-mode sessions.
