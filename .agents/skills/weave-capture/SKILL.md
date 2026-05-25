---
name: weave-capture
description: Capture the current product discussion into a Weave change exploration. Use when a discussion should become a durable change artifact under wiki/changes.
---

# Purpose

Capture an existing discussion as a Weave change exploration.

Use this when the user has already discussed a change and wants to preserve the topic, decisions, open questions, scenarios, and known constraints.

# Workflow

1. Run:

```bash
weave workspace --json
weave change current
```

2. Infer a concise title from the discussion unless the user provided `--title`.

3. Identify additional session repos. Explain that additional repos should participate only if the change will likely require implementation or tasks there.

4. Ask the user which additional repos should participate when more than one repo is in the session.

5. Run:

```bash
weave change new "<title>" --target <target>...
```

Use `--type <type>` when the discussion is not about a new capability. Supported values are `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, and `chore`.

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

The newly created change becomes the current change for every target.

# Behavior Rules

- The CLI owns change id generation, folder creation, status metadata, and git branch creation.
- The created branch is `change/{change-id}`.
- Do not create `prd.md`.
- Do not lose concrete decisions already made in the conversation.
- Keep unresolved choices explicit in `Open Questions`.
