# Weave-It V1: `weave init`

## Package And CLI

- Package name: `weave-it`
- CLI binary: `weave`

## Core Principle

Weave separates repo knowledge from temporary AI focus.

Repo `weave/` folders contain durable LLM/wiki knowledge for one repo or folder.

The current Weave session is local temporary state that lists the folders the AI should consider together right now.

## Purpose

`weave init` starts using Weave from the current folder.

It bootstraps:

- Repo-local `weave/` wiki structure
- Folder identity in `weave/local.yml`
- Initial knowledge sync metadata in `weave/sync.yml`
- A temporary current session containing the current folder

It does not write session membership into the repo.

## Command

```bash
weave init
```

Optional flags:

```bash
weave init --id frontend
weave init --kind app
weave init --yes
```

## Created Repo Layout

Inside the current folder or git root:

```text
weave/
  local.yml
  sync.yml
  knowledge/
    index.md
  features/
```

There is no `weave/workspace.yaml` in V1.

## Temporary Session State

CLI commands run as separate processes, so Weave stores the current session in a small local file:

```text
~/.cache/weave/current-session.yml
```

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
```

This file is not a saved workspace and should not be committed.

## File Roles

### `weave/local.yml`

Repo-local identity file: "who am I?"

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
- Must not contain paths to other repos.

### `weave/sync.yml`

Local sync/hash metadata for repo knowledge files.

Initial example:

```yaml
version: 1
documents:
  knowledge.index:
    path: weave/knowledge/index.md
    hash: sha256:def456
    status: synced
```

### `weave/knowledge/`

Current product knowledge for this repo/folder.

Initial `weave/knowledge/index.md` template:

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

### `weave/features/`

Durable feature/change records.

Future feature folders live here:

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

## Detection Behavior

When `weave init` runs:

| Situation | Behavior |
|---|---|
| Current directory is inside a git repo | Use the git root as the folder root and record git metadata |
| Current directory is not inside a git repo | Use the current directory as the folder root |
| `weave/` does not exist | Create the repo-local scaffold |
| `weave/` already exists | Create missing scaffold files only; never overwrite existing files |
| Current session does not exist | Create a new session with the current folder |
| Current session exists | Ask before replacing it, unless `--yes` is used |

## Output

```text
Initialized Weave for folder: frontend

Folder:
  /Users/arpit/acme/frontend

Created:
  weave/local.yml
  weave/sync.yml
  weave/knowledge/index.md
  weave/features/

Started current session:
  frontend

Session state:
  /Users/arpit/.cache/weave/current-session.yml

Next:
  weave add <path>
  weave workspace
```

## Related V1 Commands

```bash
weave add <path>
weave workspace
weave workspace --json
```

`weave add <path>` adds a folder to the current session and ensures that folder has a repo-local `weave/` scaffold.

`weave workspace --json` exposes current session folders to AI agents.

## Non-Goals

`weave init` does not:

- Create a saved workspace file
- Store session membership inside repo `weave/`
- Create a feature
- Create a PRD
- Scan all folders deeply
- Create branches
- Create worktrees
- Modify application code

## Final Definition

`weave init` initializes the current folder's repo-local `weave/` wiki scaffold and starts a temporary current session with that folder as the first AI focus folder.
