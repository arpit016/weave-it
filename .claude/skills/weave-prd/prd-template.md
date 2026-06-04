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
