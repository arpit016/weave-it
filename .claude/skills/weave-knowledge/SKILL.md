---
name: weave-knowledge
description: Update current-state Weave knowledge specs and change-local knowledge delta for an active change.
last_changed_in: 0.1.0
---

# Weave Knowledge

Use this skill when the user wants to update the knowledge base after a completed change, bug fix, feature addition, removal, or behavior clarification.

Knowledge is current-state behavior. Historical provenance stays in `wiki/changes/**`.

# Behavior Rules

- Do not require Plan Mode.
- Do not create a new change unless the user explicitly asks for one.
- Do not hand-edit `status.yml`; use `weave change knowledge <status>`.
- Do not store raw transcripts.
- Do not silently move, rename, delete, or reorganize existing user-authored knowledge files.
- You may create missing standard folders and files when they are needed for the active knowledge update.
- Prefer current behavior over historical narrative.
- Keep source anchors specific enough for a future agent to verify behavior in code or tests.

# Resolve Context

Start by discovering the current Weave session and active change:

```bash
weave workspace --json
weave change current --json
weave change status --json
```

If no active change exists, stop and say:

```text
No active Weave change found. Knowledge updates normally need change provenance. Start or switch a change, then run `weave-knowledge` again.
```

# Read Context

For each active-change target, read:

```text
wiki/changes/<change-id>/status.yml
wiki/changes/<change-id>/exploration.md
wiki/changes/<change-id>/prd.md
wiki/changes/<change-id>/architecture.md
wiki/changes/<change-id>/tasks.md
wiki/changes/<change-id>/sessions/*.md
```

Read relevant knowledge files when present:

```text
wiki/knowledge/index.md
wiki/knowledge/README.md
wiki/knowledge/domains/**/index.md
wiki/knowledge/domains/**/features/**/behavior.md
wiki/knowledge/domains/**/domain-wide/**
wiki/knowledge/shared/**/behavior.md
wiki/knowledge/**/source-map.md
```

Inspect source anchors, tests, config, jobs, and integrations only as needed to ground the behavior.

# Target Selection

Use `domains/` for product or system areas that users naturally name.

Use `features/` for independently understandable behavior inside a domain.

Use `domain-wide/` for behavior that coordinates multiple features inside one domain.

Use `shared/` for behavior reused across multiple domains.

If multiple targets are plausible, summarize the candidates and ask the user to choose before writing.

# Templates

`behavior.md` is the core current-state spec:

```md
# <Feature Or Shared Behavior>

## Purpose
## Current Behavior
## Domain Model
## Configuration Dimensions
## Behavioral Rules
## Decision Tables
## Lifecycle
## Permissions And Visibility
## Integrations And Side Effects
## Edge Cases
## Invariants
## Source Anchors
## Change History
## Open Questions
```

Not every section must be populated. Strongly prefer `Purpose`, `Current Behavior`, `Source Anchors`, and `Change History`.

`decision-tables.md` is optional and focused on permutations:

```md
# <Feature> Decision Tables

## Table: <Scenario>

| Dimension | Value | Outcome |
| --- | --- | --- |

## Notes
## Source Anchors
```

`source-map.md` connects behavior to reality:

```md
# <Domain Or Feature> Source Map

## Core Product Surfaces
## Source Anchors
## Tests
## Config And Flags
## Jobs And Side Effects
## External Integrations
## Ownership Notes
```

`knowledge-delta.md` is the per-change bridge:

```md
# Knowledge Delta

## Durable Behavior Changes
## Affected Knowledge Areas
## Knowledge Files Updated
## No-Impact Rationale
## Source Evidence
## Follow-Up Knowledge Work
```

# Write Knowledge

Create or update:

```text
wiki/changes/<change-id>/knowledge-delta.md
wiki/knowledge/**
```

When there is durable behavior impact:

- update current-state specs under `wiki/knowledge/**`
- create or update `knowledge-delta.md`
- call `weave change knowledge updated`

Example:

```bash
weave change knowledge updated --domain performance-reviews --shared approvals --file wiki/knowledge/domains/performance-reviews/domain-wide/approvals.md --delta wiki/changes/<change-id>/knowledge-delta.md --reason "Updated current review approval behavior." --json
```

When there is no durable knowledge impact:

- write a no-impact rationale in `knowledge-delta.md`
- call `weave change knowledge none --delta wiki/changes/<change-id>/knowledge-delta.md --reason "<reason>" --json`

When knowledge impact cannot be resolved yet:

- explain the blocker
- call `weave change knowledge pending --reason "<reason>" --json` when useful

# Completion Response

Report:

```text
Knowledge delta: wiki/changes/<change-id>/knowledge-delta.md
Knowledge files updated: <files or none>
Knowledge status: <pending|stale|updated|none>
```

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
