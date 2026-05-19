---
name: weave-prd
description: Stress-test product requirements against the current system, workflows, and domain language. Use when refining PRDs, validating workflows, uncovering edge cases, clarifying ownership, or aligning new features with existing product behavior.
---

# Weave Awareness

This is a Weave product exploration skill.

Start by discovering the current Weave session:

```bash
weave workspace --json
```

Use the returned folders as the exploration boundary.

For each folder, inspect Weave knowledge first when present:

```text
weave/knowledge/index.md
weave/knowledge/context.md
weave/knowledge/*/index.md
weave/knowledge/*/context.md
weave/features/
```

Use `weave/knowledge/` as current product/domain context.

Use `weave/features/` as historical or in-progress feature context.

If a relevant feature folder exists, read the applicable feature artifacts:

```text
exploration.md
prd.md
decisions.md
contracts.md
status.yml
handoff.md
```

Do not assume every folder in the session is equally relevant. Identify which folders appear relevant and why.

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
9. Rollout(Feature flag, configuration, roll out to everyone) and migration concerns
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
