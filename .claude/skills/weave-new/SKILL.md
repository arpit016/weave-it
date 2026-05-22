---
name: weave-new
description: Start a new Weave feature exploration from a title or topic. Use when the user wants to begin capturing a feature under wiki/features and create the matching feature branch.
---

# Purpose

Start a new Weave feature exploration.

Use this when the user is starting from a title or topic, not when they are already deep in a discussion. For an existing discussion, prefer `weave-capture`.

# Workflow

1. Run:

```bash
weave workspace --json
```

2. Identify the current repo and any additional session repos. Explain that additional repos should participate only if the feature will likely require implementation or tasks there.

3. Ask the user which additional repos should participate when more than one repo is in the session.

4. Run:

```bash
weave feature new "<title>" --target <target>...
```

Use `--slug <slug>` only when the user requested a specific folder or branch slug.

5. Report the feature id, target repos, and branch status.

# Behavior Rules

- The CLI owns feature id generation, folder creation, status metadata, and git branch creation.
- The created branch is `feature/{feature-id}`.
- Do not create `prd.md`.
- Treat `exploration.md` as the first artifact.
- After creation, continue product discovery in `exploration.md` until PRD readiness is clear.
