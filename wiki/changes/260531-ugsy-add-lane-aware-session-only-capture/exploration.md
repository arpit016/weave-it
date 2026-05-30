# Add Lane Aware Session Only Capture

## Topic

Add lane-aware session-only capture

## Current Understanding

Weave should add an opt-in session-only capture mode to `weave-capture`.

Today, `weave-capture` means two things at once:

- create a structured session note under the active change
- create or update the selected live artifact (`exploration.md`, `prd.md`, or `architecture.md`)

The new behavior should let a user preserve a discussion without promoting anything into a canonical live artifact yet. This is useful when the conversation has useful rationale, options, preferences, or a resume point, but the user is not ready to treat those notes as current product or architecture truth.

The mode should remain active-change scoped. It should not create standalone scratch captures outside a Weave change in v1.

Session-only captures should still be lane-aware. A capture made while working in exploration, PRD, or architecture should keep that lane context, even though it does not create or update the lane's live artifact.

## Open Questions

- Should the final invocation spelling be implemented only as skill-recognized language (`weave-capture session`) or also documented in opencode command wrappers?
- Should the capture skill continue using the existing session filename shape until the skill is revised, or should all future captures immediately move to the sortable timestamp shape?

## Decisions

- Add a new session-only capture mode to `weave-capture`.
- Use `weave-capture session` for context-driven session-only capture.
- Use explicit lane overrides such as `weave-capture session prd` and `weave-capture session architecture`.
- Bare `weave-capture` should keep the existing artifact-updating behavior.
- Session-only capture requires an active Weave change.
- Session-only capture should use the current artifact context when the user does not name a lane.
- If artifact context is missing, stale, or ambiguous, the skill should ask which lane to use before writing.
- Session-only capture should not require the lane's live artifact to exist.
- Session-only capture should not enforce upstream artifact prerequisites.
- Session-only captures are resume context only, not canonical artifact truth.
- Do not add a promotion command in v1.
- A user who later wants to fold a session-only note into the live artifact should resume the lane and use normal artifact-updating `weave-capture`.
- Keep the existing structured session-note sections for session-only notes.
- In session-only notes, `Live Artifact Updates Applied` should explicitly say that no live artifact was updated.
- All future session capture filenames should use a sortable timestamp prefix: `YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md`.
- Existing session files should remain valid and untouched.

## Scenarios

### Scenario: User captures discussion without updating artifacts

A user is discussing product behavior in the exploration lane and wants to preserve the reasoning without changing `exploration.md`.

They run:

```text
weave-capture session
```

The skill resolves the active change and current artifact context. If the context is `exploration`, it writes a lane-aware structured session note under the active change's `sessions/` folder and skips all live artifact updates.

### Scenario: User overrides the lane

A user is in a mixed conversation but wants to capture it as PRD context without relying on the stored artifact context.

They run:

```text
weave-capture session prd
```

The explicit `prd` lane wins for that invocation. The skill writes a PRD-lane session note and does not create or update `prd.md`.

### Scenario: Live artifact does not exist

A user has useful architecture discussion before `architecture.md` exists.

They run:

```text
weave-capture session architecture
```

The skill writes an architecture-lane session note without requiring `architecture.md` or a usable `prd.md`. The note is available for future resume, but it is not treated as canonical architecture truth.

### Scenario: User later wants artifact updates

A user resumes the lane, validates the previously captured session-only context, and then runs bare `weave-capture`.

The skill performs the existing artifact-updating capture behavior: it writes a structured session note and merges durable content into the selected live artifact.

## Existing Behavior

`weave-capture` is an agent skill, not a compiled CLI command that performs the capture itself.

The CLI owns deterministic lookup and routing:

- workspace resolution
- active change lookup
- artifact context lookup
- change folder paths

The skill owns semantic capture work:

- discussion synthesis
- session note writing
- live artifact merge decisions

The current capture skill always targets `exploration`, `prd`, or `architecture`, creates a structured session note, and then creates or updates the selected live artifact when prerequisites allow.

This creates friction when the user wants resumability without artifact promotion.

## PRD Readiness

Ready
