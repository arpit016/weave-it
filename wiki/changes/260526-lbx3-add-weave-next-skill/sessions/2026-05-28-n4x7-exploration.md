# Session Capture: Exploration - 2026-05-28

## Summary

Explored the product behavior for a new `weave-next` skill. The user wants `weave-next` to help users understand what to do next in a Weave change without creating confusion between "continue" and "resume" semantics.

The agreed direction is that `weave-next` should be read-only and advisory. It should summarize the active change state, artifact state, resume context, unresolved work, and the next genuine pipeline step. It should not invoke other skills, advance the workflow, or write artifacts.

## Decisions Made

- `weave-next` should be advisory only.
- `weave-next` should not delegate to or invoke other skills.
- `weave-next` should not require Plan Mode because it is read-only.
- When resume context and forward pipeline state differ, `weave-next` should show both.
- The primary recommendation should be the resume-oriented path.
- The alternate recommendation should be the forward pipeline step when useful.
- Readiness should use combined signals: artifact content, explicit readiness markers, artifact frontmatter status, latest relevant sessions, unresolved questions, and `Next Resume Point`.
- `weave-next` should explain the current artifact state and unresolved work instead of hiding uncertainty.
- The v1 pipeline should stop at issues. After issue breakdown exists, `weave-next` should report implementation handoff readiness rather than manage coding or review.
- `weave-capture` should remain manual. `weave-next` may mention it only as an optional checkpoint when there is useful discussion context to preserve.
- Multi-repo scope should be active-change targets, not every repo in the current Weave session.
- Issue completion can be inferred from a populated `tasks.md` or explicit issue references in artifacts.

## Options Considered

- Advisory-only `weave-next`: selected because it is predictable and safe.
- Delegating to the next skill when clear: rejected for v1 because it risks unexpected artifact changes.
- Asking before delegation: rejected for v1 because it adds friction while still blurring `weave-next` with lane skills.
- Prioritizing forward pipeline state over resume context: not selected because users returning to work often need orientation first.
- Showing only one path: not selected because resume context and forward progress can both be valid.
- Requiring Plan Mode: rejected because `weave-next` is a read-only orientation command.

## Rejected Approaches

- Do not add both `weave-continue` and `weave-resume`; those verbs are too easy to confuse.
- Do not make `weave-next` a Fab-style stage runner.
- Do not have `weave-next` automatically run `weave-capture`.
- Do not extend v1 into implementation, review, or shipping workflow.
- Do not inspect unrelated session repos just because they are present in the Weave workspace.

## User Preferences

- The user wants Weave to be friendlier and more flexible than Fab.
- The user prefers artifact-lane commands (`weave-explore`, `weave-prd`, `weave-architect`) to remain the way users resume work.
- The user wants `weave-next` to explain the current state clearly and recommend the next command.
- The user wants unresolved artifact work to be visible so they can decide whether to resolve it before moving forward.
- The user wants `weave-capture` to stay a deliberate checkpoint action.

## Agent Recommendations

- Implement `weave-next` as a bundled Agent Skill, not a compiled CLI command.
- Add an opencode command wrapper so `/weave-next` works alongside other opencode commands.
- Add README documentation and installation/listing tests.
- Keep output compact and structured: current change, artifact states, resume point, primary recommendation, alternate pipeline step, and optional capture reminder.
- Treat live artifacts as canonical and sessions as resume/rationale context.

## Unresolved Points

- Exact wording and formatting of the `weave-next` output should be finalized during PRD or implementation.
- Whether `weave-next` should support explicit target arguments such as `weave-next prd` remains undecided.
- The exact heuristic for identifying external issue references can be refined during architecture or implementation.

## Live Artifact Updates Applied

- Updated `exploration.md` with current understanding, decisions, scenarios, existing behavior, and PRD readiness.
- Marked the exploration as ready for PRD generation because the main product behavior and boundaries are settled.

## Next Resume Point

Generate the PRD for `weave-next`. Focus on the user-facing contract: advisory-only behavior, resume-first recommendation, alternate forward pipeline guidance, read-only operation, active-change target scope, and stopping at issues for v1.
