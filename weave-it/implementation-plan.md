# Weave-It Implementation Plan

## Product Model

Weave has two separate concepts.

## 1. Current Session

A Weave session is the temporary set of folders the AI should focus on right now.

It answers:

```text
Which folders/repos should the AI consider together for this current task?
```

The session is local machine state. It is not committed to git and is not written into any repo's `weave/` folder.

V1 does not need named workspaces, saved workspaces, workspace files, or workspace reopening. Those can come later.

## 2. Repo `weave/` Folder

Each repo or folder can have its own `weave/` folder.

It answers:

```text
What durable LLM/wiki/product context exists for this repo?
```

The repo `weave/` folder is independent of session membership. It can be committed because it contains repo-local knowledge, not local workspace paths.

Target layout inside each repo/folder:

```text
weave/
  local.yml
  sync.yml
  knowledge/
    index.md
  features/
```

No session or workspace folder list should live inside `weave/`.

## V1 Commands

## `weave init`

Starts a new current session from the current folder and initializes the current folder's `weave/` wiki scaffold.

Behavior:

- Detect the current folder root, preferably the git root when inside a git repo.
- Create the repo-local `weave/` scaffold if missing.
- Start a new temporary current session containing only the current folder.
- If a current session already exists, ask before replacing it in interactive mode.
- With `--yes`, replace the current session without prompting.
- Do not write session membership into `weave/`.
- Do not overwrite existing `weave/` files.

Mental model:

```text
weave init = start focusing here
```

Example:

```bash
cd frontend
weave init
```

Creates or preserves:

```text
frontend/
  weave/
    local.yml
    sync.yml
    knowledge/
      index.md
    features/
```

Starts current session:

```text
frontend
```

## `weave add <path>`

Adds another folder to the current session.

Behavior:

- Require an existing current session.
- Resolve `<path>` to a folder root, preferably the git root when inside a git repo.
- Create the target folder's `weave/` scaffold if missing.
- Add the target folder to the current session if not already added.
- If already added, report that and exit successfully.
- Do not overwrite existing `weave/` files.

Mental model:

```text
weave add = include another folder in the current AI focus
```

Example:

```bash
weave add ../backend
```

Current session becomes:

```text
frontend
backend
```

## `weave workspace`

Shows the current session folders.

The command name remains `workspace` because that is the user-facing concept: the folders currently grouped for AI focus. Internally, V1 can keep this as simple temporary session state.

Example output:

```text
Current Weave session

Folders:
  frontend  /Users/arpit/acme/frontend  app
  backend   /Users/arpit/acme/backend   api

Next:
  weave add <path>
  weave init
```

## `weave workspace --json`

Returns machine-readable session information so AI agents can discover all folders in focus.

Example:

```json
{
  "session": {
    "status": "active"
  },
  "folders": [
    {
      "id": "frontend",
      "path": "/Users/arpit/acme/frontend",
      "kind": "app",
      "weave": "/Users/arpit/acme/frontend/weave"
    },
    {
      "id": "backend",
      "path": "/Users/arpit/acme/backend",
      "kind": "api",
      "weave": "/Users/arpit/acme/backend/weave"
    }
  ]
}
```

No `weave context` command is needed for now.

## Repo `weave/` Files

## `weave/local.yml`

Purpose: repo-local identity, or "who am I?"

Example:

```yaml
version: 1
folder:
  id: frontend
  name: Frontend
  kind: app
  git_remote: git@github.com:acme/frontend.git
created_at: "2026-05-18T10:00:00.000Z"
```

Rules:

- Contains stable identity for this folder.
- May include git metadata when available.
- Must not contain session membership.
- Must not contain local paths to other repos.

## `weave/sync.yml`

Purpose: local sync/hash metadata for repo knowledge files.

Example:

```yaml
version: 1
documents:
  knowledge.index:
    path: weave/knowledge/index.md
    hash: sha256:abc123
    status: synced
```

Rules:

- Tracks local knowledge document state.
- Does not define session membership.
- Can evolve later to support drift detection and sync workflows.

## `weave/knowledge/index.md`

Purpose: top-level knowledge map for this repo/folder.

Initial template:

```md
# Product Knowledge

This folder contains current product knowledge for this repo/folder.

## Domains

_Add product domains here as they become relevant._

Examples:
- Billing
- Permissions
- Onboarding
- Notifications
```

## `weave/features/`

Purpose: durable feature/change records.

Future example:

```text
weave/features/260517-org-billing/
  exploration.md
  prd.md
  decisions.md
  contracts.md
  status.yml
  handoff.md
  local-plan.md
```

## Temporary Session State

Because CLI commands run as separate processes, Weave still needs a tiny local file to remember the current session between commands.

Recommended location:

```text
~/.cache/weave/current-session.yml
```

This file is not a saved workspace. It is just temporary current-session memory.

Example:

```yaml
version: 1
updated_at: "2026-05-18T10:00:00.000Z"

folders:
  frontend:
    path: /Users/arpit/acme/frontend
    name: Frontend
    kind: app
    git_remote: git@github.com:acme/frontend.git
  backend:
    path: /Users/arpit/acme/backend
    name: Backend
    kind: api
    git_remote: git@github.com:acme/backend.git
```

Lifecycle:

- `weave init` creates or replaces `current-session.yml`.
- `weave add <path>` updates `current-session.yml`.
- `weave workspace` reads `current-session.yml`.
- `weave workspace --json` reads `current-session.yml`.

V1 does not need a clear command, but a future `weave workspace clear` can delete the session file.

## Session Rules

- `weave init` is the explicit reset point.
- If a current session exists, interactive `weave init` asks before replacing it.
- `weave init --yes` replaces the current session without prompting.
- `weave add <path>` requires an existing session.
- If no session exists, `weave add <path>` tells the user to run `weave init` first.
- `weave add <path>` should not add duplicate paths.
- Path identity is based on normalized absolute folder path, preferably git root.

## AI Agent Access Model

The AI agent should not guess related folders.

It should ask Weave for the current session:

```bash
weave workspace --json
```

Weave returns explicit folder paths and `weave/` paths. The AI can then search/read those folders if its host environment has filesystem access.

Weave provides the map. The AI host still controls filesystem permissions.

## Phase 1: Realign `weave init`

Goal: make `weave init` match the separated session/repo-wiki model.

Tasks:

- Stop creating `weave/workspace.yaml`.
- Rename generated files from `.yaml` to `.yml` for `local.yml` and `sync.yml`.
- Create only the repo-local scaffold:
  - `weave/local.yml`
  - `weave/sync.yml`
  - `weave/knowledge/index.md`
  - `weave/features/`
- Start a new current session containing the current folder.
- If a session already exists, prompt before replacing it unless `--yes` is used.
- Keep idempotency: do not overwrite existing `weave/` files.
- Update `weave init` output wording.
- Update tests for the new file layout.

Exit criteria:

- `weave init --yes` creates repo wiki scaffold and current session state.
- Running `weave init --yes` again exits successfully and refreshes the session without overwriting existing repo files.
- No session or workspace membership is written inside repo `weave/`.

## Phase 2: Add Minimal Session State Helpers

Goal: centralize temporary current-session read/write behavior.

Tasks:

- Add a session state path helper for `~/.cache/weave/current-session.yml`.
- Add session read/write helpers.
- Add current-session creation from a single folder.
- Add folder normalization and deduplication by resolved path.
- Store folder metadata:
  - `id`
  - `path`
  - `name`
  - `kind`
  - `git_remote` when available
- Keep state updates atomic where practical.

Exit criteria:

- Session state can be loaded and saved independently of CLI commands.
- Duplicate folder paths are not added twice.
- Tests cover session creation, loading, saving, and deduplication.

## Phase 3: Implement `weave add <path>`

Goal: let users add more folders to the current session.

Tasks:

- Add `weave add <path>` command.
- Require an existing current session.
- Resolve target path and git root.
- Create target folder's `weave/` scaffold if missing.
- Add folder to current session if not already present.
- Print concise status output.
- Support `--kind <kind>` and possibly `--id <id>`.

Exit criteria:

- `weave add ../backend` adds backend to current session.
- Running the same command again is idempotent.
- Backend receives `weave/local.yml`, `weave/sync.yml`, `weave/knowledge/index.md`, and `weave/features/` if missing.
- If no session exists, command tells the user to run `weave init` first.

## Phase 4: Implement `weave workspace`

Goal: show current session and expose it to agents.

Tasks:

- Add `weave workspace` command.
- Add `--json` output.
- Show current session folders.
- Include each folder's path, kind, and `weave/` path in JSON output.
- If no session exists, tell the user to run `weave init`.

Exit criteria:

- Humans can inspect the current session.
- AI agents can call `weave workspace --json` to discover all folders in scope.

## Phase 5: Future Saved Workspace Support

Goal: add VS Code-like saved workspace files later, only if needed.

Potential tasks:

- Add `weave workspace save <path>`.
- Write `.weave-workspace` files.
- Prefer relative paths when possible.
- Add `weave open <path>` to make a saved workspace current.
- Preserve temporary current-session behavior.

This is intentionally out of V1 scope.

## Phase 6: Future Knowledge And Sync Enhancements

Goal: make repo `weave/` knowledge more useful over time.

Potential tasks:

- Add commands to inspect repo knowledge.
- Update `sync.yml` hashes when knowledge files change.
- Add drift detection for knowledge files.
- Add feature creation commands under `weave/features/`.
- Add import/export flows for team-shared workspace files.

These are not required for the initial session UX.

## Current Implementation Gap

The current implementation still creates workspace metadata inside `weave/`.

This plan supersedes that behavior. The next implementation pass should refactor the code to match this document.
