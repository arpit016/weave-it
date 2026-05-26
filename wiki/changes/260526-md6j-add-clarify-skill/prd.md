# Add Clarify Skill PRD

## Problem Statement

Weave users and agents need a reliable way to amend existing change artifacts when the underlying product truth changes midstream.

Today, a change can move through exploration, PRD, and architecture, but requirements often continue to evolve. New requirements arrive, old requirements become invalid, scope expands, scope narrows, and assumptions need explicit confirmation. Without a dedicated clarification workflow, users must either manually edit artifacts or rerun generation-oriented skills. Both paths are risky: still-valid context can be overwritten, removed scope can disappear without explanation, and follow-up artifacts can become stale without being called out.

This matters because Weave artifacts are durable planning records. They need to remain accurate as the change evolves, while preserving enough history for Product, Design, Engineering, QA, Support, and future agents to understand why the artifact changed.

## Goals

- Add a `weave-clarify` skill for interactive refinement of existing Weave change artifacts.
- Support clarification of `exploration.md`, `prd.md`, and `architecture.md`.
- Help users update one selected artifact at a time when requirements, scope, assumptions, or decisions change.
- Preserve still-valid content while explicitly recording superseded, removed, or narrowed scope.
- Identify other artifacts that may also be affected without editing them automatically.
- Keep v1 user-invoked and interactive only.

## Non-Goals

- Do not add an internal autonomous clarification mode in v1.
- Do not cascade-write multiple artifacts in a single invocation.
- Do not replace `weave-explore`, `weave-prd`, or `weave-architect`.
- Do not create implementation issues or task breakdowns.
- Do not introduce source-code implementation changes as part of the skill behavior itself.

## Actors

- Developer or product user refining a Weave change.
- Agent using Weave skills to maintain durable change artifacts.
- Readers of Weave artifacts, including Product, Design, Engineering, QA, Support, and future agents.

## Current Behavior

Weave currently provides focused skills for specific artifact workflows:

- `weave-explore` helps refine product requirements and discovery.
- `weave-prd` creates or revises `prd.md` from `exploration.md`.
- `weave-architect` creates or revises `architecture.md` from `prd.md` and technical context.

These skills can create or revise artifacts, but there is no dedicated workflow for midstream clarification across artifact types. When requirements change after an artifact exists, users must choose between rerunning a generation-oriented skill or editing the artifact manually.

Current limitations:

- There is no single skill for clarifying existing artifacts after scope changes.
- Users can silently delete old requirements while editing by hand.
- Scope reductions may not be recorded as non-goals or out-of-scope decisions.
- PRD and architecture artifacts can become stale after exploration or product behavior changes.
- Users may not know which artifact should be clarified first.

## Proposed Product Behavior

`weave-clarify` should be an interactive skill that refines one selected artifact in the active Weave change.

The user should be able to invoke it against `exploration.md`, `prd.md`, or `architecture.md`. The skill should inspect the selected artifact and relevant supporting artifacts, ask clarification questions before writing, then update the selected artifact in place based on the resolved clarification.

If the user does not provide a target artifact, the skill should inspect the active change artifacts, identify which files appear likely to be affected, and ask which single artifact to clarify first.

The skill should not automatically update follow-up artifacts. After the selected artifact is updated, it should report other artifacts that may also need clarification and ask the user to run `weave-clarify` against those files separately.

## User Workflows

### Workflow: User clarifies exploration

1. User invokes `weave-clarify exploration` for the active change.
2. System reads the active change and selected `exploration.md`.
3. System asks focused clarification questions about the changed scope, requirement, assumption, or decision.
4. User answers the questions.
5. System updates `exploration.md` in place.
6. System reports that `prd.md` or `architecture.md` may need follow-up clarification when relevant.

### Workflow: User clarifies PRD

1. User invokes `weave-clarify prd`.
2. System reads `prd.md` as the target artifact and uses `exploration.md` as context.
3. System confirms whether the new input expands, narrows, supersedes, or clarifies product behavior.
4. System updates `prd.md` while preserving still-valid requirements.
5. System records superseded or removed behavior in an appropriate product-facing section.
6. System reports whether `architecture.md` may now be stale.

### Workflow: User clarifies architecture

1. User invokes `weave-clarify architecture`.
2. System reads `architecture.md` as the target artifact and uses `prd.md` plus supporting context.
3. System asks technical clarification questions only when needed to update the architecture responsibly.
4. User answers the questions.
5. System updates `architecture.md` in place.
6. System reports any remaining open technical questions.

### Workflow: User invokes without a target

1. User invokes `weave-clarify` without naming an artifact.
2. System inspects available active change artifacts.
3. System identifies which artifacts are likely affected by the user-provided clarification.
4. System asks the user which single artifact to clarify first.
5. User selects an artifact.
6. System proceeds with the target-specific clarification workflow.

## User Stories

1. As a developer, I want to clarify an existing exploration, so that new scope or changed assumptions are captured before PRD generation.
2. As a product user, I want to clarify a PRD after requirements change, so that the product contract stays accurate.
3. As an engineer, I want to clarify architecture after product behavior changes, so that the technical design does not drift from the PRD.
4. As a user, I want the skill to ask focused questions before writing, so that ambiguous changes are not guessed incorrectly.
5. As a user, I want superseded requirements to remain visible, so that readers understand what changed and why.
6. As a user, I want removed scope to move into non-goals or out-of-scope content where appropriate, so that narrowing decisions are explicit.
7. As a user, I want the skill to update only the selected artifact, so that unrelated artifacts are not changed unexpectedly.
8. As a user, I want the skill to tell me which other artifacts may need follow-up clarification, so that I can keep the change consistent.
9. As an agent, I want a predictable clarification workflow, so that I can maintain Weave artifacts without relying on conversation memory.
10. As a reader, I want clarification history or revision notes, so that I can understand how the artifact evolved.

## Functional Requirements

- The system should provide a skill named `weave-clarify`.
- The user should be able to clarify `exploration.md`, `prd.md`, or `architecture.md`.
- The system should resolve the active Weave change before reading or writing artifacts.
- The system should support an optional target artifact.
- If no target artifact is provided, the system should inspect active change artifacts and ask the user which artifact to clarify first.
- The system should update only one selected artifact per invocation.
- The system should ask clarification questions before writing when the requested change is ambiguous or materially affects scope, behavior, assumptions, or decisions.
- The system should preserve still-valid content in the selected artifact.
- The system should explicitly record superseded requirements, removed scope, narrowed scope, or changed decisions.
- The system should avoid silently deleting prior requirements or decisions.
- The system should use the selected artifact's existing revision-history, open-question, assumption, or audit-trail pattern where available.
- The system should report other artifacts that may be affected by the clarification.
- The system should ask the user to run `weave-clarify` against follow-up artifacts separately instead of editing them automatically.
- The system should stop and ask for confirmation if the new clarification appears to describe a different change than the active change.
- The system should not include an autonomous internal mode in v1.

## Permissions and Access Control

`weave-clarify` should follow the same workspace and filesystem access expectations as the other Weave skills. It can read active change artifacts and relevant context files within the resolved Weave workspace. It should only write the selected target artifact.

There are no separate product roles or admin permissions for v1.

## States and Lifecycle

The skill itself should not advance the change lifecycle or stage.

Relevant artifact outcomes:

- Clarified: the selected artifact was updated based on user-confirmed clarification.
- Deferred: clarification surfaced follow-up questions that remain unresolved.
- Follow-up needed: other artifacts may be stale and should be clarified separately.
- Different change suspected: the skill stops and asks for confirmation before repurposing the active change artifact.

## Notifications and Visibility

The completion response should show:

- the artifact that was updated
- the number or summary of clarifications applied
- remaining open questions, if any
- other artifacts that may need follow-up clarification

No email, Slack, or third-party notifications are required.

## Edge Cases

- Target artifact does not exist: the system should explain which prerequisite skill or artifact is needed.
- No active change exists: the system should tell the user to create or switch to a Weave change.
- No target artifact is provided and multiple artifacts appear affected: the system should ask the user to choose one artifact to clarify first.
- New input contradicts older artifact content: the system should prefer the latest explicit user decision and record the superseded point.
- New input appears to describe a different change: the system should stop and ask for explicit confirmation before repurposing the artifact.
- Scope is narrowed: the system should move removed behavior to non-goals or out-of-scope content where appropriate.
- Architecture may be stale after PRD clarification: the system should report `architecture.md` as a follow-up target, not edit it automatically.
- PRD may be stale after exploration clarification: the system should report `prd.md` as a follow-up target, not edit it automatically.

## Acceptance Criteria

- [ ] User can invoke `weave-clarify` for an active Weave change.
- [ ] User can clarify `exploration.md`.
- [ ] User can clarify `prd.md`.
- [ ] User can clarify `architecture.md`.
- [ ] System asks the user to choose a target when no target artifact is provided.
- [ ] System updates only the selected target artifact.
- [ ] System preserves still-valid content in the selected artifact.
- [ ] System records superseded, removed, or narrowed scope explicitly.
- [ ] System reports potentially affected follow-up artifacts.
- [ ] System does not cascade-write follow-up artifacts.
- [ ] System stops for confirmation when the clarification appears to describe a different change.
- [ ] System does not include autonomous internal mode behavior in v1.

## Rollout Considerations

This should be introduced as a new bundled Weave skill alongside the existing change workflow skills.

Existing users should not need to change their current `weave-explore`, `weave-prd`, or `weave-architect` workflows. The new skill fills the gap between those workflows when existing artifacts need clarification after product truth changes.

Documentation and skill listings should make clear that `weave-clarify` is for refining an existing artifact, not creating a new change or automatically regenerating every downstream artifact.

## Analytics and Success Metrics

Success can be evaluated through:

- adoption of `weave-clarify` after initial artifact creation
- reduction in manual artifact edits for midstream requirement changes
- fewer stale PRD or architecture artifacts after scope changes
- fewer cases where superseded requirements disappear without explanation
- user feedback that artifact clarification feels safer than rerunning generation-oriented skills

## Revision History

- 2026-05-26: Initial PRD generated from `exploration.md`.

## Assumptions

- `weave-clarify` is a skill, not a new CLI command.
- v1 is user-invoked and interactive only.
- `exploration.md`, `prd.md`, and `architecture.md` are the only directly supported target artifacts for v1.
- Follow-up artifacts are reported to the user but not updated automatically.
- Existing artifact-specific revision or audit patterns are sufficient for recording clarification history in v1.

## Open Questions

None at this stage.

## Out of Scope

- Autonomous internal clarification mode.
- Multi-artifact cascade updates.
- Issue or task generation.
- Implementation architecture for the skill.
- New product roles, permissions, or notification channels.

## Further Notes

`weave-clarify` should be positioned as the artifact maintenance workflow for active changes. It helps keep planning artifacts accurate when reality changes, while avoiding broad automatic rewrites that could obscure what changed.
