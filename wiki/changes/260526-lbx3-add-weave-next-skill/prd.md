---
artifact: prd
status: draft
owner: product
created_at: 2026-05-28
updated_at: 2026-05-28
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Add Weave Next Skill PRD

## Problem Statement

Weave users can work across multiple artifact lanes: exploration, PRD, architecture, issues, capture, and clarification. This is flexible, but it leaves users without a simple answer to "what should I do next?" when they return to an active change.

Today, users must infer the next step by inspecting files, remembering the lane they were in, checking session notes, and knowing the intended Weave pipeline. That gets harder as changes span multiple days and session captures. It is especially confusing because "continue" and "resume" sound similar, while Weave intentionally separates forward progress from artifact-lane resumption.

The product needs a friendly orientation skill that explains the current change state and recommends the next command without taking over the workflow or mutating artifacts.

## Goals

- Add a `weave-next` skill that answers what the user should do next for the active Weave change.
- Keep `weave-next` read-only and advisory.
- Summarize current artifact state in a concise, scannable form.
- Surface current artifact context and latest session resume points when relevant.
- Recommend a primary next command and, when useful, an alternate forward pipeline step.
- Preserve the distinction between lane resumption and pipeline advancement.
- Stop v1 guidance at issue breakdown and implementation handoff readiness.
- Keep `weave-capture` as a manual checkpoint action.

## Non-Goals

- Do not add `weave-continue` or `weave-resume` as part of this change.
- Do not make `weave-next` run or delegate to other skills.
- Do not make `weave-next` create, revise, capture, approve, or advance artifacts.
- Do not manage code implementation, review, shipping, or archiving in v1.
- Do not replace `weave-explore`, `weave-prd`, `weave-architect`, `weave-issues`, `weave-capture`, or `weave-clarify`.
- Do not require Plan Mode for `weave-next`.

## Actors

- Developer or product user returning to a Weave change.
- Agent using Weave artifacts and sessions to orient the user.
- Future implementer using the recommendation to choose the correct Weave skill.

## Current Behavior

Weave currently provides explicit lane-oriented skills:

- `weave-new` starts a change and creates `exploration.md`.
- `weave-explore` enters or resumes exploration.
- `weave-prd` creates or resumes PRD work.
- `weave-architect` creates or resumes architecture work.
- `weave-issues` breaks planning artifacts into issues or tasks.
- `weave-capture` manually checkpoints a discussion into a structured session note.
- `weave-clarify` revises one existing artifact without advancing the workflow.

Weave also stores active change state and current artifact context through local session state. Session notes can preserve a `Next Resume Point`. However, there is no bundled skill that combines these signals and tells the user the next sensible command.

## Proposed Product Behavior

`weave-next` should be a read-only advisory skill. When invoked, it should inspect the active Weave change and provide a concise orientation:

- current change identity and branch health
- artifact state summary
- current artifact context, when valid
- latest relevant session resume point, when present
- unresolved artifact work that may need attention
- primary recommended next command
- alternate forward pipeline command when different from the resume recommendation
- optional `weave-capture` reminder only when there is useful discussion context to checkpoint

When resume context and forward pipeline progress point to different commands, `weave-next` should show both. The resume-oriented path should be primary because users returning to work usually need to pick up the current lane before advancing. The forward pipeline step should be shown as an alternate when useful.

Example:

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

Example with resume context:

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

## User Workflows

### Workflow: User asks what to do next after exploration

1. User invokes `weave-next`.
2. System reads the active change.
3. System sees `exploration.md` is substantive and `prd.md` is missing.
4. System summarizes artifact state.
5. System recommends `weave-prd`.

### Workflow: User returns to architecture discussion

1. User invokes `weave-next`.
2. System reads current artifact context.
3. System sees context is `architecture`.
4. System reads latest architecture session note.
5. System reports the latest resume point.
6. System recommends `weave-architect` as primary.
7. System shows `weave-issues` as an alternate only if architecture appears otherwise ready for issue breakdown.

### Workflow: User has unresolved PRD questions

1. User invokes `weave-next`.
2. System reads `prd.md`.
3. System sees open product questions or unresolved session context.
4. System explains the unresolved PRD work.
5. System recommends `weave-prd` or `weave-clarify prd` rather than prematurely recommending architecture as the primary step.

### Workflow: User has architecture ready for issues

1. User invokes `weave-next`.
2. System sees usable `prd.md` and `architecture.md`.
3. System sees no populated `tasks.md` or issue references.
4. System recommends `weave-issues`.

### Workflow: User has issues ready

1. User invokes `weave-next`.
2. System detects a populated `tasks.md` or issue references.
3. System reports that implementation handoff is ready.
4. System does not manage coding, review, shipping, or archive workflow.

## User Stories

1. As a developer returning to a Weave change, I want a single orientation command, so that I know what to run next.
2. As a product user, I want artifact state summarized, so that I can understand whether exploration, PRD, architecture, or issues are missing or draft.
3. As a user resuming a multi-day discussion, I want the latest resume point surfaced, so that I can continue without rereading every session note.
4. As a user, I want `weave-next` to show unresolved artifact work, so that I do not accidentally advance with incomplete requirements or design.
5. As a user, I want a primary recommendation and alternate pipeline step when both are relevant, so that I can choose between resuming and moving forward.
6. As a user, I want `weave-next` to be read-only, so that asking for guidance does not unexpectedly edit files.
7. As an agent, I want `weave-next` to use active-change targets only, so that unrelated session repos do not create noisy recommendations.
8. As a user, I want `weave-next` to stop at implementation handoff readiness, so that Weave does not pretend to own coding or review workflow in v1.

## Functional Requirements

- The system should provide a bundled `weave-next` skill.
- The system should let supported agents invoke `weave-next` the same way they invoke other Weave skills.
- The system should not require Plan Mode to run `weave-next`.
- The system should resolve the active Weave change before making a recommendation.
- The system should report when no active change exists and direct the user to `weave change new` or `weave change switch`.
- The system should inspect only repositories where the active change applies.
- The system should read live artifacts as canonical current truth.
- The system should summarize the state of `exploration.md`, `prd.md`, `architecture.md`, and issue/task evidence when present.
- The system should use current artifact context when it is valid for the active change.
- The system should read latest relevant session notes when they exist.
- The system should surface the latest relevant `Next Resume Point`.
- The system should recommend a resume-oriented primary command when current artifact context has unresolved resume work.
- The system should recommend the next forward pipeline command when prior artifacts are sufficiently usable.
- The system should show both resume and forward recommendations when they differ.
- The system should explain why it recommends the primary command.
- The system should mention `weave-capture` only as an optional checkpoint when there is useful discussion context to preserve.
- The system should treat a populated `tasks.md` or explicit issue references as evidence that issue breakdown has happened.
- The system should report implementation handoff readiness after issue breakdown exists.
- The system should not create, revise, approve, capture, or advance artifacts.
- The system should not invoke `weave-explore`, `weave-prd`, `weave-architect`, `weave-issues`, `weave-capture`, or `weave-clarify`.

## Permissions and Access Control

There are no product roles or admin permissions for v1. `weave-next` is read-only and operates within the resolved workspace and active change context.

## States and Lifecycle

`weave-next` does not create a new lifecycle state. It interprets existing Weave artifact and change state:

- missing artifact
- draft artifact
- reviewed or approved artifact
- artifact with unresolved questions
- artifact with latest resume point
- issues/tasks present
- implementation handoff ready

The pipeline guidance for v1 is:

```text
exploration -> prd -> architecture -> issues -> implementation handoff ready
```

## Notifications and Visibility

No email, Slack, or third-party notifications are required.

Visibility is command output only. The output should be concise and easy to scan, with clear labels for current state, recommendation, reason, alternate next step, and optional capture reminder.

## Edge Cases

- No active change exists: tell the user to create or switch to a change.
- Active change branch does not match current branch: show the mismatch before recommending a next command.
- `exploration.md` is missing or scaffold-only: recommend `weave-explore`.
- `exploration.md` says `PRD Readiness` is `Not ready`: recommend `weave-explore`.
- `prd.md` is missing but exploration is ready: recommend `weave-prd`.
- `prd.md` exists but has open product questions: recommend `weave-prd` or `weave-clarify prd`.
- `architecture.md` is missing but PRD is usable: recommend `weave-architect`.
- `architecture.md` exists but has unresolved technical questions: recommend `weave-architect` or `weave-clarify architecture`.
- Current artifact context points to a different change: ignore it and explain that no valid current artifact context exists.
- Session notes conflict with live artifacts: prefer live artifacts unless the latest session records an explicit newer user decision.
- Multiple session notes exist: prefer the latest relevant note and avoid a full history audit unless needed.
- Multiple repos are in the Weave session: inspect only active-change targets.
- `tasks.md` exists but is empty or scaffold-only: do not treat implementation handoff as ready.

## Acceptance Criteria

- [ ] User can invoke `weave-next` as a bundled Weave skill.
- [ ] `weave-next` is installed for Codex, Cursor, Claude, and opencode through existing agent install flows.
- [ ] opencode receives a `/weave-next` command wrapper.
- [ ] `weave-next` output includes active change identity and branch health.
- [ ] `weave-next` output summarizes exploration, PRD, architecture, and issue/task state.
- [ ] `weave-next` recommends `weave-explore` when exploration is missing or not ready.
- [ ] `weave-next` recommends `weave-prd` when exploration is ready and PRD is missing.
- [ ] `weave-next` recommends `weave-architect` when PRD is usable and architecture is missing or needs resume work.
- [ ] `weave-next` recommends `weave-issues` when architecture is usable and issue breakdown is missing.
- [ ] `weave-next` reports implementation handoff readiness when issue breakdown exists.
- [ ] `weave-next` shows a resume-oriented primary recommendation when current artifact context has a relevant resume point.
- [ ] `weave-next` shows an alternate forward pipeline step when it differs from the resume recommendation.
- [ ] `weave-next` does not write repo-tracked artifacts.
- [ ] `weave-next` does not invoke other Weave skills.
- [ ] README and skill listing documentation include `weave-next`.

## Rollout Considerations

This should roll out as a new bundled skill and opencode command wrapper. Existing workflows remain valid. Users who do not use `weave-next` should see no behavior change.

Installed skill updates should follow the existing Weave agent install/update/reset behavior, including protection for user-modified installed skills.

## Analytics and Success Metrics

No automated analytics are required for v1.

Qualitative success indicators:

- users ask fewer "what command should I run next?" questions
- users can resume multi-day changes more confidently
- fewer cases where users run `weave-prd`, `weave-architect`, or `weave-issues` before the prior artifact is ready
- fewer requests for ambiguous `weave-continue` or `weave-resume` behavior

## Revision History

- 2026-05-28: Initial PRD generated from `exploration.md` and exploration session capture.

## Assumptions

- `weave-next` should be implemented as an Agent Skill rather than a compiled CLI command.
- The active change is the only change `weave-next` should advise on in v1.
- Active-change targets are a better scope than all workspace session folders.
- `tasks.md` is the local artifact that represents issue breakdown when external tracker data is not available.
- Exact output wording can be refined during implementation as long as the required product information is present.

## Open Questions

- Should `weave-next` support explicit target arguments such as `weave-next prd`, or should v1 only inspect the active change and current artifact context?
- How broad should external issue-reference detection be when deciding whether the issues step has already happened?
- What exact output headings should be standardized for the most readable `weave-next` response?

## Out of Scope

- Automatic artifact mutation.
- Automatic capture.
- New compiled CLI command behavior.
- Implementation execution, code review, shipping, and archive guidance.
- Cross-repo propagation behavior beyond active-change target inspection.
- Approval workflow changes for artifact frontmatter.

## Further Notes

`weave-next` should reinforce the product model that Weave is artifact-first. Lane skills remain the way users do work; `weave-next` explains which lane or handoff point is most appropriate next.
