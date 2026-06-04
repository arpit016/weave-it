---
artifact: knowledge-delta
status: draft
owner: engineering
created_at: 2026-06-04T17:00:00.000Z
updated_at: 2026-06-04T17:00:00.000Z
source: tasks.md
---

# Knowledge Delta

## Durable Behavior Changes

- `weave add` is mode-aware. In workspace mode it accepts both filesystem paths and git URLs (`git@`, `https://`, `http://`, `ssh://`, `git://`, `file://`) and registers the target in `workspace.yml.repos` plus appends a precise entry (`/<relative-path>/`) to the workspace `.gitignore`. In repo mode it behaves as before (writes to `session.folders` only).
- `weave add` workspace mode behavior splits by argument shape:
  - Git URL → `git clone -- <url> <basename>` into the workspace root; `repos.<id>.remote` is set to the URL.
  - Path inside the workspace → registered in place.
  - Path outside the workspace → moved (including `.git/`) into the workspace root, then registered.
- Duplicate adds are detected by resolved relative path against `workspace.yml.repos` and are a no-op success, even when `--id` differs.
- `weave add` in workspace mode does **not** write to `session.folders`. The workspace `workspace.yml.repos` is the committed source of truth.
- `weave init --mode workspace` and `weave add` produce equivalent `workspace.yml.repos` and `.gitignore` state through a shared `registerRepoIntoWorkspace` helper.
- `weave workspace` dispatches on the current working directory using the shared `findWorkspaceMode` helper:
  - Workspace mode (cwd is inside a `mode: workspace` workspace) emits a workspace view: workspace name, root path, and the `repos` list from `workspace.yml`. No active Weave session is required. JSON top-level: `{ session, workspace, repos, folders: [] }`.
  - Repo mode (cwd not inside a workspace) emits today's session view from `session.folders`. JSON top-level: `{ session, workspace: null, repos: [], folders: [...] }`. Requires an active session; otherwise returns `status: no_session` exit 1.
  - Top-level JSON keys (`session`, `workspace`, `repos`, `folders`) are present in both modes for consumer stability.
- `weave workspace` is read-only and never inspects `session.folders` to crawl workspace metadata in repo mode.
- Malformed or missing `workspace.yml` causes `findWorkspaceMode` to return no result; `weave workspace` and `weave add` both fall through to repo mode silently — no warning, no crash.
- `git clone` invocations from `weave add` use the explicit `--` separator (`git clone -- <url> <dest>`) to defend against URLs that begin with `-` being parsed as git flags.

## Affected Knowledge Areas

- Domain `cli-commands`, feature `core-command-reference`: command surface, options, dispatch model, JSON shapes, and example outputs.

## Knowledge Files Updated

- `wiki/knowledge/domains/cli-commands/index.md` — feature description updated to mention `weave add`.
- `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md` — added Command Surface table, per-command Options tables for `weave init`, `weave add`, `weave workspace`, dispatch decision table for `weave workspace`, sample text and JSON output for both modes, expanded behavioral rules, and refreshed source anchors. Recorded `file://` URL scheme support and the `git clone --` injection guard.

## No-Impact Rationale

Not applicable — this change introduces durable behavior in two user-facing commands.

## Source Evidence

- Implementation:
  - `src/lib/workspace-mode.ts`: `findWorkspaceMode` walks up to `.weave/workspace.yml`.
  - `src/lib/workspace-repos.ts`: `isGitUrl` (six schemes including `file://`), `registerRepoIntoWorkspace`, idempotent `appendGitignoreEntry`, `readWorkspaceMetadata`, `listReposForDisplay`.
  - `src/lib/add-folder.ts`: mode dispatch via `findWorkspaceMode(cwd)`; workspace branch handles URL, in-workspace path, and outside-path adoption; repo branch unchanged.
  - `src/lib/init-workspace.ts`: `scaffoldWorkspace` now calls `registerRepoIntoWorkspace` for adopted and pre-seeded repos.
  - `src/lib/show-workspace.ts`: cwd-driven dispatch; workspace-mode view; repo-mode session view; stable top-level JSON keys.
  - `src/lib/git.ts`: `cloneRepo` uses `["clone", "--", url, dest]`.
  - `src/commands/workspace.ts`: passes `process.cwd()` into `showWorkspace`.
  - `src/commands/add.ts`: description and argument hint updated for workspace-mode URL/path support.
- Tests in `tests/init.test.ts`: in-workspace path register, non-git folder register, outside-path adoption, URL clone (via local bare repo and `file://`), duplicate add no-op, destination-exists refusal for URL, workspace view from root, workspace view from subdirectory, workspace view without session, repo-mode session view, repo-mode `no_session`, malformed workspace.yml falls through.
- Documentation: `README.md` (`## weave add`, `## weave workspace`), this knowledge file.
- Change artifacts: `wiki/changes/260604-2u05-add-a-repo-folder/prd.md` (acceptance criteria marked complete; revision history updated for the cwd-dispatch refinement), `wiki/changes/260604-2u05-add-a-repo-folder/architecture.md` (decisions table includes cwd-dispatch and `--` separator; resolved technical questions updated).

## Follow-Up Knowledge Work

- None for this change. Future work:
  - If a `weave remove` / `weave unadd` lands, behavior.md will need a new command section.
  - If `--target all` and short-id resolution start enumerating workspace sub-repos, the repo-mode/workspace-mode dispatch description will need an update.
  - If the gitignore granularity for nested paths changes (currently precise `/<relative-path>/`), update the workspace-mode add bullet.
