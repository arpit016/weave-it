---
name: weave-prepare
description: Prepare task execution branches for an active Weave change without implementing, verifying, committing, pushing, or opening PRs.
last_changed_in: 0.1.0
---

# Weave Prepare

Use this skill when the user wants to prepare local branches for selected `T#` tasks in an active Weave change.

Prepare means branch readiness only. It does not implement code, run verification, change task statuses, commit, push, open PRs, stash, discard changes, or create remote branches.

# Silent Weave Command Output

Weave skills run Weave CLI commands silently by default. Use command results
as internal context, not response content.

Do not show raw stdout, JSON payloads, command echoes, lifecycle payloads,
internal state-write confirmations, or verbatim notice text unless the user
explicitly asks for diagnostic output.

Surface only information that changes what the user or agent should do next:
blockers, failures, missing relevant repos, branch or task outcomes,
lifecycle failures, package-outdated notices, relevant outdated or modified
skills, and user-required actions.

Notice handling:

- `package_outdated`: show only when present. Say exactly:
  `A newer Weave version is available. Run \`weave status\` for details, then upgrade Weave when convenient.`
- `skills_outdated`: suppress unrelated skills. If the invoked skill is outdated, say:
  `The installed \`<skill-name>\` skill appears older than the bundled template. Run \`weave status\` for details, then \`weave agent update --all\` when you want to refresh installed skills.`
- `skills_outdated`: if multiple skills used in this workflow are outdated, say:
  `Some installed skills used in this workflow appear older than the bundled templates: \`<skill-a>\`, \`<skill-b>\`. Run \`weave status\` for details, then \`weave agent update --all\` when you want to refresh them.`
- `skills_modified`: suppress unless the invoked skill is modified locally or the user is asking about skill updates. If the invoked skill is modified, say:
  `The installed \`<skill-name>\` skill has local edits, so its behavior may differ from the bundled template. Run \`weave status\` or \`weave agent diff\` if you want to inspect the difference.`
- `skills_modified`: if the user asks to update skills and installed skills have local edits, say:
  `Some installed skills have local edits. \`weave agent update\` may skip or protect them; run \`weave status\` or \`weave agent diff\` before updating.`

Do not say `Notices: ...`, `The command returned notices`, raw
`notices[].message`, full notice JSON, or full skill lists unless the user
asks for diagnostics.

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
