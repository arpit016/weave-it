# Update Skill And Knowledge Contracts

## Outcome

Bundled skill templates, template checks, and current-state knowledge docs describe the new branch-derived active-change and explicit capture-target model. No shipped skill instructs agents to call removed artifact-lane commands.

## User flow

1. User invokes design-discussion skills without hidden lane commits.
2. User persists discussions with explicit capture targets such as `weave-capture architecture`.
3. `weave-next` orients from active change artifacts, status, stale flags, and session notes.
4. Knowledge docs match implemented CLI and skill behavior.

## In scope

- Update bundled `templates/skills/*` contracts.
- Update `src/lib/skill-template-checks.ts` if expected shared blocks change.
- Update tests that assert skill template content.
- Update knowledge docs that currently describe session-backed active changes or artifact current commands.

## Out of scope

- Implementing active-change resolver internals.
- Removing the artifact command implementation.
- Updating locally modified installed skills unless explicitly included by the implementation task.

## Acceptance criteria

- [ ] No bundled skill template calls `weave artifact current`.
- [ ] `weave-capture` requires explicit target or asks before writing.
- [ ] `weave-architect`, `weave-explore`, and `weave-prd` no longer commit local artifact lane state.
- [ ] Knowledge docs reflect git-required change creation and branch-derived active change.
