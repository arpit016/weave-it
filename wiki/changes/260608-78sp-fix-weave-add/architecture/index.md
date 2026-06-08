---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-06-08T14:05:00.000Z
updated_at: 2026-06-08T14:05:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
facet: index
---

# Fix Weave Add Architecture

## Decision Summary

- Treat a workspace repo as a duplicate only when it is both registered in `.weave/workspace.yml` and present on disk.
- Treat a registered-but-missing repo as a local materialization target, not as an error or no-op.
- Apply the materialization behavior to both `weave add <git-url>` and `weave add <local-path>`.
- Keep path-based matching for this fix. Git URLs match the URL-derived repo basename; local paths match the destination path/basename.
- Do not rewrite `.weave/workspace.yml` or `.gitignore` when materializing a repo that is already registered.
- Preserve existing register-and-gitignore behavior for new, unregistered repos.

## System Context

The relevant command path is:

- `src/commands/add.ts` defines `weave add` and delegates to `addFolder`.
- `src/lib/add-folder.ts` dispatches between repo-session mode and workspace mode.
- `src/lib/workspace-repos.ts` parses and writes `.weave/workspace.yml`, detects registered repo paths, appends gitignore entries, and registers new repos.
- `src/lib/show-workspace.ts` already distinguishes registered repo availability as `present` or `missing` by checking whether `path.join(workspacePath, repo.path)` exists.
- `tests/init.test.ts` contains the existing workspace add coverage for in-workspace folders, non-git folders, outside-folder adoption, Git URL clone, duplicate adds, and destination collisions.

The bug appears in workspace mode after a teammate clones a committed workspace. The committed workspace registry lists repos, and `.gitignore` excludes their directories, so those repo directories are expected to be missing locally until the teammate clones or adopts them.

## Architecture Overview

`weave add` should classify a workspace repo path into one of three states before deciding what to do:

1. **Unregistered**: the path is absent from `.weave/workspace.yml`. Keep current behavior: clone or move the repo/folder into the workspace, append the gitignore entry, and register the repo metadata.
2. **Registered and present**: the path is listed in `.weave/workspace.yml` and exists under the workspace. Return the existing already-registered result.
3. **Registered and missing**: the path is listed in `.weave/workspace.yml` but does not exist under the workspace. Clone or move the repo/folder into that path and return a success result without changing `.weave/workspace.yml` or `.gitignore`.

For `weave add <git-url>`, the target path is the existing URL-derived destination name, such as `billing` from `billing.git`. If that path is registered but missing, clone into the registered destination.

For `weave add <local-path>`, the target path is the current destination behavior. An in-workspace path that exists and is already registered remains an already-registered no-op. An outside path whose destination basename is registered but missing should be moved into the workspace and reported as materialized.

## Facets

- `index.md`: captures the command behavior and implementation boundary for this fix.

## Tradeoffs

- Path-based matching is simple and consistent with current `weave add` behavior, but it does not handle renamed local directories or remotes whose registered path differs from the URL basename.
- Remote-based matching could make renamed repos more ergonomic, but it would introduce broader matching semantics and possible ambiguity between multiple entries sharing or changing remotes.
- Returning `already_exists` only for present directories makes the teammate-clone workflow natural, but implementation must avoid rewriting metadata during registered-missing materialization.

## Risks And Open Questions

- User-facing wording should make it clear that a registered repo was materialized locally, not newly registered.
- The local-path flow must preserve the current safety check that refuses to overwrite an existing destination.
- Remote-based matching for renamed repos remains a possible future enhancement, not part of this fix.
