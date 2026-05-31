# Session Capture: Exploration - 2026-05-31

## Summary

Explored a new opt-in mode for `weave-capture` that preserves discussion context without creating or updating live artifacts.

The user wants a way to capture a session without forcing files such as `exploration.md`, `prd.md`, or `architecture.md` to be created or changed. The agreed direction is an active-change-scoped, lane-aware session-only mode.

## Decisions Made

- Add session-only capture behavior to `weave-capture`.
- Use `weave-capture session` as the context-driven session-only invocation.
- Use explicit lane overrides such as `weave-capture session prd`.
- Keep bare `weave-capture` as the existing artifact-updating behavior.
- Require an active change for v1 session-only capture.
- Use current artifact context to resolve the lane when the user does not name one.
- Ask for a lane only when artifact context is missing, stale, or ambiguous.
- Do not require the lane's live artifact or upstream prerequisites for session-only capture.
- Treat session-only notes as resume context only.
- Do not add a v1 promotion command.
- Keep the existing structured session-note shape.
- Explicitly record that live artifact updates were skipped in session-only notes.
- Use sortable timestamp session filenames for future captures: `YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md`.
- Leave existing session files valid and untouched.

## Options Considered

- Active-change session-only capture: selected because it solves the immediate need while keeping notes discoverable inside the existing Weave change model.
- Change-optional capture outside an active change: considered, but deferred because it would require lifecycle rules for orphan notes and later attachment to a change.
- Local scratch-only capture: considered, but it would be weaker for future agents and team handoff.
- A separate `weave-session` skill: considered, but adding another command would increase discovery cost.
- Flag-style invocation such as `--session-only --target prd`: considered, but heavier than skill-recognized natural command syntax.
- A promotion command for prior session-only notes: considered, but deferred for v1.

## Rejected Approaches

- Do not make session-only capture the default behavior for bare `weave-capture`.
- Do not create standalone v1 captures outside a change.
- Do not treat session-only notes as canonical artifact truth.
- Do not auto-promote prior session-only notes into live artifacts on the next regular capture.
- Do not require `prd.md` or `architecture.md` to exist before writing lane-aware session-only notes.

## User Preferences

- The user wants session-only capture to be lane-aware.
- The user prefers `weave-capture session` over flag-style syntax.
- The user wants explicit lane overrides to read like `weave-capture session prd`.
- The user wants same artifact suffix filenames rather than adding a separate `-session` suffix.
- The user wants timestamps that sort chronologically.

## Agent Recommendations

- Implement this mainly by revising the `weave-capture` skill contract; no compiled CLI capture command is needed for v1.
- Keep CLI responsibilities limited to context lookup and routing.
- Keep skill responsibilities focused on session synthesis and artifact merge behavior.
- Prefer the sortable filename shape for all future captures, not only session-only captures.
- Update tests that assert the canonical capture skill text and installed skill copies.

## Unresolved Points

- Whether opencode command wrappers need explicit examples for `weave-capture session`.
- Whether the new sortable filename convention should be applied immediately in the capture skill update or phased in with compatibility notes.

## Live Artifact Updates Applied

Updated `exploration.md` with the current understanding, decisions, scenarios, existing behavior, and PRD readiness for lane-aware session-only capture.

## Next Resume Point

Generate or revise the PRD for lane-aware session-only capture. Focus on the user-facing contract: active-change scoped session-only capture, lane-aware context resolution, no live artifact/prerequisite requirement, bare `weave-capture` compatibility, sortable session filenames, and resume-only semantics.
