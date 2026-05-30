---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-05-31
updated_at: 2026-05-31
source: architecture.md
---

# Tasks: Lane-Aware Session-Only Capture

## Source Artifacts

- PRD: `wiki/changes/260531-ugsy-add-lane-aware-session-only-capture/prd.md`
- Architecture: `wiki/changes/260531-ugsy-add-lane-aware-session-only-capture/architecture.md`

## Publishing Status

External issue publishing status: not published. GitHub CLI and issue-tracker credentials were unavailable in this environment.

## Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified

## Task Index

| ID | Status | Type | Title | Blocked by |
| --- | --- | --- | --- | --- |
| T1 | done | AFK | Add context-driven `weave-capture session` | None |
| T2 | done | AFK | Add explicit lane overrides for session-only capture | T1 |
| T3 | done | AFK | Switch future capture notes to sortable timestamps | None |
| T4 | done | AFK | Document session-only capture for users and opencode | T1, T2 |

## T1: Add Context-Driven `weave-capture session`

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 1, 2, 4, 5, 6

### What to build

Update the canonical `weave-capture` skill so `weave-capture session` performs a lane-aware session-only capture. The skill should require an active change, resolve the lane from valid current artifact context, write the structured session note, and skip all live artifact creation or updates.

Bare `weave-capture` must continue to perform the existing artifact-updating capture behavior.

### Acceptance Criteria

- [x] `weave-capture session` is documented as session-only capture in the canonical skill.
- [x] Session-only capture requires an active Weave change.
- [x] Session-only capture resolves the lane from valid current artifact context when no explicit lane is provided.
- [x] Session-only capture asks for a lane before writing when current artifact context is missing, stale, or ambiguous.
- [x] Session-only capture creates `sessions/` when it is missing.
- [x] Session-only capture writes the existing structured session-note sections.
- [x] `Live Artifact Updates Applied` explicitly states that no live artifact was updated.
- [x] Session-only capture does not create or update `exploration.md`, `prd.md`, or `architecture.md`.
- [x] Bare `weave-capture` remains documented as regular artifact-updating capture.
- [x] Canonical skill tests cover session-only behavior and preserved regular capture behavior.

## T2: Add Explicit Lane Overrides For Session-Only Capture

Status: done

Type: AFK

Blocked by: T1

User stories covered: 3, 4, 5

### What to build

Extend the session-only capture instructions to support explicit lane overrides:

```text
weave-capture session exploration
weave-capture session prd
weave-capture session architecture
```

The explicit lane should win for that invocation, even when stored artifact context points to a different valid lane. Session-only capture should still avoid live artifact writes and should not require the lane's live artifact or upstream prerequisites to exist.

### Acceptance Criteria

- [x] The canonical skill documents all three explicit lane forms.
- [x] Explicit lane overrides win over stored artifact context for that invocation.
- [x] Session-only capture succeeds when the selected lane's live artifact is missing.
- [x] Session-only capture succeeds when upstream prerequisite artifacts are missing.
- [x] Session-only capture remains lane-aware through the session filename and note content.
- [x] Skill-content tests cover explicit lane examples and precedence over stored context.

## T3: Switch Future Capture Notes To Sortable Timestamps

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 7

### What to build

Update session filename guidance for all future captures from the current date-only shape to a sortable timestamp shape:

```text
YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md
```

This is a forward-only convention change. Existing date-only session files remain valid and should not be renamed or migrated.

### Acceptance Criteria

- [x] The canonical capture skill documents `YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md`.
- [x] The skill still instructs agents to use a 4-character lowercase alphanumeric id.
- [x] The skill still instructs agents to retry on filename collision.
- [x] Existing date-only session files remain valid historical notes.
- [x] Tests no longer expect only `yyyy-mm-dd-<4-char-id>-<artifact>.md`.
- [x] Tests assert the new sortable timestamp format.

## T4: Document Session-Only Capture For Users And Opencode

Status: done

Type: AFK

Blocked by: T1, T2

User stories covered: 2, 3, 6

### What to build

Update user-facing docs and opencode command wrapper text so users can discover both capture modes. The opencode wrapper should continue passing `$ARGUMENTS` through to the skill so `/weave-capture session prd` works through the existing wrapper model.

### Acceptance Criteria

- [x] README skill list describes `weave-capture` as artifact capture plus session-only capture.
- [x] README examples include bare `weave-capture`.
- [x] README examples include `weave-capture session`.
- [x] README examples include an explicit lane example such as `weave-capture session prd`.
- [x] opencode wrapper description reflects current capture behavior accurately.
- [x] opencode wrapper keeps `Context: $ARGUMENTS`.
- [x] Install/update tests are updated if wrapper text changes.
- [x] Repo-installed `.agents` and `.claude` capture skill copies match the canonical template.

## Verification

- [x] `npm run test`
- [x] `npm run typecheck`
- [x] `npm run build`
