---
artifact: exploration
status: draft
owner: product
created_at: 2026-05-26
updated_at: 2026-05-28
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Add Weave Next Skill

## Topic

Add weave-next skill

## Current Understanding

`weave-next` should be a read-only advisory skill that helps users understand what to do next in an active Weave change.


- `weave-explore` for exploration
- `weave-prd` for PRD work
- `weave-architect` for architecture
- `weave-issues` for issue breakdown

`weave-next` should orient the user across those lanes. It should inspect the active change, summarize artifact state, surface the current artifact context and latest resume point when available, and recommend the next command.

If the resume-oriented recommendation and forward pipeline step differ, `weave-next` should show both. The resume-oriented path should be primary, and the forward pipeline step should be shown as an alternate when useful.

Example output shape:

```text
Current change has:
- exploration.md: draft
- prd.md: missing
- architecture.md: missing

Recommended next step:
- Run weave-prd

Reason:
- exploration.md has enough product context to generate a PRD.
```

Another expected shape:

```text
Current artifact context: architecture
Latest architecture session says:
- Next resume point: decide CLI/API boundary

Recommended next step:
- Run weave-architect

Alternate pipeline step:
- Run weave-issues after resolving the architecture question.

Optional:
- Run weave-capture when you want to checkpoint this discussion.
```

## Open Questions

- Should `weave-next` support explicit target arguments such as `weave-next prd`, or should v1 only inspect the active change and current artifact context?
- How broad should external issue-reference detection be when deciding whether the issues step is already complete?
- What exact output headings should be standardized so users can scan `weave-next` quickly?

## Decisions

- `weave-next` is advisory only.
- `weave-next` does not invoke or delegate to other skills.
- `weave-next` does not require Plan Mode because it is read-only.
- `weave-next` should use active-change targets, not every repo in the current Weave session.
- `weave-next` should read live artifacts as canonical truth and use sessions as resume/rationale context.
- `weave-next` should use combined readiness signals: artifact existence, substantive content, explicit readiness markers, artifact frontmatter status, unresolved points, latest relevant sessions, and `## Next Resume Point`.
- When resume context and forward progress differ, `weave-next` should show both.
- The primary recommendation should be the resume-oriented path.
- The alternate recommendation should be the next forward pipeline step when useful.
- `weave-capture` remains manual. `weave-next` may mention it only as an optional checkpoint when useful.
- V1 stops at issues. After a populated `tasks.md` or external issue references exist, `weave-next` reports implementation handoff readiness instead of managing coding or review.

## Scenarios

### Scenario: Exploration is ready for PRD

A user has an active change with `exploration.md` populated, while `prd.md` and `architecture.md` are missing. `weave-next` summarizes the artifact state and recommends `weave-prd` when exploration has enough product context.

### Scenario: Current architecture session has an unresolved resume point

A user last worked in the architecture lane. `weave artifact current` points to `architecture`, and the latest `sessions/*-architecture.md` file has a `Next Resume Point` such as "decide CLI/API boundary." `weave-next` recommends `weave-architect` as the primary next step and may show `weave-issues` as an alternate after the architecture question is resolved.

### Scenario: PRD exists but has unresolved product questions

A user has a draft `prd.md` with open questions. `weave-next` summarizes the unresolved PRD work and recommends `weave-prd` or `weave-clarify prd` rather than prematurely recommending architecture.

### Scenario: Architecture is complete enough for issue breakdown

A user has a usable `prd.md` and `architecture.md`, and no `tasks.md` or issue references exist. `weave-next` recommends `weave-issues`.

### Scenario: Issues already exist

A change has a populated `tasks.md` or explicit issue references in the artifacts. `weave-next` reports that implementation handoff is ready and stops; it does not manage coding, review, shipping, or archive workflow in v1.

## Existing Behavior

Current Weave workflow is explicit and lane-oriented:

- `weave-new` starts a change and creates `exploration.md`.
- `weave-explore` enters or resumes exploration.
- `weave-prd` creates or resumes PRD work from exploration.
- `weave-architect` creates or resumes architecture work from the PRD.
- `weave-issues` breaks a PRD, architecture, or implementation plan into issues/tasks.
- `weave-capture` manually checkpoints a discussion into a structured session file and merges durable content into the live artifact.
- `weave-clarify` revises one existing artifact without advancing the workflow.

There is currently no single advisory skill that answers "what should I do next?" across artifact state, current artifact context, and session resume points.

## PRD Readiness

Ready
