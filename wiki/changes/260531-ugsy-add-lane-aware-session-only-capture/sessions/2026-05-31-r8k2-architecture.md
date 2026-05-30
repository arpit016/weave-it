# Session Capture: Architecture - 2026-05-31

## Summary

Generated the initial technical architecture for lane-aware session-only capture.

The design keeps capture behavior agent-owned. The compiled CLI already provides active change and artifact context lookup, so the change should be implemented by revising the canonical `weave-capture` skill, installed skill copies, docs, and tests.

## Decisions Made

- Do not add a compiled capture command in v1.
- Reuse existing `weave artifact current --json` behavior for lane resolution.
- Add session-only behavior as a new path inside the `weave-capture` skill.
- Keep bare `weave-capture` as regular artifact-updating capture.
- Keep session-only notes under the same artifact-suffix session filename pattern.
- Use the new sortable timestamp filename convention only for future captures.
- Keep existing session files valid.
- Update canonical skill tests rather than adding source-level capture tests.

## Options Considered

- Skill-only implementation: selected because the agent owns conversation synthesis today.
- Compiled CLI capture command: rejected for v1 because it cannot summarize the current discussion without duplicating agent behavior.
- Separate `weave-session` skill: rejected because the product contract selected `weave-capture session`.
- `-session` filename suffix: rejected because lane-aware artifact suffixes preserve existing resume behavior.

## Rejected Approaches

- Do not create a new session-state schema for session-only notes.
- Do not add new artifact metadata for session-only status.
- Do not migrate existing session filenames.
- Do not alter `weave-next` globs or lane resume globs for v1.

## User Preferences

- Preserve bare `weave-capture` behavior.
- Prefer `weave-capture session` and `weave-capture session prd` over flag-style syntax.
- Keep session-only captures lane-aware.
- Use sortable timestamps for future session filenames.

## Agent Recommendations

- Put session-only mode early in the `weave-capture` workflow so agents do not accidentally enter the artifact-update path.
- Make the completion response explicit when no artifact was updated.
- Update README and opencode command wrapper language so users discover the new syntax.
- Keep tests focused on canonical skill instructions and installed-copy alignment.

## Unresolved Points

None.

## Live Artifact Updates Applied

Created `architecture.md` with the initial engineering design for lane-aware session-only capture.

## Next Resume Point

Implement the architecture by updating the canonical `weave-capture` skill, installed skill copies, opencode wrapper text, README usage docs, and agent skill tests. Then run `npm run test`, `npm run typecheck`, and `npm run build`.
