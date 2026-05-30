---
name: weave-prd
description: Generate or revise prd.md from the active Weave exploration. Use when the user wants to convert exploration context into a product requirements document.
---

# Weave PRD

This skill converts an existing usable Weave exploration into a product requirements document.

Use this after product discovery has been captured in `exploration.md`. This is not a discovery interview skill; use existing Weave context first. Ask the user only when a missing answer would materially change product scope, user behavior, permissions, rollout, or acceptance.

---

# Operating Principles

- Treat `exploration.md` as the primary source.
- Require a usable `exploration.md` before generating or revising `prd.md`.
- Treat `weave-prd` as entering or resuming the PRD lane for the active change.
- Treat `prd.md` as a living product artifact.
- Create `prd.md` when it does not exist.
- Revise `prd.md` in place when it already exists.
- Use `wiki/knowledge/` as product and domain context.
- Use other change artifacts as supporting context.
- Do not blindly replace the PRD with a fresh draft.
- Do not write an implementation plan.
- Do not include code-level design, schema details, API contracts, or test strategy unless needed to explain current product behavior.
- Make reasonable assumptions for minor gaps and document them in `Assumptions`.
- Put unresolved product decisions in `Open Questions`.

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
No active Weave change found. Run `weave change new` or `weave change switch`, then run `weave-prd` again.
```

After resolving the active change, set local artifact context:

```bash
weave artifact current set prd --json
```

This writes local Weave session state only. It does not write repo-tracked artifacts.

Identify the relevant change folder for each relevant workspace folder:

```text
wiki/changes/<change-id>/
```

Do not assume every folder in the workspace is relevant. Use the resolved change status and available artifacts to identify which folders apply.

---

# Required Read Order

For each relevant change folder, read files in this order.

## 1. Exploration

Read first:

```text
wiki/changes/<change-id>/exploration.md
```

If `exploration.md` is missing or unusable, stop and say:

```text
No usable exploration.md found for <change-id>. Run `weave-explore` first, then run `weave-prd` again.
```

Treat `exploration.md` as unusable when it is:

- missing
- blank or whitespace-only
- scaffold-only with headings but no substantive content
- explicitly marked `PRD Readiness` as `Not ready`

Do not generate `prd.md` from unusable exploration context. Do not simulate `weave-explore`, conduct the full discovery interview inside `weave-prd`, or write `exploration.md`. Stop and ask the user to run `weave-explore` first.

## 2. Current PRD Baseline

Check:

```text
wiki/changes/<change-id>/prd.md
```

If `prd.md` exists, read it as the baseline to revise. Preserve still-valid content. Do not discard existing sections just because the latest exploration is shorter.

If `prd.md` does not exist, create it from the available context.

## 3. PRD Resume Context

Read relevant session files when present:

```text
wiki/changes/<change-id>/sessions/*-prd.md
```

Load PRD session files newest-first. Use the latest `## Next Resume Point` to decide whether to continue synthesis, ask a blocking product question, or revise a specific PRD section.

Rules:

- Read `prd.md` before session notes. The live artifact is canonical current truth.
- Use session notes for rationale, unresolved points, user preferences, agent recommendations, and where to resume.
- Use older PRD session files only when needed to understand rationale or unresolved decisions.
- If session notes conflict with `prd.md`, prefer `prd.md` unless the latest session records an explicit newer user decision.
- If the user gives an explicit direction, follow it over the stored resume point.

At the start of resumed PRD work, briefly state what was loaded:

```text
Resuming PRD for <change-id>.
Loaded prd.md and <N> PRD session note(s).
Latest resume point: <summary>
```

If `prd.md` does not exist, skip PRD session resume and create the initial PRD from exploration context.

## 4. Change Metadata and Supporting Artifacts

Read when present:

```text
wiki/changes/<change-id>/status.yml
wiki/changes/<change-id>/decisions.md
wiki/changes/<change-id>/contracts.md
wiki/changes/<change-id>/handoff.md
wiki/changes/<change-id>/implementation.md
wiki/changes/<change-id>/tasks.md
```

Use these as supporting context. If artifacts conflict, prefer the latest explicit product decision from `exploration.md` or `decisions.md`. Record important conflicts in `Assumptions`, `Open Questions`, or `Revision History`.

## 5. Knowledge Context

Read Weave knowledge files when present:

```text
wiki/knowledge/index.md
wiki/knowledge/context.md
wiki/knowledge/*/index.md
wiki/knowledge/*/context.md
```

Load only knowledge domains that appear relevant to the change. Use knowledge to align terminology, workflows, permissions, and existing product behavior.

## 6. Repo Documentation

If Weave knowledge is thin or missing, inspect existing repo documentation for product context:

```text
CONTEXT.md
CONTEXT-MAP.md
docs/
docs/adr/
```

Use repo documentation only to clarify domain behavior and terminology.

---

# Create Or Revise

## When `prd.md` Is Missing

Create a complete PRD from the exploration and supporting context.

Start the file with artifact frontmatter:

```yaml
---
artifact: prd
status: draft
owner: product
created_at: <YYYY-MM-DD>
updated_at: <YYYY-MM-DD>
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---
```

Add `Revision History` with an initial entry:

```md
## Revision History

- <YYYY-MM-DD>: Initial PRD generated from `exploration.md`.
```

## When `prd.md` Exists

Revise the existing PRD in place.

Follow these rules:

- Preserve still-valid existing content.
- Preserve existing artifact lifecycle frontmatter unless the user explicitly asks to change review or approval metadata.
- If the existing PRD has no frontmatter, add compatible `artifact: prd` frontmatter without removing existing content.
- Add new workflows, requirements, edge cases, acceptance criteria, and rollout notes from newer exploration context.
- If scope expanded, update Goals, Proposed Product Behavior, User Workflows, User Stories, Functional Requirements, Edge Cases, Acceptance Criteria, Rollout Considerations, and Open Questions as needed.
- If scope narrowed, move removed behavior to `Non-Goals` or `Out of Scope` instead of silently deleting it.
- If a previous requirement is superseded, update the requirement and mention the change in `Revision History`.
- If new context contradicts older PRD content, prefer the latest explicit product decision and record the superseded point in `Revision History`, `Assumptions`, or `Open Questions`.
- If the latest exploration describes a substantially different change, stop and say:

```text
The latest exploration appears to describe a different change than the existing PRD. Create a new Weave change, or explicitly confirm that this PRD should be repurposed.
```

Add a dated `Revision History` entry summarizing the update. Keep entries concise and product-facing.

---

# Synthesis Rules

Convert the exploration into a PRD that can stand alone without the conversation history.

The PRD should be understandable by Product, Design, Engineering, QA, Customer Success, and Support.

When writing:

- Preserve concrete decisions from `exploration.md`.
- Preserve domain language from `wiki/knowledge/`.
- Separate goals from non-goals.
- Convert scenarios into user workflows, requirements, and acceptance criteria.
- Convert ambiguity into either an assumption or an open question.
- Include product-relevant technical constraints only as behavioral implications.
- Avoid implementation planning.
- Avoid speculative requirements not supported by the source context.

If the context is incomplete but a reasonable product assumption is safe, proceed and document it.

If a gap would materially change product scope, user behavior, permissions, rollout, or acceptance, do not invent the answer. Add it to `Open Questions`.

---

# Output Path

Write the completed or revised PRD to:

```text
wiki/changes/<change-id>/prd.md
```

Use Markdown.

Do not write any other files.
Setting local artifact context with `weave artifact current set prd --json` is allowed because it updates local session state, not repo-tracked change artifacts.

---

# Lifecycle Progress

After successfully writing or revising `prd.md`, run:

```bash
weave change progress prd --json
```

If lifecycle progress fails, do not rewrite `prd.md` just to recover. Report the progress failure in the completion response so the user can rerun the command or inspect `status.yml`.

---

# PRD Template

Use this structure.

```md
# <Feature / Change Name> PRD

## Problem Statement

Describe the problem from the user's perspective.

Include:
- who is facing the problem
- what they are trying to accomplish
- what is painful, missing, broken, slow, risky, or confusing today
- why this problem matters

## Goals

List the outcomes this change should achieve.

## Non-Goals

List what this PRD explicitly does not cover.

## Actors

List the people, roles, or systems involved.

## Current Behavior

Describe how this works today, based on the exploration and knowledge context.

Include:
- current workflow
- current limitations
- current workarounds
- current user pain points

## Proposed Product Behavior

Describe the desired product experience.

Focus on what the product should do, not how engineering should build it.

## User Workflows

Describe the major workflows step by step.

Use separate subsections for different actors or scenarios.

### Workflow: <Actor> <does something>

1. <Actor> opens...
2. <Actor> selects...
3. System shows...
4. <Actor> confirms...
5. System saves...

## User Stories

Provide a numbered list.

Each user story should follow this format:

1. As an <actor>, I want <feature/behavior>, so that <benefit>.

Cover:
- happy path
- empty states
- error states
- permission differences
- admin behavior
- notifications
- visibility
- edge cases
- rollout or migration behavior, if relevant

## Functional Requirements

List concrete product requirements.

Use clear language:

- The system should...
- The user should be able to...
- The system should prevent...
- The system should show...
- The system should notify...

## Permissions and Access Control

Describe who can view, create, edit, delete, approve, submit, configure, or export.

Include restrictions where relevant.

## States and Lifecycle

Include this section only if the change has meaningful states.

Describe:
- possible states
- state transitions
- who or what triggers each transition
- invalid transitions
- final states

## Notifications and Visibility

Describe what users see and when.

Include:
- in-app notifications
- email notifications
- Slack or third-party notifications, if relevant
- visibility rules
- status indicators

## Edge Cases

List important edge cases and expected product behavior.

Examples:
- missing data
- deleted users
- permission changes
- duplicate actions
- partial completion
- conflicting actions
- expired states
- large data volume
- retry or failure scenarios

## Acceptance Criteria

Use checkboxes.

- [ ] User can...
- [ ] System prevents...
- [ ] Admin can...
- [ ] Permissions are respected for...
- [ ] Empty states are handled for...
- [ ] Error states are handled for...

## Rollout Considerations

Describe product rollout expectations.

Include:
- internal rollout
- beta or customer rollout
- existing customer impact
- migration or backfill expectations, if product-relevant
- communication needs

## Analytics and Success Metrics

Describe how success will be measured.

Examples:
- adoption rate
- completion rate
- time saved
- error reduction
- support ticket reduction
- feature usage
- conversion or retention impact

## Revision History

Record concise dated entries for initial generation and subsequent revisions.

## Assumptions

List assumptions made while writing or revising this PRD.

Do not hide uncertainty inside requirements.

## Open Questions

List unresolved questions.

Only include questions that affect product behavior, user experience, permissions, scope, rollout, or acceptance.

## Out of Scope

List things that should not be handled as part of this PRD.

## Further Notes

Add useful context for Product, Design, Engineering, QA, Support, or Customer Success.
```

---

# Completion Response

After writing `prd.md`, respond with:

```text
Created PRD: wiki/changes/<change-id>/prd.md
```

or:

```text
Revised PRD: wiki/changes/<change-id>/prd.md
```

Then include:

```text
Sources used:
- exploration.md
- <other artifacts read>
- <knowledge files read>

Assumptions: <count>
Open questions: <count>
```

If multiple relevant folders were processed, list each created or revised PRD separately.
