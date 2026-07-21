---
artifact: prd
status: draft
owner: product
created_at: 2026-07-21T11:17:00.000Z
updated_at: 2026-07-21T11:56:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Fix Init: Cloned Weave Workspaces Should Just Work PRD

## Problem Statement

Someone clones an already-initialized Weave workspace (the repo contains a committed `.weave/workspace.yml` and the rest of the `.weave/` and `wiki/` scaffold). They immediately run a Weave command and are told to "Run `weave init` first". This is confusing: the workspace is clearly already initialized, the committed metadata is right there, and nothing is actually missing from the repo.

When the user complies and runs `weave init`, it makes things worse: init re-runs its generation flow, and in workspace mode it can be destructive - it moves the cloned repo into a newly created workspace directory. So a command meant to "fix" a false alarm instead mutates the user's checkout.

Root cause: Weave splits state into two places. Committed metadata (`.weave/workspace.yml`, mode, workspace name, registered repos) travels with `git clone`. But the "current session" that several commands gate on lives at `~/.cache/weave/current-session.yml`, which is machine-local and never committed. After a clone the session is absent, so commands that treat the session as a prerequisite emit "Run `weave init` first" even though the real, committed source of truth is present.

This matters because joining a shared workspace from a fresh clone is the single most common multi-user entry point. It should be frictionless and safe, not a trap that pushes users toward a destructive command.

## Goals

- A user who clones an initialized Weave workspace can run everyday Weave commands immediately, with no `weave init` step required.
- Weave never tells a user to run `weave init` when a valid `.weave/workspace.yml` is already present in the directory tree.
- `weave init` is safe and idempotent: running it inside an already-initialized workspace never re-scaffolds destructively and never moves the repo.
- The "Run `weave init` first" guidance is reserved for the genuinely uninitialized case (no `.weave/workspace.yml` anywhere up the tree).

## Non-Goals

- Removing the machine-local session concept entirely. The session is retained as an optional, lazily-created cache.
- Committing repo-mode folder membership into the repo. Repo-mode multi-folder scope stays machine-local by design.
- Changing how the active change is determined (it remains derived from the git branch).
- Adding automatic cloning or pulling of registered-but-missing sub-repos.

## Actors

- Teammate joining a shared workspace from a fresh `git clone`.
- Solo user re-cloning their own workspace onto a new machine.
- Automation/agents running Weave commands non-interactively against a checked-out workspace.
- Workspace or repo maintainer who originally ran `weave init`.

## Current Behavior

State is split across committed and machine-local locations:

- Committed and cloned with the repo: `.weave/workspace.yml` (mode, workspace name, registered repos), plus the rest of the `.weave/` and `wiki/` scaffold.
- Machine-local, never committed: `~/.cache/weave/current-session.yml`.

The session is largely vestigial for the change workflow. The active change is derived from the git branch (`change/<id>`), the workspace name and repos come from `workspace.yml`, and the session's `current_change` / `current_artifact` fields are defined but never read. The session's only genuinely load-bearing role is holding repo-mode folder membership.

After a clone (no session present), commands behave inconsistently:

- `weave workspace` in workspace mode already works without a session (reads `workspace.yml` directly). This is the intended model and is documented.
- `weave add` fails on a fresh clone even in workspace mode, because it checks for a session before detecting the mode - despite the workspace-mode path not needing the session at all.
- `weave workspace` in repo mode returns `no_session` and tells the user to run `weave init`.
- `weave change *` and `weave doctor` work from `workspace.yml` and only error when it is genuinely missing.

Current workaround: run `weave init`. This produces a false-positive "already initialized" re-run, and in workspace mode can move the cloned repo into a new workspace directory - a destructive surprise.

## Proposed Product Behavior

Treat the committed `.weave/workspace.yml` (plus cwd and the git branch) as the source of truth for whether Weave is initialized and what the current context is. The machine-local session becomes an optional cache that is lazily created when useful and never blocks a command.

Decision rule for everyday commands (`weave add`, `weave workspace`, `weave change *`):

- A valid `.weave/workspace.yml` is found up the tree -> the workspace is initialized; the command proceeds using committed metadata (and cwd/branch), regardless of whether a session exists.
- No `.weave/workspace.yml` is found anywhere up the tree -> the workspace is genuinely uninitialized; the command reports this and tells the user to run `weave init`.

`weave init` becomes safe and idempotent:

- Run inside a directory whose tree already contains a valid `.weave/workspace.yml` -> Weave reports that Weave is already initialized (including the detected mode) and does nothing else. It does not re-scaffold, does not overwrite files, and does not move the repo.
- Run where no `.weave/workspace.yml` exists -> Weave performs a normal first-time init, exactly as today.

## User Workflows

### Workflow: Teammate joins a shared workspace from a fresh clone

1. Teammate runs `git clone <workspace-repo>` and `cd` into it.
2. Teammate runs `weave workspace` and sees the workspace name and registered repos.
3. Teammate runs `weave add <path|url>` to register or materialize a repo; it succeeds without any `weave init`.
4. Teammate runs `weave change current` / `weave change status`; context resolves from `workspace.yml` and the current branch.
5. At no point is the teammate told to run `weave init`.

### Workflow: User runs weave init inside an already-initialized workspace

1. User (out of habit or following stale docs) runs `weave init` inside a cloned, already-initialized workspace.
2. Weave detects the existing `.weave/workspace.yml`, reports that Weave is already initialized and in which mode, and suggests starting a new change with `weave change new "<title>"`.
3. Weave exits successfully. No files are scaffolded or overwritten, the repo is not moved, and no session is written.

### Workflow: User initializes a brand-new, uninitialized folder

1. User runs `weave init` in a folder with no `.weave/workspace.yml` in its tree.
2. Weave runs the normal first-time init flow (repo or workspace mode) unchanged.

### Workflow: User runs a command in a genuinely uninitialized folder

1. User runs `weave add` / `weave workspace` where no `.weave/workspace.yml` exists up the tree.
2. Weave reports that no Weave context was found and tells the user to run `weave init` first.

## User Stories

1. As a teammate cloning a shared workspace, I want Weave commands to work immediately, so that I can start contributing without setup ceremony.
2. As a teammate on a fresh clone, I want `weave add` to register a repo without first running `weave init`, so that joining a workspace is one step.
3. As a user, I want `weave init` on an already-initialized workspace to be a safe no-op, so that I never accidentally re-scaffold or relocate my repo.
4. As a user in a genuinely uninitialized folder, I want a clear "run `weave init` first" message, so that I know the correct next step.
5. As a solo user re-cloning onto a new machine, I want my workspace to work without recreating machine-local state by hand, so that switching machines is painless.
6. As an automation/agent, I want commands to succeed against any checked-out workspace without a pre-existing session, so that CI and headless runs are reliable.
7. As a maintainer, I want repo-mode commands to degrade gracefully when no session exists, so that cloned repo-mode projects are usable without re-init.

## Functional Requirements

- The system should treat a valid `.weave/workspace.yml` found up the tree as proof that Weave is initialized.
- The system should not require a machine-local session for `weave add` or `weave workspace` when a valid `.weave/workspace.yml` is present.
- In workspace mode, `weave add` should register or materialize repos using `workspace.yml` without requiring a session.
- In repo mode with no session present but a valid `workspace.yml`, `weave workspace` should show the resolved repo context instead of erroring, and `weave add` should lazily create the session cache and proceed.
- The system should lazily create the machine-local session cache only as a convenience and should never block a command solely because the session is absent.
- `weave init` should detect an existing valid `.weave/workspace.yml` in the tree and, in that case, report "already initialized" and make no changes.
- When already initialized, `weave init` should never re-scaffold files, overwrite files, run `git init`, move the repo, or create/replace the machine-local session cache.
- The system should show "No Weave context found. Run `weave init` first." only when no valid `.weave/workspace.yml` exists anywhere up the tree.
- `weave change *` and `weave doctor` should continue to resolve context from `workspace.yml` and the git branch, unchanged.

## Permissions and Access Control

Not applicable. Weave commands operate on the local filesystem with the invoking user's permissions. There are no roles, sharing, or access tiers introduced by this change.

## States and Lifecycle

Initialization state, as perceived by commands, resolves to one of:

- Initialized: a valid `.weave/workspace.yml` exists up the tree. Commands proceed. `weave init` is a safe no-op.
- Uninitialized: no `.weave/workspace.yml` exists up the tree. Commands report "run `weave init` first". `weave init` performs a normal first-time init.

The machine-local session is orthogonal: present or absent, it never changes whether a command is allowed to run when the workspace is initialized.

## Notifications and Visibility

- `weave init` on an already-initialized workspace shows a concise message that Weave is already initialized (including mode) and suggests starting a new change, for example: "Weave is already initialized (mode: <repo|workspace>). Start a new change with `weave change new \"<title>\"`." It exits successfully.
- Everyday commands on a fresh clone show their normal successful output with no init prompt.
- The "Run `weave init` first" message appears only in the genuinely uninitialized case.
- Lazy session creation is silent; it does not add notice noise to command output.

## Edge Cases

- Fresh clone, workspace mode, no session: `weave add` and `weave workspace` succeed.
- Fresh clone, repo mode, no session: `weave workspace` shows the resolved repo context; `weave add` lazily creates a session and proceeds.
- Registered sub-repo missing locally after clone: `weave workspace` shows it as `missing` (informational); `weave add <url|path>` materializes it. Unchanged by this PRD.
- Command run from a nested subdirectory: mode detection still walks up to the nearest valid `.weave/workspace.yml`.
- Malformed or unreadable `workspace.yml`: treated as absent (falls through to the uninitialized path), consistent with existing behavior.
- `weave init` run in a nested subdirectory of an initialized workspace: detected as already initialized (walk-up), safe no-op.
- Genuinely uninitialized folder: unchanged first-time `weave init` behavior, including repo adoption when the user explicitly chooses workspace mode.

## Acceptance Criteria

- [ ] On a fresh clone of a workspace-mode workspace, `weave add <path|url>` succeeds without running `weave init`.
- [ ] On a fresh clone, `weave workspace` lists the workspace and its registered repos with no init prompt.
- [ ] No everyday command emits "Run `weave init` first" when a valid `.weave/workspace.yml` exists up the tree.
- [ ] `weave init` inside an already-initialized workspace reports "already initialized" and makes no file changes, no repo move, and no session write.
- [ ] The "already initialized" message includes the detected mode and suggests starting a new change via `weave change new "<title>"`.
- [ ] `weave init` in a folder with no `.weave/workspace.yml` performs normal first-time init.
- [ ] Repo-mode `weave workspace` with a valid `workspace.yml` but no session shows the resolved repo context (exit success) instead of `no_session`.
- [ ] "Run `weave init` first" still appears when no `.weave/workspace.yml` exists anywhere up the tree.
- [ ] `weave change *` and `weave doctor` behavior is unchanged when `workspace.yml` is present.

## Rollout Considerations

- No data migration is required. Existing workspaces already carry a committed `.weave/workspace.yml`.
- Backward compatible: previously working flows (first-time init, workspace-mode `weave workspace` without a session) continue to work.
- Documentation impact: update `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md` where it currently states repo-mode `weave workspace` with no session returns `no_session` / exit 1, and the repo-mode "Next: weave init" hint, to reflect the graceful-degradation behavior.
- Communication: a brief changelog note that cloned workspaces no longer require `weave init` and that `weave init` is now a safe no-op when already initialized.

## Analytics and Success Metrics

- Reduction in "run weave init first" occurrences reported on fresh clones (qualitative / support-driven, no telemetry assumed).
- Elimination of accidental repo-move incidents caused by running `weave init` in a cloned workspace.
- Faster time-to-first-successful-command for teammates joining from a clone.

## Revision History

- 2026-07-21: Initial PRD generated from session discussion (root-cause investigation and direction decisions). `exploration.md` was a thin scaffold and was supplemented by current-state CLI knowledge.
- 2026-07-21: Closed both open questions. `weave init` on an already-initialized workspace is a pure no-op (no scaffold, no repo move, no session write); lazy session creation lives in the everyday commands. The "already initialized" message now includes the detected mode and suggests starting a new change with `weave change new "<title>"`.

## Assumptions

- Repo-mode multi-folder membership remains machine-local; this PRD does not commit it to the repo, so a repo-mode clone starts with only the resolved repo context until the user re-adds folders. This is acceptable because the reported problem is about workspace clones.
- Detecting initialization by walking up for a valid `.weave/workspace.yml` (the existing `findWorkspaceMode` behavior) is the correct signal for "already initialized".
- A malformed `workspace.yml` should continue to be treated as absent, matching current behavior.

## Open Questions

None. Both open questions from the initial draft are resolved:

- `weave init` on an already-initialized workspace is a pure no-op for files, repo location, and the machine-local session. Lazy session creation happens in the everyday commands (`weave add`, repo-mode `weave workspace`) when needed, not in `weave init`.
- The "already initialized" message includes the detected mode and suggests the next action: start a new change with `weave change new "<title>"`.

## Out of Scope

- Ripping out the session concept entirely.
- Committing repo-mode session/folder membership into the repository.
- Auto-materializing (cloning/pulling) registered-but-missing sub-repos.
- Changing branch-derived active-change resolution.

## Further Notes

- Source-of-truth summary for engineering/QA: committed `.weave/workspace.yml` (initialized? mode? repos?), git branch (`change/<id>` -> active change), and `wiki/changes/*` on disk (the changes). The machine-local `~/.cache/weave/current-session.yml` is an optional cache.
- The intended fresh-clone experience for `weave workspace` in workspace mode is already documented in the core command reference ("Teammate Joins From A Fresh Clone"); this change extends the same principle to `weave add` and repo-mode `weave workspace`, and makes `weave init` idempotent.
