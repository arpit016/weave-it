# Weave Init Implementation Plan

## Current Model

Weave separates three kinds of state:

- `wiki/`: committed, human-readable repo knowledge and change context.
- `.weave/`: committed Weave metadata for the repo.
- `~/.cache/weave/current-session.yml`: uncommitted machine-local current session state.

The CLI remains named `weave`. The repo content folder is intentionally generic.

## Repo Files

New scaffolds create:

```text
wiki/
  knowledge/
    index.md
  changes/

.weave/
  sync.yml
```

`local.yml` is intentionally not generated in V1. Repo identity lives in the temporary session state until a concrete workflow needs committed identity metadata.

## `weave init`

Starts a new current session from the current folder and initializes the current folder's repo wiki scaffold.

Behavior:

- Resolve current folder identity from CLI options, git root, and folder name.
- Create missing `wiki/` and `.weave/` scaffold files.
- Do not overwrite existing wiki or metadata files.
- Write current session state to `~/.cache/weave/current-session.yml`.
- Do not write session membership into repo files.

## `weave add <path>`

Adds another folder to the current session and initializes that folder's repo wiki scaffold if needed.

Behavior:

- Require an existing current session.
- Resolve the target folder path and identity.
- Create missing `wiki/` and `.weave/` scaffold files in the target folder.
- Add the folder to session state unless it is already present.
- Do not overwrite existing wiki or metadata files.

## `weave workspace`

Shows the current session folders.

JSON output includes explicit content and metadata paths:

```json
{
  "session": {
    "status": "active",
    "updated_at": "2026-05-19T00:00:00.000Z"
  },
  "folders": [
    {
      "id": "frontend",
      "path": "/repo/frontend",
      "kind": "app",
      "wiki": "/repo/frontend/wiki",
      "metadata": "/repo/frontend/.weave"
    }
  ]
}
```

Agents should use `wiki/knowledge/**` for durable product context and `wiki/changes/**` for change artifacts.

## Agent Integration Metadata

Agent install/update/reset state is tracked in:

```text
.weave/agents.yml
```

This manifest records installed skill and command wrapper paths plus hashes so Weave can update untouched files and skip user-modified files.

## Non-Goals

- No automatic migration from older `weave/` folders.
- No committed `local.yml` in V1.
- No session membership inside committed repo files.
