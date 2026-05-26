---
artifact: prd
status: draft
owner: product
created_at: 2026-05-26
updated_at: 2026-05-26
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Structured Session Capture For Weave Artifacts PRD

## Problem Statement

Weave users and agents need a reliable way to pause and resume product or architecture discussion across sessions without losing the reasoning behind decisions or polluting canonical artifacts with transcript-style content.

Today, Weave has durable change artifacts such as `exploration.md`, `prd.md`, and `architecture.md`, but there is no standard place for structured session notes. When a user discusses product or technical behavior and wants to continue later, the agent must rely on conversation memory, overwrite live artifacts with partially structured notes, or manually summarize the discussion into the artifact. That is risky because live artifacts should remain the durable current truth, while session discussion often contains options, preferences, recommendations, and rationale that are useful for resuming but not appropriate as final product or architecture content.

This matters because Weave planning artifacts are intended to be useful across agents, tools, and future sessions. Users need resumability while the change is active, and they also need clean artifacts once the feature ships.

## Goals

- Add a standard `sessions/` folder to every new Weave change.
- Capture product, PRD, and architecture discussions as structured session records.
- Keep `exploration.md`, `prd.md`, and `architecture.md` as clean live artifacts that represent current truth.
- Add artifact-level frontmatter to live artifacts so their lifecycle can be understood independently from the change lifecycle.
- Let `weave-capture` preserve discussion rationale while also merging agreed, artifact-relevant content into the live artifact.
- Avoid storing raw transcripts in v1.
- Treat session files as temporary continuation aids that can be removed or archived when the feature ships.

## Non-Goals

- Do not store raw session transcripts in v1.
- Do not make session files the permanent source of product or technical truth.
- Do not replace `status.yml` as the change-level lifecycle file.
- Do not add implementation issues or task breakdowns as part of this change.
- Do not require cross-agent transcript extraction from Claude, Codex, Cursor, or opencode in v1.
- Do not define the full ship/archive cleanup workflow in v1.

## Actors

- Developer or product user discussing a Weave change.
- Agent capturing a discussion into durable Weave artifacts.
- Future agent resuming a change from live artifacts and session records.
- Engineering, Product, QA, Support, or other readers using live artifacts after session discussion has been folded in.

## Current Behavior

`weave change new` creates a change folder with `status.yml` and `exploration.md`. It does not create a `sessions/` folder.

`exploration.md`, `prd.md`, and `architecture.md` do not currently use standardized artifact frontmatter.

`weave-capture` is currently described as capturing an existing discussion as a new Weave change exploration. It creates a new change and updates the generated `exploration.md` with discussion context.

`weave-prd` generates or revises `prd.md` from `exploration.md`. `weave-architect` generates or revises `architecture.md` from `prd.md` and technical context. `weave-clarify` updates one existing artifact at a time when requirements, assumptions, or decisions change.

There is no standardized session-capture artifact for preserving discussion rationale across sessions without adding transcript-style content to the live artifact.

## Proposed Product Behavior

Every new Weave change should include a `sessions/` folder:

```text
wiki/changes/<change-id>/
  status.yml
  exploration.md
  sessions/
```

The live artifacts `exploration.md`, `prd.md`, and `architecture.md` should include YAML frontmatter that tracks artifact-level metadata:

```yaml
artifact: prd
status: draft
owner: product
created_at: 2026-05-26
updated_at: 2026-05-26
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
```

The `artifact` value should match the live artifact: `exploration`, `prd`, or `architecture`.

The v1 artifact statuses are:

- `draft`
- `reviewed`
- `approved`

Lifecycle fields that do not apply yet should be present as `null`.

`weave-capture` should create a structured session file under `sessions/` for the relevant artifact context:

```text
wiki/changes/<change-id>/sessions/
  yyyy-mm-dd-<unique-session-id>-exploration.md
  yyyy-mm-dd-<unique-session-id>-prd.md
  yyyy-mm-dd-<unique-session-id>-architecture.md
```

The session file should capture what was discussed, why decisions were made, options considered, unresolved points, user preferences, agent recommendations, and the next resume point.

Weave should also store the current artifact context in the local Weave session when artifact workflow skills are invoked. This context helps `weave-capture` decide which live artifact to update and which session-file target suffix to use.

Artifact context mapping:

- `weave-explore` sets the current artifact context to `exploration`.
- `weave-prd` sets the current artifact context to `prd`.
- `weave-architect` sets the current artifact context to `architecture`.

When `weave-capture` is invoked without an explicit target, it should use the current session's artifact context to decide whether to create an `*-exploration.md`, `*-prd.md`, or `*-architecture.md` session file and which live artifact to merge into.

After creating the session file, `weave-capture` should update the relevant live artifact by merging only artifact-relevant content. The live artifact should contain decisions, clarified requirements, accepted constraints, important rejected approaches, open questions, and next-phase-relevant context. It should not contain raw transcript content and should preserve its template structure.

## User Workflows

### Workflow: User starts a new change

1. User invokes `weave-new` or a CLI-backed new-change flow.
2. System creates the change folder.
3. System writes `status.yml`.
4. System writes `exploration.md` with artifact frontmatter.
5. System creates an empty `sessions/` folder.

### Workflow: User captures exploration discussion

1. User invokes `weave-explore`.
2. System stores the current artifact context as `exploration` in the local Weave session.
3. User discusses product behavior or discovery context.
4. User invokes `weave-capture` without a target.
5. System uses the stored artifact context to select `exploration`.
6. System creates a structured `sessions/*-exploration.md` file.
7. System records discussion rationale, options, unresolved points, user preferences, agent recommendations, and next resume point in the session file.
8. System merges agreed discovery content into `exploration.md`.
9. System keeps raw transcript content out of `exploration.md`.

### Workflow: User captures PRD discussion

1. User invokes `weave-prd`.
2. System stores the current artifact context as `prd` in the local Weave session.
3. User discusses PRD-level behavior, requirements, workflows, or acceptance expectations.
4. User invokes `weave-capture` without a target.
5. System uses the stored artifact context to select `prd`.
6. System creates a structured `sessions/*-prd.md` file.
7. System revises `prd.md` in place, preserving the PRD template structure.
8. System adds only product-facing current truth to `prd.md`.

### Workflow: User captures architecture discussion

1. User invokes `weave-architect`.
2. System stores the current artifact context as `architecture` in the local Weave session.
3. User discusses technical design, constraints, risks, or architecture decisions.
4. User invokes `weave-capture` without a target.
5. System uses the stored artifact context to select `architecture`.
6. System creates a structured `sessions/*-architecture.md` file.
7. System revises `architecture.md` in place, preserving the architecture template structure.
8. System adds durable technical content such as accepted constraints, architecture decisions, important rejected approaches, risks, and open technical questions.

### Workflow: User resumes later

1. User returns in a later session.
2. Agent reads the relevant live artifact first to understand current truth.
3. Agent reads relevant session files to recover discussion rationale, unresolved points, user preferences, and next resume point.
4. Agent continues from the latest captured context without relying on prior conversation memory.

### Workflow: Feature ships

1. The change reaches the ship/archive point.
2. Live artifacts remain as the durable record.
3. Session files can be deleted or archived by a future ship/archive flow because they are no longer needed as continuation aids.

## User Stories

1. As a developer, I want new changes to include a `sessions/` folder, so that discussion captures have a predictable home.
2. As a product user, I want artifact frontmatter on `exploration.md`, `prd.md`, and `architecture.md`, so that I can tell whether each artifact is draft, reviewed, or approved.
3. As a user, I want `weave-capture` to save structured discussion records, so that I can resume later without relying on conversation memory.
4. As a reader, I want live artifacts to stay clean, so that I can use them as current product or architecture truth.
5. As an agent, I want session files to include options considered and user preferences, so that I can preserve rationale without adding noise to the live artifact.
6. As an agent, I want to merge agreed content into the live artifact, so that the current artifact stays up to date after each capture.
7. As an engineer, I want architecture captures to preserve decisions and important rejected approaches, so that implementation planning has the right context.
8. As a future agent, I want a next resume point in each session file, so that I can continue efficiently in another session.
9. As a maintainer, I want session files to be temporary, so that shipped changes do not accumulate stale planning discussion.
10. As a user, I want `weave-capture` to infer the target artifact from the current workflow skill, so that I do not need to repeat whether I am capturing exploration, PRD, or architecture discussion.
11. As an agent, I want the local Weave session to remember the current artifact context, so that capture behavior is consistent across supported agents.

## Functional Requirements

- The system should create `sessions/` whenever a new Weave change is created.
- The system should add artifact frontmatter to newly created `exploration.md`.
- The system should add artifact frontmatter when creating `prd.md`.
- The system should add artifact frontmatter when creating `architecture.md`.
- The system should use `artifact: exploration`, `artifact: prd`, or `artifact: architecture` according to the file.
- The system should support artifact statuses `draft`, `reviewed`, and `approved`.
- The system should use `null` for lifecycle fields that have not happened yet.
- The system should keep change-level lifecycle state in `status.yml`.
- The system should create structured session files under `wiki/changes/<change-id>/sessions/`.
- The system should name session files with the capture date, a unique session id, and the artifact target.
- The system should store current artifact context in the local Weave session when `weave-explore`, `weave-prd`, or `weave-architect` is invoked.
- The system should map `weave-explore` to `exploration`, `weave-prd` to `prd`, and `weave-architect` to `architecture`.
- The system should let `weave-capture` use the local session's current artifact context when no explicit capture target is provided.
- The system should let an explicit capture target override the stored artifact context.
- The system should capture what was discussed, why decisions were made, options considered, unresolved points, user preferences, agent recommendations, and next resume point.
- The system should not store raw transcripts in v1 session files.
- The system should merge artifact-relevant content from a capture into the relevant live artifact.
- The system should preserve the live artifact's existing template structure when merging captured content.
- The system should avoid adding transcript-style discussion to live artifacts.
- The system should keep session files available while the change is active.
- The system should treat session files as removable or archivable after ship.

## Permissions and Access Control

There are no product roles or admin permissions for v1. Weave skills operate within the resolved workspace and active change context.

Artifact approval metadata is product-facing lifecycle metadata. The exact behavior for marking an artifact `reviewed` or `approved` remains an open question.

Current artifact context is local session state, not committed artifact metadata. It should help agents route capture behavior, but it should not replace artifact frontmatter or `status.yml`.

## States and Lifecycle

Artifact lifecycle states:

- `draft`: the artifact is being created or revised and has not been reviewed or approved.
- `reviewed`: the artifact has been reviewed, but approval is not yet recorded.
- `approved`: the artifact has been approved and should represent the accepted current truth for its stage.

Change lifecycle remains separate and continues to live in `status.yml`.

Session files do not have a formal lifecycle in v1. They are active continuation aids until ship, after which they may be deleted or archived.

## Notifications and Visibility

No email, Slack, or third-party notifications are required.

Visibility is file-based:

- Users and agents can see artifact lifecycle metadata in live artifact frontmatter.
- Users and agents can find structured session records under `sessions/`.
- Completion responses should report the live artifact updated and the session file created when capture behavior is used.

## Edge Cases

- Existing changes without `sessions/`: the system should either create `sessions/` when first needed or rely on a future migration decision.
- Existing live artifacts without frontmatter: the system should add frontmatter when the artifact is next created or revised, subject to the migration decision.
- Capture target is unclear: the system should ask for or infer the target before writing a session file.
- Stored artifact context is missing: `weave-capture` should ask for an explicit target before writing.
- Stored artifact context conflicts with an explicit user target: the explicit user target should win for that invocation.
- Stored artifact context points to an artifact that does not exist yet: the system should follow the prerequisite behavior for that artifact instead of creating an invalid live artifact.
- User switches from one workflow skill to another: the latest invoked artifact workflow skill should update the current artifact context.
- Live artifact does not exist: the system should follow the prerequisite behavior for that artifact, such as requiring usable exploration before PRD generation or requiring PRD before architecture generation.
- Captured discussion contains raw transcript-like content: the system should summarize and structure it instead of copying it into the live artifact.
- Captured discussion contradicts the live artifact: the system should prefer latest explicit user decisions, update the live artifact, and preserve the superseded point when important.
- Session files remain after ship: a future cleanup flow should remove or archive them.

## Acceptance Criteria

- [ ] New changes include `status.yml`, `exploration.md`, and `sessions/`.
- [ ] New `exploration.md` files include artifact frontmatter.
- [ ] New `prd.md` files include artifact frontmatter.
- [ ] New `architecture.md` files include artifact frontmatter.
- [ ] Artifact status supports `draft`, `reviewed`, and `approved`.
- [ ] Draft artifacts include null `reviewed_at`, `approved_at`, and `approved_by` fields.
- [ ] `weave-capture` creates a structured session file under `sessions/`.
- [ ] Session file names include date, unique session id, and target artifact.
- [ ] Invoking `weave-explore` stores `exploration` as the current artifact context.
- [ ] Invoking `weave-prd` stores `prd` as the current artifact context.
- [ ] Invoking `weave-architect` stores `architecture` as the current artifact context.
- [ ] `weave-capture` uses the stored artifact context when no target is provided.
- [ ] Explicit capture targets override the stored artifact context.
- [ ] Session files include discussion summary, rationale, options considered, unresolved points, user preferences, agent recommendations, and next resume point.
- [ ] Session files do not require raw transcript extraction.
- [ ] Live artifacts are updated with artifact-relevant content after capture.
- [ ] Live artifacts preserve their existing template structure.
- [ ] Live artifacts do not receive raw transcript content.
- [ ] `status.yml` remains the change-level lifecycle source.

## Rollout Considerations

This should be introduced as an additive change to Weave's existing change workflow.

New changes should receive `sessions/` immediately. Existing changes can continue to work without `sessions/` until migration behavior is decided. Skills that create or revise live artifacts should tolerate missing frontmatter and add the standard frontmatter when appropriate.

The local session format should remain backward compatible. Existing sessions that do not yet store artifact context should continue to work, with `weave-capture` asking for a target when it cannot infer one.

Documentation should explain the difference between live artifacts and session captures:

- live artifacts are durable current truth
- session files are temporary resumability aids

## Analytics and Success Metrics

Success can be evaluated through:

- fewer cases where users need to rely on conversation memory to resume planning
- fewer live artifacts polluted with transcript-style discussion
- successful creation of `sessions/` for new changes
- successful session capture for exploration, PRD, and architecture contexts
- reduced need for users to specify capture targets manually after using `weave-explore`, `weave-prd`, or `weave-architect`
- user feedback that resuming later is easier and canonical artifacts remain cleaner

## Revision History

- 2026-05-26: Initial PRD generated from `exploration.md`.
- 2026-05-26: Clarified that artifact workflow skills should store current artifact context in local session state for `weave-capture` target inference.

## Assumptions

- `sessions/` is created for all new changes, even before any session capture occurs.
- `source` points to the upstream artifact or source context used to produce the live artifact.
- `weave-capture` can identify a target artifact from local session context or be given a target artifact before writing.
- Local session state is an appropriate place for current artifact context because it is user/session-specific routing state, not durable product truth.
- Existing change folders do not need immediate migration for v1 unless a follow-up decision requires it.
- Session cleanup can be defined later as part of ship/archive behavior.

## Open Questions

- What exact command or skill behavior should mark an artifact as `reviewed` or `approved`?
- Should approval metadata be edited only by a dedicated approval flow, or can `weave-capture` update approval fields when the user explicitly says the artifact is approved?
- What should the unique session id format be?
- Should `sessions/` cleanup be part of a future ship/archive workflow, or should Weave provide a separate cleanup command?
- Should existing change folders be migrated to include `sessions/` and artifact frontmatter, or should this only apply to new changes?

## Out of Scope

- Raw transcript storage.
- Cross-agent transcript integrations.
- Full approval workflow design.
- Ship/archive cleanup implementation.
- Implementation architecture.
- Issue or task generation.

## Further Notes

This change introduces a distinction between session records and live artifacts. Session records explain how the team got to a decision and where to resume. Live artifacts state the current decision in a clean, reusable form.
