---
name: weave-architect
description: Generate or revise architecture.md for an active Weave change by inspecting the codebase and technical context. Use when the user wants engineering architecture, technical design, implementation strategy, tradeoff analysis, risk review, or a design doc.
---

# Weave Architect

This skill converts available Weave product and technical context into an engineer-facing architecture and technical design document.

Use `prd.md` when it exists and is useful, but do not require it. This is not a product PRD generator and not an issue breakdown skill. Ask the user only when a missing answer would materially affect architecture, implementation risk, operational guarantees, security, scalability, data integrity, or delivery sequencing.

---

# Plan Mode Guard

This skill must run in Plan Mode.

If the current environment exposes collaboration mode and it is not Plan Mode, stop immediately and say:

```text
This skill must run in Plan Mode. Switch to Plan Mode, then invoke weave-architect again.
```

Do not inspect deeply, ask architecture questions, update artifacts, or continue technical design before this guard passes.

Static Weave skill content cannot automatically switch collaboration mode. The host, user, or developer layer must switch modes before this skill continues.

In Plan Mode, do not write repo-tracked artifacts directly. Produce the architecture plan, technical decisions, questions, or proposed artifact changes needed for the user to approve. Actual `architecture.md` writes should happen only after the user exits Plan Mode and asks to implement the plan.

---

# Operating Principles

- Treat `prd.md` as the preferred product contract when it exists and is useful.
- Do not require `prd.md` before generating or revising `architecture.md`.
- Use architecture session notes, current discussion, codebase inspection, and focused technical interview questions when PRD context is missing or insufficient.
- Treat `weave-architect` as entering or resuming the architecture lane for the active change.
- Treat `architecture.md` as a living technical artifact.
- Create `architecture.md` when it does not exist.
- Revise `architecture.md` in place when it already exists.
- Read enough source code to understand current implementation patterns before proposing design.
- Prefer existing architecture, framework conventions, helpers, data models, and ADRs over new abstractions.
- Make reasonable engineering assumptions for minor gaps and document them in `Assumptions`.
- Put unresolved technical decisions in `Open Technical Questions`.
- Ask product questions only when technical design exposes ambiguity not settled by the PRD.
- Ask focused product or technical questions when available context is too incomplete to support responsible technical design.
- Do not create implementation issues; use `weave-issues` after architecture is ready.
- Do not write or modify source code.

---

# Core Behavior

Interview the user relentlessly about the engineering design until a shared technical understanding is reached.

Ask questions one at a time and wait for the user's response before continuing.

For each blocking architecture question:
- explain why the question matters
- provide a likely/default recommendation
- explain implications of alternative choices
- explicitly offer: "Explain with an example before deciding"

If the user asks for an example or explanation before deciding:
- explain the tradeoff with a concrete example grounded in the PRD and codebase
- restate the original decision question
- wait for the user's decision before continuing

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
No active Weave change found. Run `weave change new` or `weave change switch`, then run `weave-architect` again.
```

After resolving the active change, set local artifact context:

```bash
weave artifact current set architecture --json
```

This writes local Weave session state only. It does not write repo-tracked artifacts and is allowed before technical discussion begins.

Identify the relevant change folder for each relevant workspace folder:

```text
wiki/changes/<change-id>/
```

Do not assume every folder in the workspace is relevant. Use the resolved change status, PRD, and available artifacts to identify which folders apply.

---

# Required Read Order

For each relevant change folder, read files in this order.

## 1. Product and Technical Context

Read when present:

```text
wiki/changes/<change-id>/prd.md
```

If `prd.md` is missing or thin, continue with architecture sessions, current discussion, codebase inspection, and interview questions. Stop only when a missing answer blocks responsible technical design and cannot be represented as an assumption or open question.

## 2. Current Architecture Baseline

Check:

```text
wiki/changes/<change-id>/architecture.md
```

If `architecture.md` exists, read it as the baseline to revise. Preserve still-valid decisions, constraints, risks, and open questions. Do not replace it with a fresh draft unless the user explicitly asks for a rewrite.

If `architecture.md` does not exist, create it from the PRD and technical context.

## 3. Architecture Resume Context

Read relevant session files when present:

```text
wiki/changes/<change-id>/sessions/*-architecture.md
```

Load architecture session files newest-first. Use the latest `## Next Resume Point` to decide whether to continue design, ask a blocking architecture question, or revise a specific architecture section.

Rules:

- Read `architecture.md` before session notes. The live artifact is canonical current truth.
- Use session notes for rationale, unresolved technical questions, user preferences, agent recommendations, risks, and where to resume.
- Use older architecture session files only when needed to understand rationale or unresolved decisions.
- If session notes conflict with `architecture.md`, prefer `architecture.md` unless the latest session records an explicit newer user decision.
- If the user gives an explicit direction, follow it over the stored resume point.

At the start of resumed architecture work, briefly state what was loaded:

```text
Resuming architecture for <change-id>.
Loaded architecture.md and <N> architecture session note(s).
Latest resume point: <summary>
```

If `architecture.md` does not exist, skip architecture session resume and create the initial architecture from PRD and technical context.

## 4. Exploration and Change Metadata

Read when present:

```text
wiki/changes/<change-id>/exploration.md
wiki/changes/<change-id>/status.yml
wiki/changes/<change-id>/decisions.md
wiki/changes/<change-id>/contracts.md
wiki/changes/<change-id>/handoff.md
wiki/changes/<change-id>/implementation.md
wiki/changes/<change-id>/tasks.md
```

Use these as supporting context. If artifacts conflict, prefer `prd.md` for product behavior and the latest explicit decision for technical direction. Record important conflicts in `Assumptions`, `Open Technical Questions`, or `Revision History`.

## 5. Knowledge Context

Read Weave knowledge files when present:

```text
wiki/knowledge/index.md
wiki/knowledge/context.md
wiki/knowledge/*/index.md
wiki/knowledge/*/context.md
```

Load only knowledge domains that appear relevant to the change. Use knowledge to align terminology, workflows, permissions, data ownership, integrations, and operational constraints.

## 6. Repo Documentation and ADRs

Inspect existing repo documentation for architecture context:

```text
CONTEXT.md
CONTEXT-MAP.md
README.md
docs/
docs/adr/
adr/
```

Prioritize ADRs and architecture docs when they exist. Record any relevant constraints or decisions that shape the design.

## 7. Source Code

Inspect source code areas needed to understand the current implementation.

Use fast discovery tools first:

```bash
rg --files
rg "<domain-term|route|model|command|component|service>"
```

Read the smallest set of files needed to understand:

- affected systems and ownership boundaries
- entry points, routes, commands, jobs, or UI surfaces
- data models, schemas, migrations, persistence, and integrity rules
- integration points and external dependencies
- authentication, authorization, tenant, or permission patterns
- observability, logging, metrics, tracing, and error handling patterns
- existing tests and test helpers
- deployment, rollout, configuration, or migration constraints

Do not design from the PRD alone when code context is available.

---

# Question Rules

Ask technical questions only when the answer affects:

- architecture or ownership boundaries
- implementation risk or delivery sequencing
- operational guarantees, reliability, recovery, or observability
- security, privacy, permissions, or compliance
- scalability, performance, concurrency, or cost
- data integrity, migration, retention, or backward compatibility
- integration contracts or API compatibility

Ask product questions only when the technical design exposes product ambiguity not settled by `prd.md`.

If a question blocks responsible design, ask it before writing or revising `architecture.md`. If it does not block initial design, proceed and record it under `Open Technical Questions`.

---

# Create Or Revise

## When `architecture.md` Is Missing

Create a complete engineering design from the PRD and technical context.

Start the file with artifact frontmatter:

```yaml
---
artifact: architecture
status: draft
owner: engineering
created_at: <YYYY-MM-DDTHH:mm:ss.sssZ>
updated_at: <YYYY-MM-DDTHH:mm:ss.sssZ>
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md
---
```

Use UTC ISO timestamps for `created_at` and `updated_at`.

Add `Revision History` with an initial entry:

```md
## Revision History

- <YYYY-MM-DD>: Initial architecture generated from `prd.md` and codebase review.
```

## When `architecture.md` Exists

Revise the existing architecture in place.

Follow these rules:

- Preserve still-valid existing content.
- Preserve existing artifact lifecycle frontmatter unless the user explicitly asks to change review or approval metadata.
- If the existing architecture has no frontmatter, add compatible `artifact: architecture` frontmatter without removing existing content.
- Update decisions, technical approach, tradeoffs, risk areas, rollout notes, observability, and testing strategy as needed.
- If a technical decision changed, keep the current decision in the relevant section and summarize the superseded decision in `Revision History` or `Rejected Alternatives`.
- If the PRD changed in ways that invalidate the design, update the design and call out affected systems and risks.
- If the latest PRD appears to describe a substantially different change than the existing architecture, stop and say:

```text
The PRD appears to describe a different change than the existing architecture. Create a new Weave change, or explicitly confirm that this architecture should be repurposed.
```

Add a dated `Revision History` entry summarizing the update. Keep entries concise and engineer-facing.

---

# Synthesis Rules

Create an architecture document that can stand alone without the conversation history.

The document should help engineers implement the change, reviewers evaluate it, and operators understand rollout risk.

When writing:

- Separate product facts from technical assumptions.
- Tie the design back to PRD goals and requirements.
- Describe the current system before proposing changes.
- Identify affected systems, modules, data stores, interfaces, and jobs.
- Explain important architecture decisions and rejected alternatives.
- Include constraints and tradeoffs, not just the chosen approach.
- Describe data flow and state transitions when relevant.
- Include rollout, migration, backward compatibility, and rollback implications.
- Include observability, error handling, and operational failure modes.
- Include a testing strategy across unit, integration, end-to-end, migration, and manual verification as appropriate.
- Avoid speculative systems not required by the PRD or codebase.
- Avoid issue-sized task breakdowns; leave implementation slicing to `weave-issues`.

---

# Output Path

Write the completed or revised architecture to:

```text
wiki/changes/<change-id>/architecture.md
```

Use Markdown.

Do not write any other files.
Setting local artifact context with `weave artifact current set architecture --json` is allowed because it updates local session state, not repo-tracked change artifacts.

---

# Lifecycle Progress

After successfully writing or revising `architecture.md`, run:

```bash
weave change progress architecture --source prd --source codebase --json
```

Pass only sources that actually informed the architecture. Examples:

```bash
weave change progress architecture --source prd --source codebase --json
weave change progress architecture --source discussion --source codebase --json
```

If lifecycle progress fails, do not rewrite `architecture.md` just to recover. Report the progress failure in the completion response so the user can rerun the command or inspect `status.yml`.

---

# Architecture Template

Use this structure.

```md
# <Feature / Change Name> Architecture

## Summary

Summarize the proposed technical approach in a few paragraphs.

Include:
- the product capability from `prd.md`
- the affected systems
- the main implementation strategy
- any major constraints or risks

## PRD Context

Link the design to the product contract.

Include:
- PRD path
- product goals this architecture supports
- product non-goals that affect the design
- product assumptions or ambiguities that matter technically

## Current System

Describe the relevant current implementation.

Include:
- important entry points and ownership boundaries
- existing data models and storage
- existing APIs, commands, jobs, components, or services
- existing integration points
- current observability and test coverage in the touched area

## Proposed Architecture

Describe the target architecture.

Include:
- systems and modules to change
- new or changed responsibilities
- data ownership and lifecycle
- API, command, job, or UI flow changes
- dependency and integration changes
- configuration or environment changes

## Data Flow

Describe request, event, state, or data flow.

Use prose by default. Add a compact diagram only if it clarifies the design.

## Architecture Decisions

List durable technical decisions.

For each decision, include:
- decision
- rationale
- consequences

## Rejected Alternatives

List meaningful alternatives that were considered and rejected.

For each alternative, include:
- alternative
- why it was rejected
- when it might become viable

## Constraints and Tradeoffs

List constraints and explicit tradeoffs.

Cover relevant areas:
- existing framework or repo conventions
- compatibility and migration limits
- security, privacy, and permissions
- performance and scalability
- delivery sequencing
- operational cost or complexity

## Integration Points

Describe internal and external integration surfaces.

Include:
- APIs or contracts
- events, queues, jobs, or schedulers
- third-party services
- file formats or import/export paths
- compatibility expectations

## Rollout and Migration

Describe how the change reaches production.

Include:
- feature flags or config gates
- migration ordering
- backfill or dual-write/read periods
- rollback strategy
- user or operational communication needs

## Observability and Operations

Describe how the change will be operated.

Include:
- logs, metrics, traces, and alerts
- dashboards or health checks
- expected failure modes
- recovery and support workflows

## Testing Strategy

Describe the verification plan.

Include:
- unit tests
- integration tests
- end-to-end or workflow tests
- migration or data integrity tests
- performance, security, or permission tests when relevant
- manual QA or operational verification

## Security and Data Integrity

Describe security, privacy, permission, and data correctness concerns.

Include:
- authorization boundaries
- sensitive data handling
- validation and invariants
- auditability or retention requirements
- abuse or misuse risks

## Implementation Risks

List risks that could affect delivery or correctness.

For each risk, include:
- risk
- impact
- mitigation

## Assumptions

List assumptions made while writing or revising this architecture.

## Open Technical Questions

List unresolved technical questions.

Prefer precise questions with the decision they block.

## Product Questions Raised by Technical Design

List unresolved product questions exposed by the technical design.

Leave this section as `None.` if there are no product questions.

## Revision History

- <YYYY-MM-DD>: Initial architecture generated from `prd.md` and codebase review.
```

---

# Completion Response

After writing or revising the architecture, respond with:

```text
Created architecture: wiki/changes/<change-id>/architecture.md
```

or:

```text
Revised architecture: wiki/changes/<change-id>/architecture.md
```

Then summarize:

- the major technical approach
- key decisions or tradeoffs
- open technical questions
- whether the PRD should be revisited

If multiple relevant folders were processed, list each created or revised architecture separately.
