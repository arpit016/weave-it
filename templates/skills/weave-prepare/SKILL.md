---
name: weave-prepare
description: Prepare task execution branches for an active Weave change without implementing, verifying, committing, pushing, or opening PRs.
last_changed_in: 0.1.0
---

# Weave Prepare

Use this skill when the user wants to prepare local branches for selected `T#` tasks in an active Weave change.

Prepare means branch readiness only. It does not implement code, run verification, change task statuses, commit, push, open PRs, stash, discard changes, or create remote branches.

# Surface Weave Notices

Every Weave skill discovery phase calls at least one Tier 1 command
(`weave workspace`, `weave change current`, `weave change status`,
`weave change new`, or `weave status`). Tier 1 commands return a stable
`notices` array in their `--json` output describing outdated packages,
modified skills, and skills that need updating.

When you run any Tier 1 command (with or without `--json`) and the result
contains a non-empty `notices` array, surface them to the user verbatim
near the start of your response. Do not edit notice text. Do not suppress
notices unless the user explicitly asks. Do not invent notices.

If notices recommend `weave status`, suggest the user run it. If notices
recommend `weave agent update`, suggest that. Do not run `npm i -g` or
any package manager command yourself; let the user run it.

If `WEAVE_NO_NOTICES=1` is set in the environment, the notices array will
be empty by design and you should not warn about it.

# Resolve Context

Start with Tier 1 context commands:

```bash
weave workspace --json
weave change current --json
weave change status --json
```

If there is no active change, stop and say that the user needs `weave change new` or `weave change switch` first.

# Selector Handling

The CLI owns all branch movement and `status.yml` writes. Do not hand-edit `status.yml` and do not run git checkout commands yourself for this workflow.

Map user input as follows:

- `all` -> `weave task prepare --all --json`
- Task ids such as `T1` or `T1 T3` -> `weave task prepare T1 T3 --json`
- A single non-task, non-`all` value such as `backend` -> `weave task prepare --scope backend --json`

If the user invokes `/weave-prepare` without arguments, ask what to prepare. Derive suggestions from `wiki/changes/<change-id>/tasks.md`: include `all`, available `Scope` values, and available `T#` task ids. Do not default to `all`.

# Run Prepare

Run exactly one prepare command after resolving the selector:

```bash
weave task prepare <selector> --json
```

If the global `weave` command is unavailable in this repo, use the local development form:

```bash
npm run dev -- task prepare <selector> --json
```

# Summarize Results

Summarize the JSON result in user terms:

- Change id and branch.
- Selected tasks.
- Prepared repos and branch actions: `created`, `checked_out`, `already_active`.
- Skipped non-git repos with `skipped_not_git`.
- Blockers, if any, with the repo/task target and reason.

If status is `blocked`, state that no selected implementation repo branches were moved by the prepare command. Remind the user that dirty work on the expected branch is allowed, but dirty work on another branch must be resolved by the user.

Always close by stating that prepare did not implement, verify, commit, push, open a PR, stash, discard changes, or update task statuses.
