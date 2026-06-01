---
name: weave-clarify
description: Clarify and revise one existing Weave change artifact without advancing the workflow. Use when scope, requirements, assumptions, or decisions change midstream and an existing exploration.md, prd.md, or architecture.md needs amendment.
---

# Weave Clarify

This skill refines one existing Weave change artifact without advancing the change workflow.

Use it when the user needs to amend `exploration.md`, `prd.md`, or `architecture.md` because scope changed, requirements changed, an assumption needs confirmation, or a previous requirement is no longer valid.

This is not a generation skill. Do not create a new change, create issues, generate a PRD from scratch, generate architecture from scratch, or cascade-update multiple artifacts.

---

# Operating Principles

- Treat the selected target artifact as the only write target.
- Read supporting artifacts only for context.
- Ask focused clarification questions before writing when the change is ambiguous or materially affects scope, user behavior, technical direction, acceptance, or follow-up artifacts.
- Preserve still-valid content.
- Do not silently delete old requirements, decisions, constraints, or risks.
- Record superseded, removed, or narrowed scope explicitly.
- Report likely follow-up artifacts instead of editing them automatically.
- After writing the selected artifact, update lifecycle state with `weave change progress <target> --json`.
- Do not hand-edit `status.yml`; lifecycle state is owned by the CLI.
- Do not run autonomous or internal auto mode. V1 is user-invoked and interactive only.

---

# Resolve Context

Start by discovering the current Weave session:

```bash
weave workspace --json
```

Use the returned folders as the boundary for context loading.

Resolve the target change:

1. If the user provided a change id, slug, title fragment, or other change hint, run:

```bash
weave change status "<change-hint>" --json
```

2. Otherwise, run:

```bash
weave change current --json
weave change status --json
```

If no active or hinted change can be resolved, stop and say:

```text
No active Weave change found. Run `weave change new` or `weave change switch`, then run `weave-clarify` again.
```

Identify the relevant change folder for each relevant workspace folder:

```text
wiki/changes/<change-id>/
```

Do not assume every folder in the workspace is relevant. Use the resolved change status and available artifacts to identify which folders apply.

---

# Target Artifact

Supported target artifacts:

```text
exploration
prd
architecture
```

Accept common filenames as aliases:

```text
exploration.md -> exploration
prd.md -> prd
architecture.md -> architecture
```

If the user provides a target artifact, clarify only that artifact.

If the user does not provide a target artifact:

1. Read the available active change artifacts.
2. Identify which supported artifacts appear affected by the user's clarification.
3. Ask the user which single artifact to clarify first.
4. Do not write anything until the user selects one target.

If multiple artifacts are affected, still update only the selected artifact in this invocation. Report the others as follow-up targets in the completion response.

---

# Required Read Order

For each relevant change folder, read files in this order.

## 1. Target Artifact

Read the selected target first:

```text
wiki/changes/<change-id>/exploration.md
wiki/changes/<change-id>/prd.md
wiki/changes/<change-id>/architecture.md
```

If the selected target does not exist, stop with the relevant message:

```text
No exploration.md found for <change-id>. Run `weave-explore` or `weave-capture` first, then run `weave-clarify exploration`.
```

```text
No prd.md found for <change-id>. Run `weave-prd` first, then run `weave-clarify prd`.
```

```text
No architecture.md found for <change-id>. Run `weave-architect` first, then run `weave-clarify architecture`.
```

## 2. Supporting Artifacts

Read supporting artifacts when present:

```text
wiki/changes/<change-id>/status.yml
wiki/changes/<change-id>/exploration.md
wiki/changes/<change-id>/prd.md
wiki/changes/<change-id>/architecture.md
wiki/changes/<change-id>/decisions.md
wiki/changes/<change-id>/contracts.md
wiki/changes/<change-id>/handoff.md
wiki/changes/<change-id>/implementation.md
wiki/changes/<change-id>/tasks.md
```

Do not reread the target artifact twice unless needed. Use supporting artifacts to understand context, conflicts, and follow-up impact.

## 3. Target Resume Context

Read relevant session files for the selected target when present:

```text
wiki/changes/<change-id>/sessions/*-exploration.md
wiki/changes/<change-id>/sessions/*-prd.md
wiki/changes/<change-id>/sessions/*-architecture.md
```

Only load session files that match the selected target artifact, newest-first.

Rules:

- Read the selected live artifact before session notes. The live artifact is canonical current truth.
- Use the latest `## Next Resume Point`, unresolved points, user preferences, and agent recommendations as clarification context.
- Use older matching session files only when needed to understand rationale or unresolved decisions.
- If session notes conflict with the selected live artifact, prefer the live artifact unless the latest session records an explicit newer user decision.
- If the user gives an explicit clarification instruction, follow it over the stored resume point.

## 4. Knowledge Context

Read Weave knowledge files when present:

```text
wiki/knowledge/index.md
wiki/knowledge/context.md
wiki/knowledge/*/index.md
wiki/knowledge/*/context.md
```

Load only knowledge domains that appear relevant to the clarification.

## 5. Repo Documentation

If Weave knowledge is thin or missing, inspect existing repo documentation for product or technical context:

```text
CONTEXT.md
CONTEXT-MAP.md
README.md
docs/
docs/adr/
adr/
```

Use repo documentation only to clarify current behavior, terminology, constraints, or architecture context.

---

# Clarification Flow

## 1. Classify The Change

Classify the user's clarification as one or more of:

- scope expansion
- scope reduction
- superseded requirement or decision
- assumption confirmation
- ambiguity resolution
- technical direction change
- follow-up artifact staleness

If the clarification appears to describe a substantially different change, stop and ask for explicit confirmation before repurposing the active change artifact.

## 2. Ask Blocking Questions

Ask questions only when the answer affects:

- product scope
- user behavior
- permissions or access
- acceptance criteria
- technical direction
- implementation risk
- artifact consistency
- whether the active change should be repurposed

For each question:

- explain why it matters
- provide a recommended answer when there is a clear default
- describe the tradeoff briefly
- wait for the user's answer before writing

If no blocking questions remain, proceed with the clarification using the available context.

## 3. Update Only The Selected Artifact

Write only the selected target artifact.

Do not edit follow-up artifacts in the same invocation, even when they are stale.

When updating:

- preserve still-valid content
- Preserve existing artifact lifecycle frontmatter; if the selected artifact has no frontmatter, add compatible lifecycle frontmatter using UTC ISO timestamps for `created_at` and `updated_at`.
- update current behavior or proposed behavior to reflect the latest decision
- move removed scope to `Non-Goals` or `Out of Scope` where appropriate
- record superseded requirements or decisions in `Revision History`, `Assumptions`, `Open Questions`, or an artifact-specific notes section
- add unresolved decisions to the artifact's open-question section
- keep the artifact understandable without the conversation history

## 4. Report Follow-Up Artifacts

After writing the selected artifact, identify other supported artifacts that may need clarification:

- If `exploration.md` changed and `prd.md` exists, report `prd.md` as a likely follow-up when product behavior, scope, requirements, or acceptance changed.
- If `prd.md` changed and `status.yml.artifacts.architecture.sources` includes `prd`, report `architecture.md` as a likely follow-up when technical design, rollout, risks, or tests may be stale.
- If `architecture.md` changed and issue/task evidence depends on `architecture`, report issues or `tasks.md` as a likely follow-up when implementation slices may be stale.

Do not edit those artifacts. Ask the user to run `weave-clarify <target>` separately for each follow-up artifact.

---

# Target-Specific Rules

## exploration

Use `exploration.md` as the target when discovery, scope, scenarios, decisions, or PRD readiness changed.

Keep these sections current when present:

```text
Current Understanding
Open Questions
Decisions
Scenarios
Existing Behavior
PRD Readiness
```

If the clarification makes the exploration ready or not ready for PRD generation, update `PRD Readiness`.

## prd

Use `prd.md` as the target when product behavior, user workflows, user stories, requirements, edge cases, acceptance criteria, rollout, assumptions, or open questions changed.

Preserve still-valid PRD content. If scope narrowed, move removed behavior to `Non-Goals` or `Out of Scope` instead of silently deleting it.

Add a concise dated `Revision History` entry for meaningful changes.

## architecture

Use `architecture.md` as the target when technical approach, affected systems, data flow, architecture decisions, rejected alternatives, rollout, operations, testing, security, risks, assumptions, or open technical questions changed.

Prefer `prd.md` as the product contract. If the technical clarification exposes a product ambiguity not settled by the PRD, record it under `Product Questions Raised by Technical Design` and report `prd.md` as a follow-up artifact.

Add a concise dated `Revision History` entry for meaningful changes.

---

# Output Path

Write the clarified artifact to exactly one of:

```text
wiki/changes/<change-id>/exploration.md
wiki/changes/<change-id>/prd.md
wiki/changes/<change-id>/architecture.md
```

Do not write any other files.

---

# Lifecycle Progress

After successfully writing the selected artifact, run the matching lifecycle command:

```bash
weave change progress exploration --source discussion --json
weave change progress prd --source exploration --source sessions --json
weave change progress architecture --source prd --source codebase --json
```

Run only the command matching the selected target artifact and pass only sources that actually informed the clarified artifact. If lifecycle progress fails, do not rewrite the clarified artifact just to recover. Report the progress failure in the completion response.

---

# Completion Response

After writing, respond with:

```text
Clarified <target>: wiki/changes/<change-id>/<artifact>.md
```

Then include:

```text
Clarifications applied: <count or concise summary>
Open questions: <count>
Follow-up artifacts:
- <artifact or None>
```

If no write was made because the skill needed target selection, confirmation, or answers to blocking questions, say that directly and list what is needed next.
