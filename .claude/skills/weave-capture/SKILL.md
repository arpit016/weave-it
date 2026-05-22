---
name: weave-capture
description: Capture the current product discussion into a Weave feature exploration. Use when a discussion should become a durable feature artifact under wiki/features.
---

# Purpose

Capture an existing discussion as a Weave feature exploration.

Use this when the user has already discussed a feature and wants to preserve the topic, decisions, open questions, scenarios, and known constraints.

# Workflow

1. Run:

```bash
weave workspace --json
```

2. Infer a concise title from the discussion unless the user provided `--title`.

3. Identify additional session repos. Explain that additional repos should participate only if the feature will likely require implementation or tasks there.

4. Ask the user which additional repos should participate when more than one repo is in the session.

5. Run:

```bash
weave feature new "<title>" --target <target>...
```

Use `--slug <slug>` only when the user requested a specific folder or branch slug.

6. Update the generated `exploration.md` with the discussion context:

```text
Current Understanding
Open Questions
Decisions
Scenarios
Existing Behavior
PRD Readiness
```

# Behavior Rules

- The CLI owns feature id generation, folder creation, status metadata, and git branch creation.
- The created branch is `feature/{feature-id}`.
- Do not create `prd.md`.
- Do not lose concrete decisions already made in the conversation.
- Keep unresolved choices explicit in `Open Questions`.
