---
name: weave-new
description: Start a new Weave change exploration from a title or topic. Use when the user wants to begin capturing a change under wiki/changes and create the matching change branch.
last_changed_in: 0.1.0
---

# Purpose

Start a new Weave change exploration.

Use this when the user is starting from a title or topic, not when they are already deep in a discussion. For an existing discussion, prefer `weave-capture`.

# Workflow

1. Run:

```bash
weave workspace --json
weave change current
```

2. Identify the current workspace or repo context from `weave workspace --json`. In workspace mode, the workspace root owns the change store even if implementation later touches registered sub-repos.

3. Run:

```bash
weave change new "<title>"
```

Use `--type <type>` when the work is not a new capability. Supported values are `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, and `chore`.

Use `--slug <slug>` only when the user requested a specific folder or branch slug.

4. Report the change id, resolved workspace/repo context, branch status, and that the new change is now current.

# Behavior Rules

- The CLI owns change id generation, folder creation, status metadata, and git branch creation.
- The created branch is `change/{change-id}`.
- Do not create `prd.md`.
- For `feat` changes, the CLI scaffolds `exploration.md` and starts at `stage: exploration`; treat `exploration.md` as the first artifact.
- For non-feature changes (`fix`, `refactor`, `docs`, `test`, `ci`, `chore`), the CLI does not scaffold `exploration.md` and starts at `stage: started`. The first real artifact is created later by the fitting skill: `weave-architect` for diagnosis or RCA, `weave-issues` when the work is already clear, or `weave-prd`/`weave-explore` only when expected behavior is unclear.
- After creating a `feat` change, suggest the user go into plan mode and use `weave-explore` to explore the discussion; do not do any product discovery yourself using this skill. After creating a non-feature change, recommend the fitting next skill instead of `weave-explore`.

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
