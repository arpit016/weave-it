---
name: weave-explore
description: Stress-test product requirements against the current system, workflows, and domain language. Use when refining PRDs, validating workflows, uncovering edge cases, clarifying ownership, or aligning new changes with existing product behavior.
last_changed_in: 0.1.0
---

# Weave Awareness

This is a Weave product exploration skill.

---

# Plan Mode Guard

This skill must run in Plan Mode.

If the current environment exposes collaboration mode and it is not Plan Mode, stop immediately and say:

```text
This skill must run in Plan Mode. Switch to Plan Mode, then invoke weave-explore again.
```

Do not inspect deeply, ask discovery questions, update artifacts, or continue the exploration before this guard passes.

Static Weave skill content cannot automatically switch collaboration mode. The host, user, or developer layer must switch modes before this skill continues.

In Plan Mode, do not write repo-tracked artifacts directly. Produce the exploration plan, decisions, questions, or proposed artifact changes needed for the user to approve. Actual artifact writes should happen only after the user exits Plan Mode and asks to implement the plan.

---

Start by discovering the current Weave session:

```bash
weave workspace --json
weave change current --json
weave artifact current set exploration --json
```

Use the returned folders as the exploration boundary. If there is no active Weave change, stop and ask the user to run `weave change new` or `weave change switch` before continuing.

Setting artifact context writes local Weave session state only. It does not write repo-tracked artifacts and is allowed before discussion begins.

For each folder, inspect Weave knowledge first when present:

```text
wiki/knowledge/index.md
wiki/knowledge/README.md
wiki/knowledge/domains/**/index.md
wiki/knowledge/domains/**/features/**/behavior.md
wiki/knowledge/domains/**/domain-wide/**
wiki/knowledge/shared/**/behavior.md
wiki/knowledge/**/source-map.md
wiki/changes/
```

Use `wiki/knowledge/` as current product/domain context.

Use `wiki/changes/` as historical or in-progress change context.

If a relevant change folder exists, read the applicable change artifacts:

```text
exploration.md
prd.md
sessions/*-exploration.md
decisions.md
contracts.md
status.yml
handoff.md
implementation.md
tasks.md
```

Do not assume every folder in the session is equally relevant. Identify which folders appear relevant and why.

---

# Resume Context

`weave-explore` means enter or resume exploration for the active change.

When an active change already has exploration context, resume before asking new discovery questions:

1. Read `wiki/changes/<change-id>/exploration.md` first. Treat the live artifact as canonical current truth.
2. Read relevant `wiki/changes/<change-id>/sessions/*-exploration.md` files newest-first.
3. Prioritize the latest `## Next Resume Point` when deciding what to ask or examine next.
4. Use older exploration session files only when needed for rationale, unresolved points, user preferences, or agent recommendations.
5. If session notes conflict with the live artifact, prefer the live artifact unless the latest session records an explicit newer user decision.
6. If the user gives an explicit direction, follow it over the stored resume point.

At the start of a resumed exploration, briefly state what was loaded:

```text
Resuming exploration for <change-id>.
Loaded exploration.md and <N> exploration session note(s).
Latest resume point: <summary>
```

If no useful prior exploration content or session notes exist, start normal exploration.

---

# Purpose

This skill helps refine product requirements by interrogating workflows, domain language, permissions, lifecycle behavior, operational expectations, and edge cases.

The goal is to clarify:
- what the system should do
- who experiences it
- how it behaves in real scenarios
- how it fits into the existing product model

This is a product discovery and requirement clarification exercise - not an architecture review.

---

# Core Behavior

Interview the user relentlessly about the product behavior until a shared understanding is reached.

Ask questions one at a time and wait for the user's response before continuing.

For each question:
- explain why the question matters
- provide a likely/default recommendation
- explain implications of alternative choices
- keep the discussion grounded in user and business behavior
- avoid implementation details unless explicitly requested

Prefer:
- concrete scenarios
- user journeys
- lifecycle transitions
- ownership clarification
- operational edge cases

Avoid:
- infrastructure discussions
- database choices
- eventing strategies
- APIs
- storage design
- deployment architecture
- framework discussions

unless the user explicitly asks for technical design.

---

# Discovery Order

Resolve questions in this order:

1. Domain language
2. Users, actors, and roles
3. User workflows
4. Permissions and admin controls
5. State transitions and lifecycle rules
6. Failure cases and edge cases
7. Notifications and visibility
8. Operational expectations
9. Rollout flags, configuration, rollout scope, and migration concerns
10. Technical implications (only if required)

Do not jump into technical implementation prematurely.

---

# Technical Boundary

You may inspect the codebase to:
- understand existing workflows
- identify terminology
- discover current constraints
- detect contradictions
- understand current product behavior
- uncover hidden assumptions

Use the codebase to anchor the conversation in reality.

But do NOT ask users to choose:
- databases
- queues
- event buses
- consistency models
- storage engines
- deployment patterns
- API styles
- frameworks

unless:
1. the user explicitly requests technical design
2. or the decision materially changes product behavior, compliance, or operational guarantees

If a technical concern emerges:
- capture it as a technical implication
- do not force resolution immediately
- continue product discovery first

Translate technical concerns into behavioral language whenever possible.

Example:
Instead of asking:
> "Should this be eventually consistent?"

Ask:
> "Is it acceptable if users see updates a few seconds later?"

---

# Scenario-Driven Discovery

Prefer concrete scenarios over abstractions.

Instead of:
> "Can approvals be revoked?"

Ask:
> "Suppose compensation is finalized and a manager reopens the review afterward - what should happen?"

Use scenarios to:
- expose hidden assumptions
- clarify ownership
- test lifecycle boundaries
- uncover operational risks
- reveal conflicting expectations

---

# Domain Awareness

During codebase exploration, also look for existing documentation. Prefer Weave knowledge when present, and use existing repo documentation as additional context.

## File structure

Most repos have a single context:

```text
/
|-- CONTEXT.md
|-- docs/
|   `-- adr/
`-- src/
```

Some repos have multiple contexts:

```text
/
|-- CONTEXT-MAP.md
|-- docs/
|   `-- adr/
`-- src/
    |-- ordering/
    |   |-- CONTEXT.md
    |   `-- docs/adr/
    `-- billing/
        |-- CONTEXT.md
        `-- docs/adr/
```

Use existing documentation to:
- align terminology
- avoid duplicate concepts
- detect conflicting meanings
- understand established workflows
- reconcile Weave knowledge with repo-local docs when they conflict

---

# PM-Safe Code Exploration

Code inspection is allowed when needed to verify current product behavior.

However, do not show code snippets, function internals, database schemas, API details, or infrastructure details unless the user explicitly asks.

Translate technical findings into product language.

Good:
> "Today, the system appears to finalize the whole review at once. It does not currently support partial approvals."

Avoid unless asked:
> "The `finalizeReview()` function calls `updateMany()` on all review items."

If technical uncertainty matters, surface it as a product-relevant implication:
> "There may be technical coupling here, but the product question is whether partial approval should exist at all."

Keep technical implications separate from product decisions.

---

# Glossary Discipline

Challenge terminology aggressively.

If the user uses a term that conflicts with the existing language, call it out immediately.

Example:
> "Your glossary defines 'submission' differently from how you're using it here - which meaning should we standardize on?"

Sharpen vague language.

Replace overloaded terms with precise domain concepts.

Example:
> "When you say 'manager', do you mean the direct manager, calibration owner, or workflow approver?"

Do not allow ambiguous terminology to survive.

---

# Cross-Reference With Reality

When the user describes behavior:
- verify whether the existing system already behaves differently
- inspect workflows if necessary
- surface contradictions explicitly

Example:
> "You mentioned partial approvals are allowed, but the current workflow finalizes the entire review together. Which behavior should be authoritative?"

Treat the current product behavior as an important input - but not necessarily the correct future behavior.

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

---

# Plan Mode Protocol

This skill sets local Weave session state for the exploration artifact lane via:

```bash
weave artifact current set exploration --json
```

Every supported agent harness (Claude, Cursor, Codex, OpenCode) blocks
filesystem-write tool calls in Plan Mode, ask mode, and any read-only
collaboration mode. Run the call only when the harness allows mutations.

When the host harness blocks mutations (Plan Mode, ask mode, read-only):

1. Do NOT attempt `weave artifact current set exploration --json`.
2. Declare the target lane at the top of the plan output: `Lane: exploration`.
3. End the plan output with this exact directive:

   `On plan acceptance, the first action will be: weave artifact current set exploration --json`

When the host harness allows mutations (Agent Mode resumes after plan
acceptance, or the skill was invoked directly in Agent Mode):

1. The FIRST tool call MUST be:

   `weave artifact current set exploration --json`

2. Then proceed with the rest of the skill's discovery and work.
