# Weave Init V1

## Product Decision

Weave keeps the CLI brand but uses a generic committed repo content folder:

```text
wiki/
```

Weave-owned committed metadata lives separately:

```text
.weave/
```

Machine-local current session state stays outside the repo:

```text
~/.cache/weave/current-session.yml
```

## Scaffold

`weave init` and `weave add <path>` create missing files only:

```text
wiki/
  knowledge/
    index.md
  features/

.weave/
  sync.yml
```

They do not create `local.yml`.

Initial `wiki/knowledge/index.md`:

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

Initial `.weave/sync.yml`:

```yaml
version: 1
documents:
  knowledge.index:
    path: wiki/knowledge/index.md
    hash: sha256:<hash>
    status: synced
```

## Current Session

The current session is local machine state. It records the folders an agent should consider for the current task.

Example:

```yaml
version: 1
updated_at: "2026-05-19T00:00:00.000Z"
folders:
  frontend:
    path: /repo/frontend
    name: Frontend
    kind: app
```

## Workspace JSON

`weave workspace --json` returns:

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

## Idempotency

| Condition | Behavior |
|---|---|
| `wiki/` does not exist | Create the repo wiki scaffold |
| `wiki/` already exists | Create missing scaffold files only |
| `.weave/sync.yml` exists | Do not overwrite it |
| No current session exists for `weave add` | Return a clear error |
| Folder already exists in session | Do not duplicate it |

## Explicit Non-Goals

- Do not store session membership inside repo files.
- Do not create `local.yml`.
- Do not automatically migrate older `weave/` folders.
