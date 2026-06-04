# Core Command Reference

## Purpose

This document explains the core Weave CLI commands in plain English, with examples for common user setups.

Use this as current-state product knowledge when deciding how `weave init` and `weave workspace` should behave.

## Current Behavior

`weave init` initializes Weave for the current working context and starts a local Weave session.

There are two init modes:

- `repo` mode: use this when the user wants Weave to work with only the current repo or folder.
- `workspace` mode: use this when the user wants a workspace that can contain multiple repos or folders for one product or platform boundary.

When no mode is passed in an interactive terminal, Weave asks the user to choose between repo mode and workspace mode.

When `--yes` is passed and no mode is provided, Weave defaults to repo mode.

## Command: `weave init`

### Repo Mode

Repo mode initializes Weave directly in the current folder.

Use repo mode when:

- the project is a single repo;
- the user wants `wiki/` and `.weave/` to live inside that repo;
- automation needs the old deterministic behavior.

Example:

```bash
weave init --mode repo --yes
```

What happens:

- Weave creates `wiki/knowledge/`, `wiki/changes/`, and `.weave/sync.yml` if missing.
- Weave writes `.weave/workspace.yml` with `mode: repo` if missing.
- Weave starts the current local session with the folder kind set to `app` by default.
- Weave does not run `git init`.
- Weave does not move files.

### Workspace Mode In The Current Empty Directory

Workspace mode can turn the current empty directory into the workspace itself.

Use this when the user has already created the platform/workspace folder and wants Weave to use that folder as the workspace root.

Example:

```bash
mkdir peoplebox-platform
cd peoplebox-platform
weave init --mode workspace --workspace-path . --yes
```

What happens:

- The current directory becomes the workspace.
- Weave initializes git in the current directory.
- Weave creates `.gitignore`, `wiki/`, `.weave/sync.yml`, and `.weave/workspace.yml`.
- `.weave/workspace.yml` has `mode: workspace`.
- The workspace has no registered repos yet.
- Weave starts the current local session with `kind: workspace`.

### Workspace Mode Outside A Git Repo

When workspace mode runs outside a git repo and no `--workspace-path` is provided, Weave asks for a workspace path.

Use this when the user is in a scratch folder or parent directory and wants to create a workspace somewhere specific.

Example:

```bash
weave init --mode workspace --workspace-name peoplebox-platform --workspace-path ../peoplebox-platform --yes
```

What happens:

- Weave creates the target workspace directory if it does not already exist.
- Weave refuses unsafe existing target paths instead of overwriting user data.
- Weave initializes git in the workspace directory.
- Weave creates `.gitignore`, `wiki/`, `.weave/sync.yml`, and `.weave/workspace.yml`.
- Weave starts the current local session with `kind: workspace`.

### Workspace Mode From Inside A Git Repo

When workspace mode runs inside an existing git repo, Weave adopts that repo into the new workspace.

Use this when the user starts in an app repo but wants to create a higher-level workspace around it.

Example:

```bash
cd peoplebox-api
weave init --mode workspace --workspace-name peoplebox-platform --yes
```

What happens:

- Weave detects the git root even if the command runs from a nested subdirectory.
- Weave creates the workspace beside the repo.
- Weave moves the whole repo, including `.git/`, into the workspace.
- Weave preserves dirty, staged, deleted, and untracked files because it does not run a clean-worktree guard.
- Weave adds the adopted repo directory to the workspace `.gitignore`.
- Weave registers the adopted repo in `.weave/workspace.yml`.
- Weave starts the current local session with `kind: workspace`.

After this command, the user should open the workspace path in their editor.

## Command: `weave workspace`

`weave workspace` shows the current local Weave session.

Example:

```bash
weave workspace
```

Machine-readable example:

```bash
weave workspace --json
```

What it does today:

- reads the local session file from `~/.cache/weave/current-session.yml`;
- lists the session folders;
- shows each folder id, path, and kind;
- returns JSON when `--json` is passed.

What it does not do today:

- it does not inspect `.weave/workspace.yml`;
- it does not list repos from workspace metadata;
- it does not change directories;
- it does not open the workspace in an editor.

In V1 workspace mode, the expected success signal is that `weave workspace` shows the workspace folder with `kind: workspace`.

## Use Cases

### Use Case: Single Repo Project

A user has one repo and wants Weave context in that repo.

They run:

```bash
weave init --mode repo --yes
```

The repo gets its own `wiki/` and `.weave/`. Future change artifacts and knowledge live in that repo.

### Use Case: User Already Made A Workspace Folder

A user creates a folder named after the product/platform boundary.

They run:

```bash
mkdir peoplebox-platform
cd peoplebox-platform
weave init --mode workspace --workspace-path . --yes
```

The folder itself becomes the workspace. This is the lowest-effort path when the user already knows the workspace name.

### Use Case: User Starts From An Existing App Repo

A user is inside `peoplebox-api` and realizes the feature spans backend, frontend, and maybe infra.

They run:

```bash
weave init --mode workspace --workspace-name peoplebox-platform --yes
```

Weave creates `peoplebox-platform/`, moves `peoplebox-api/` into it, git-ignores the app repo from the workspace git repo, and registers the app repo in workspace metadata.

### Use Case: Automation Wants Stable Repo Mode

Automation should avoid prompts.

It runs:

```bash
weave init --mode repo --yes
```

If automation omits `--mode`, `--yes` still defaults to repo mode for backward compatibility.

### Use Case: Agent Needs To Know The Current Context

An agent wants to know which folder Weave currently considers active.

It runs:

```bash
weave workspace --json
```

The JSON response is the current local session, not the full workspace metadata model.

## Source Anchors

- `src/commands/init.ts`: parses `weave init` options.
- `src/lib/init-workspace.ts`: implements repo mode, workspace mode, current-repo adoption, workspace metadata, git initialization, and session updates.
- `src/commands/workspace.ts`: defines `weave workspace`.
- `src/lib/show-workspace.ts`: reads and prints the current local session.
- `tests/init.test.ts`: covers repo mode, workspace mode, current-directory workspace behavior, current-repo adoption, safety checks, and workspace session output.

## Change History

- 2026-06-04: Added current command reference for init modes, workspace setup paths, examples, and `weave workspace` session behavior.
