---
artifact: prd
status: draft
owner: product
created_at: 2026-05-31
updated_at: 2026-05-31
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Lane-Aware Session-Only Capture PRD

## Problem Statement

Weave users need a way to preserve useful discussion context without always promoting that discussion into canonical artifacts.

Today, `weave-capture` creates a structured session note and then creates or updates the selected live artifact: `exploration.md`, `prd.md`, or `architecture.md`. That works when the discussion contains accepted current truth, but it is too forceful when the user only wants to checkpoint rationale, options, preferences, or a resume point.

This matters because session discussion is often useful before it is ready to become product or architecture truth. Users need resumability without accidental artifact creation, premature artifact updates, or noisy canonical documents.

## Goals

- Add an opt-in session-only capture mode to `weave-capture`.
- Let users preserve discussion context without creating or updating live artifacts.
- Keep session-only captures active-change scoped.
- Keep session-only captures lane-aware across exploration, PRD, and architecture.
- Preserve bare `weave-capture` as the existing artifact-updating behavior.
- Keep session-only notes useful for future resume without treating them as canonical truth.
- Use sortable session filenames for all future captures.

## Non-Goals

- Do not add standalone captures outside an active Weave change in v1.
- Do not make session-only capture the default for bare `weave-capture`.
- Do not add a dedicated promotion command in v1.
- Do not automatically merge prior session-only notes into live artifacts.
- Do not store raw transcripts.
- Do not change artifact approval or review lifecycle semantics.

## Actors

- Weave user discussing a change with an agent.
- Agent following the `weave-capture` skill.
- Future agent resuming a Weave change.
- Product, engineering, or support reader using live artifacts as current truth.

## Current Behavior

`weave-capture` is an agent skill. The CLI provides deterministic context such as workspace, active change, artifact context, and change folder paths. The skill owns discussion synthesis, session-note writing, and live artifact merging.

When a user invokes bare `weave-capture`, the skill resolves an artifact target, writes a structured session note, and creates or updates the selected live artifact when prerequisites allow.

This means users cannot currently ask for a durable session checkpoint without also risking creation or modification of `exploration.md`, `prd.md`, or `architecture.md`.

## Proposed Product Behavior

`weave-capture` should support a new session-only mode:

```text
weave-capture session
weave-capture session exploration
weave-capture session prd
weave-capture session architecture
```

When invoked as `weave-capture session`, the skill should use the current artifact context to resolve the lane. If the current context is valid for the active change, the resolved lane should be `exploration`, `prd`, or `architecture`.

When invoked with an explicit lane, such as `weave-capture session prd`, the explicit lane should win for that invocation.

Session-only capture should create a structured lane-aware session note under the active change's `sessions/` folder and skip all live artifact creation or updates. The note should remain resume context only. It should not become canonical artifact truth unless the user later resumes the lane and uses normal artifact-updating capture.

Bare `weave-capture` should continue to mean regular artifact capture: write a structured session note and merge durable content into the selected live artifact.

All future session captures should use a sortable timestamp filename:

```text
YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md
```

Existing session files should remain valid and untouched.

## User Workflows

### Workflow: User Captures Session Context Without Updating Artifacts

1. User works in a lane such as exploration, PRD, or architecture.
2. The lane skill sets current artifact context.
3. User discusses options, rationale, preferences, or unresolved work.
4. User invokes `weave-capture session`.
5. System resolves the lane from current artifact context.
6. System writes a structured session note under `sessions/`.
7. System does not create or update the lane's live artifact.
8. Completion response reports the session file and makes clear no live artifact was updated.

### Workflow: User Overrides The Lane

1. User has a mixed or ambiguous discussion.
2. User invokes `weave-capture session prd`.
3. System treats `prd` as the lane for this invocation.
4. System writes a PRD-lane session note.
5. System does not create or update `prd.md`.

### Workflow: User Later Promotes Current Truth Through Normal Capture

1. User resumes a lane with the relevant lane skill.
2. Agent reads live artifacts first and uses session notes as resume context.
3. User validates which session-only context should become durable current truth.
4. User invokes bare `weave-capture`.
5. System performs regular artifact-updating capture.

## User Stories

1. As a Weave user, I want to capture a session without updating live artifacts, so that I can preserve useful context before decisions are final.
2. As a Weave user, I want `weave-capture session` to use my current lane, so that I do not need to repeat `exploration`, `prd`, or `architecture` every time.
3. As a Weave user, I want to override the lane explicitly, so that mixed conversations can be filed under the right context.
4. As a future agent, I want session-only notes to remain lane-aware, so that I can resume the correct workflow without treating notes as canonical truth.
5. As a reader of live artifacts, I want session-only capture to skip artifact updates, so that canonical artifacts stay clean.
6. As a user relying on existing behavior, I want bare `weave-capture` to keep updating artifacts, so that existing workflows do not break.
7. As a maintainer, I want future capture filenames to sort chronologically, so that session folders are easier to scan.

## Functional Requirements

- The system should recognize `weave-capture session` as session-only capture.
- The system should recognize `weave-capture session exploration`, `weave-capture session prd`, and `weave-capture session architecture` as explicit lane overrides.
- The system should require an active Weave change before writing a session-only note.
- The system should resolve the lane from current artifact context when the user does not provide an explicit lane.
- The system should ask for a lane before writing when current artifact context is missing, stale, or ambiguous.
- The system should allow session-only capture even when the lane's live artifact does not exist.
- The system should allow session-only capture without enforcing upstream artifact prerequisites.
- The system should create the active change's `sessions/` folder if it is missing.
- The system should write structured session notes without storing raw transcripts.
- The system should keep the existing session-note sections, including `Live Artifact Updates Applied`.
- The system should write `None; session-only capture` or equivalent under `Live Artifact Updates Applied`.
- The system should not create or update `exploration.md`, `prd.md`, or `architecture.md` in session-only mode.
- The system should keep bare `weave-capture` as regular artifact-updating capture.
- The system should use `YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md` for future session capture filenames.
- The system should leave existing session files valid and untouched.
- The system should document the session-only invocation in user-facing skill or command guidance.

## Permissions and Access Control

There are no role-based permissions in v1. Session-only capture uses the same active workspace and active change boundaries as existing Weave skills.

The feature should not add artifact approval, review, or admin controls.

## States and Lifecycle

Session-only notes have no formal approval lifecycle in v1.

They are active continuation aids while the change is active. Future lane skills and `weave-next` may use them for resume context, rationale, user preferences, unresolved points, and next resume points.

Session-only notes are not canonical artifact truth. Live artifacts remain the durable current truth for exploration, PRD, and architecture content.

## Notifications and Visibility

No email, Slack, or third-party notifications are required.

Visibility is file-based:

- Session-only notes appear under `wiki/changes/<change-id>/sessions/`.
- The filename should show the capture time and lane.
- The session note content should make clear that no live artifact was updated.
- The completion response should report the captured session and omit or explicitly negate an updated artifact line.

## Edge Cases

- Active change is missing: stop and ask the user to create or switch to a change.
- Bare `weave-capture session` has no valid artifact context: ask the user which lane to use.
- Stored artifact context points to another change: treat it as invalid and ask for a lane.
- Explicit lane conflicts with stored artifact context: explicit lane wins.
- `sessions/` folder is missing in an older change: create it before writing the session note.
- Lane live artifact is missing: still write the session-only note.
- Upstream prerequisite artifact is missing: still write the session-only note.
- User expects artifact updates from `weave-capture session`: completion response should clearly say no live artifact was updated.
- Existing date-only session files are present: keep reading them as valid historical notes.

## Acceptance Criteria

- [ ] User can invoke `weave-capture session` and get a structured lane-aware session note without any live artifact update.
- [ ] User can invoke `weave-capture session prd` and force the note to be PRD-lane context.
- [ ] Bare `weave-capture` continues to perform regular artifact-updating capture.
- [ ] Session-only capture requires an active change.
- [ ] Session-only capture asks for a lane when no valid lane can be inferred.
- [ ] Session-only capture succeeds when the target live artifact is missing.
- [ ] Session-only capture succeeds when upstream artifact prerequisites are missing.
- [ ] Session-only notes include `Live Artifact Updates Applied` with an explicit no-update statement.
- [ ] Future session filenames use the sortable timestamp format.
- [ ] Existing session files remain valid.
- [ ] User-facing command or skill documentation includes the session-only invocation.

## Rollout Considerations

This should be a backward-compatible skill behavior change.

Existing changes and existing session files should not require migration. Users can continue invoking bare `weave-capture` for regular artifact updates. The new behavior is opt-in through the `session` mode.

Documentation and installed skill copies should be updated together so Codex, Claude, Cursor, and opencode users see the same behavior.

## Analytics and Success Metrics

No automated analytics are required in v1.

Success can be evaluated qualitatively:

- Users can checkpoint exploratory discussions without unwanted artifact edits.
- Future agents can resume from lane-aware session-only notes.
- Existing artifact-updating capture behavior remains predictable.
- Session folders are easier to scan chronologically.

## Revision History

- 2026-05-31: Initial PRD generated from `exploration.md`.

## Assumptions

- Session-only capture behavior can be implemented primarily through skill instructions, because capture synthesis and file writing are agent-owned today.
- User-facing wrappers can pass invocation context such as `session prd` through to the skill.
- `weave-next` and lane resume skills may read session-only notes as resume context without needing a separate note type.

## Open Questions

None.

## Out of Scope

- Standalone captures outside active changes.
- A dedicated `weave-session` skill.
- A promotion command for prior session-only notes.
- Automatic promotion of session-only notes into live artifacts.
- Raw transcript storage.
- Artifact review or approval lifecycle changes.

## Further Notes

This PRD intentionally separates the product behavior from implementation mechanics. The architecture should decide whether filename generation and mode parsing remain purely skill-guided or need additional deterministic helper support.
