---
artifact: exploration
status: draft
owner: product
created_at: 2026-05-26
updated_at: 2026-05-26
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Structured Session Capture For Weave Artifacts

## Topic

Generalize Weave capture behavior so product and architecture discussions can be saved as structured session records, while the live Weave artifacts remain clean current-state documents.

## Current Understanding

Weave should keep the existing change-folder model and add a `sessions/` folder inside each change. The `sessions/` folder should be created whenever a new change is created, alongside `status.yml` and `exploration.md`.

The user wants a way to pause and resume product or architecture discussion across sessions without forcing the raw conversation into the canonical artifacts. The session record should preserve what was discussed and why, but the live artifact should remain the durable source of current truth.

The live artifacts are:

- `exploration.md`
- `prd.md`
- `architecture.md`

Each live artifact should have YAML frontmatter at the top. The frontmatter tracks artifact-level metadata and lifecycle, not the overall change lifecycle. The change-level lifecycle remains in `status.yml`.

Example frontmatter:

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

The `artifact` value should match the file: `exploration`, `prd`, or `architecture`.

The supported artifact statuses for v1 are:

- `draft`
- `reviewed`
- `approved`

Lifecycle fields that do not apply yet should be present as `null`, not omitted or blank.

`weave-capture` should create structured session files under:

```text
wiki/changes/<change-id>/sessions/
  yyyy-mm-dd-<unique-session-id>-exploration.md
  yyyy-mm-dd-<unique-session-id>-prd.md
  yyyy-mm-dd-<unique-session-id>-architecture.md
```

The session file should not be a raw transcript in v1. It should be a structured reconstruction of the session.

Session files should capture:

- what was discussed
- why decisions were made
- options considered
- unresolved points
- user preferences
- agent recommendations
- next resume point

After creating the session file, `weave-capture` should also update the live artifact for that stage by merging only artifact-relevant content.

The live artifact should contain:

- decisions
- clarified requirements
- accepted constraints
- important rejected approaches
- open questions
- next-phase-relevant context

The live artifact should not contain raw transcript content. It should not break the existing template structure. The agent should analyze the latest session and the existing document, then merge or modify the relevant sections based on what was agreed.

Session files are temporary continuation aids. They should be kept while the change is active and can be removed or archived when the feature ships. The permanent record should be the live artifacts, not the session captures.

## Open Questions

- What exact command or skill behavior should mark an artifact as `reviewed` or `approved`?
- Should approval metadata be edited only by a dedicated approval flow, or can `weave-capture` update approval fields when the user explicitly says the artifact is approved?
- How should `weave-capture` determine whether the current stage is exploration, PRD, or architecture when the user does not provide a target?
- What should the unique session id format be?
- Should `sessions/` cleanup be part of a future ship/archive workflow, or should Weave provide a separate cleanup command?
- Should existing change folders be migrated to include `sessions/` and artifact frontmatter, or should this only apply to new changes?

## Decisions

- Target only the `weave-it` repo for this change.
- Keep the existing change folder structure and add a `sessions/` folder inside each change.
- Create the `sessions/` folder whenever a new change is created.
- Add YAML frontmatter to `exploration.md`, `prd.md`, and `architecture.md`.
- Use artifact-level `status` values, not change-level status values.
- Support only `draft`, `reviewed`, and `approved` statuses in v1.
- Use `null` for lifecycle fields that have not happened yet.
- Treat `status.yml` as the change-level lifecycle file.
- Treat live artifacts as the durable current truth.
- Treat session files as temporary continuation aids.
- Do not store raw transcripts in v1 session files.
- Store structured session records instead of raw transcripts.
- `weave-capture` should both create a structured session file and merge artifact-relevant decisions into the live artifact.
- The live artifact must preserve its existing template structure and should be revised in place.
- The live artifact should not be polluted with transcript-style discussion.
- Session files should be kept until ship, then deleted or archived by a future ship/archive flow.

## Scenarios

### Scenario: New change starts with sessions folder

A user runs `weave change new "Structured session capture"`. Weave creates `status.yml`, `exploration.md`, and an empty `sessions/` folder under the new change directory.

### Scenario: Product discussion is captured during exploration

A user discusses product behavior in an exploration session and invokes `weave-capture`. Weave creates a structured session file such as:

```text
wiki/changes/<change-id>/sessions/2026-05-26-ab12-exploration.md
```

The session file records what was discussed, decisions, alternatives, unresolved points, user preferences, agent recommendations, and where to resume.

Weave then updates `exploration.md` by merging the agreed decisions, clarified requirements, accepted constraints, open questions, and next-phase context into the existing exploration sections.

### Scenario: PRD discussion is captured

A user discusses PRD content and invokes `weave-capture` in PRD context. Weave creates a structured `sessions/*-prd.md` file and revises `prd.md` in place, preserving the PRD template structure.

The PRD receives only product-facing current truth: requirements, workflows, edge cases, acceptance criteria, assumptions, and open questions. The PRD does not receive the raw discussion transcript.

### Scenario: Architecture discussion is captured

A user discusses technical design and invokes `weave-capture` in architecture context. Weave creates a structured `sessions/*-architecture.md` file and revises `architecture.md` in place, preserving the architecture template structure.

The architecture receives only durable technical content: accepted constraints, architecture decisions, important rejected approaches, risks, open technical questions, and implementation-relevant context.

### Scenario: User resumes in a later session

A user returns later and asks to continue work. The agent reads the live artifact first to understand current truth, then reads relevant session files to recover discussion rationale, unresolved points, user preferences, and the next resume point.

### Scenario: Feature ships

When the feature ships, the live artifacts remain as the durable record. Session files are no longer useful as continuation aids and can be deleted or archived by a future ship/archive workflow.

## Existing Behavior

`weave change new` currently creates a change folder with `status.yml` and `exploration.md`. It does not create a `sessions/` folder.

`exploration.md`, `prd.md`, and `architecture.md` currently do not use standardized artifact frontmatter.

`weave-capture` is currently described as capturing an existing discussion as a new Weave change exploration. It creates a new change and updates the generated `exploration.md` with discussion context.

`weave-prd` generates or revises `prd.md` from `exploration.md`. It treats `prd.md` as a living product artifact and preserves still-valid content when revising.

`weave-architect` generates or revises `architecture.md` from `prd.md` and technical context. It treats `architecture.md` as a living technical artifact and preserves still-valid decisions.

`weave-clarify` updates one existing artifact at a time when scope, requirements, assumptions, or decisions change midstream.

There is currently no standardized session-capture artifact for preserving discussion rationale across sessions without polluting the live artifact.

## PRD Readiness

Ready
