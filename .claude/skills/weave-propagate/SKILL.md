---
name: weave-propagate
description: Propagate an existing Weave change exploration to another repo in the current workspace. Use when a change later needs implementation or tasks in another repo.
last_changed_in: 0.1.0
---

# Purpose

Add an existing change to another repo while preserving the same change id and branch name.

# Workflow

1. Run:

```bash
weave workspace --json
weave change status
```

2. Identify the source change id and the target repo or repos.

3. Run:

```bash
weave change propagate <change-id> --to <target>...
```

Use `--from <target>` only when the source change is not in the current repo.

4. Report which repos received the change, whether the branch was created, checked out, already active, or skipped because the target is not a git repo, and which destination repos are now current for the propagated change.

# Behavior Rules

- Propagation copies `status.yml` and `exploration.md`.
- It preserves the same change id across repos.
- The branch name remains `change/{change-id}`.
- Destination repos become current for the propagated change.
- Do not overwrite an existing change folder in a target repo.

---

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
