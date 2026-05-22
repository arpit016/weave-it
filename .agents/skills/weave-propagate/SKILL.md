---
name: weave-propagate
description: Propagate an existing Weave feature exploration to another repo in the current workspace. Use when a feature later needs implementation or tasks in another repo.
---

# Purpose

Add an existing feature to another repo while preserving the same feature id and branch name.

# Workflow

1. Run:

```bash
weave workspace --json
```

2. Identify the source feature id and the target repo or repos.

3. Run:

```bash
weave feature propagate <feature-id> --to <target>...
```

Use `--from <target>` only when the source feature is not in the current repo.

4. Report which repos received the feature and whether the branch was created, checked out, already active, or skipped because the target is not a git repo.

# Behavior Rules

- Propagation copies `status.yml` and `exploration.md`.
- It preserves the same feature id across repos.
- The branch name remains `feature/{feature-id}`.
- Do not overwrite an existing feature folder in a target repo.
