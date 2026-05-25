---
name: weave-propagate
description: Propagate an existing Weave change exploration to another repo in the current workspace. Use when a change later needs implementation or tasks in another repo.
---

# Purpose

Add an existing change to another repo while preserving the same change id and branch name.

# Workflow

1. Run:

```bash
weave workspace --json
```

2. Identify the source change id and the target repo or repos.

3. Run:

```bash
weave change propagate <change-id> --to <target>...
```

Use `--from <target>` only when the source change is not in the current repo.

4. Report which repos received the change and whether the branch was created, checked out, already active, or skipped because the target is not a git repo.

# Behavior Rules

- Propagation copies `status.yml` and `exploration.md`.
- It preserves the same change id across repos.
- The branch name remains `change/{change-id}`.
- Do not overwrite an existing change folder in a target repo.
