# Session Capture: Architecture - 2026-05-28

## Summary

Captured the architecture direction for adding `weave-next` as a bundled Agent Skill. The design keeps `weave-next` read-only and advisory, implemented through the existing skill template and install system rather than a new compiled CLI command.

The implementation should add the skill template, opencode wrapper, installed skill copies, README updates, and test coverage. Existing skill discovery should be sufficient once the template directory exists.

## Decisions Made

- Implement `weave-next` as an Agent Skill in `templates/skills/weave-next/SKILL.md`.
- Do not add a new compiled CLI command or library API for `weave-next` in v1.
- Keep `weave-next` read-only: it must not write artifacts, set artifact context, invoke other skills, or require Plan Mode.
- Add an opencode wrapper at `templates/opencode/commands/weave-next.md`.
- Sync installed copies into `.agents/skills/weave-next/SKILL.md` and `.claude/skills/weave-next/SKILL.md`.
- Update README skill lists, examples, and agent install documentation to include `weave-next`.
- Use fixed output headings: `Current Change`, `Artifact State`, `Resume Context`, `Recommended Next Step`, `Alternate Pipeline Step`, `Reason`, and `Optional Checkpoint`.

## Options Considered

- A compiled CLI command was considered but rejected for v1 because existing skill discovery and installation already support bundled skills.
- A lane-specific argument contract such as `weave-next prd` was considered but deferred. Natural-language context can guide the agent, but v1 should not document a formal argument API.
- Broad external issue detection was considered but narrowed to conservative heuristics.

## Rejected Approaches

- Do not have `weave-next` delegate to `weave-prd`, `weave-architect`, `weave-issues`, or other skills.
- Do not make `weave-next` mutate local artifact context.
- Do not require Plan Mode, because the skill is advisory and read-only.

## User Preferences

- The UX should avoid confusing users with overlapping `continue` and `resume` concepts.
- `weave-next` should answer what to do next while preserving explicit lane skills for actual work.

## Agent Recommendations

- Keep v1 small and skill-based.
- Rely on live artifacts first, then session notes for resume context.
- Make the resume-oriented recommendation primary when a valid artifact context has a latest resume point.
- Show the next forward pipeline step separately when it differs from the resume recommendation.
- Mention `weave-capture` only as an optional checkpoint when useful discussion context exists.

## Unresolved Points

- Exact README wording can be finalized during implementation.
- Issue-reference detection should remain conservative unless implementation reveals a need for a stronger parser.

## Live Artifact Updates Applied

- Created `architecture.md` for the active change.
- Captured the `weave-next` technical approach, affected files, behavior rules, testing plan, assumptions, and next resume point.

## Next Resume Point

Implement `weave-next` by adding the new skill template and opencode wrapper, then update README and skill install/list/show tests.
