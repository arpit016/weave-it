---
artifact: exploration
status: draft
owner: product
created_at: 2026-05-31
updated_at: 2026-05-31
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Promote Pending Session Context Into Artifacts

## Topic

Promote pending session context into artifacts

## Current Understanding

Weave now supports two capture modes:

- bare `weave-capture`, which writes a structured session note and updates the selected live artifact
- `weave-capture session [exploration|prd|architecture]`, which writes only a lane-aware session note and does not update live artifacts

Session-only capture creates a useful continuation record, but it can leave important discoveries, decisions, constraints, and open questions outside the canonical artifact. This creates ambiguity when a user later runs bare `weave-capture`, especially in two cases:

- the live artifact does not exist yet, but one or more session-only notes exist for that lane
- the live artifact exists, but newer session-only notes contain durable context that has not been promoted into the artifact

The desired model is to treat session-only notes as pending context until the live artifact is updated. The live artifact remains canonical current truth, but bare `weave-capture` should use relevant pending session context when creating or updating it.

V1 should not add per-session promotion metadata. Instead, it should use a timestamp cutoff:

- if the target artifact is missing, artifact capture considers all session notes for that lane
- if the target artifact exists, artifact capture considers only lane session notes created after the artifact frontmatter `updated_at`
- once artifact capture updates the artifact's `updated_at`, previously considered session notes naturally fall before the cutoff and are not reconsidered on future captures

The cutoff should use artifact frontmatter `updated_at`, not filesystem mtime. Session creation time should come from the session filename timestamp for new files using `YYYYMMDD-HHMMSS-<id>-<artifact>.md`.

## Open Questions

- How should legacy session filenames without full timestamps be compared against artifact `updated_at`?
- Should downstream lane skills stop when they detect newer pending session context, or only warn?
- How explicit should `weave-next` be when recommending artifact capture because pending session context exists?

## Decisions

- Add the concept of pending session context.
- Session-only notes remain resume context and are not canonical artifact truth.
- Bare `weave-capture` should promote durable pending session context into the selected live artifact.
- If no target artifact exists, bare `weave-capture` should synthesize the artifact from the current discussion plus all relevant session notes for that lane.
- If the target artifact exists, bare `weave-capture` should consider only lane session notes created after the artifact frontmatter `updated_at`.
- Do not add per-session promotion status in v1.
- Use artifact frontmatter `updated_at` as the cutoff source, not filesystem mtime.
- Session notes older than or equal to artifact `updated_at` should not be reconsidered on future bare captures.
- Older session notes remain historical context even after they fall before the cutoff.
- Downstream tools should trust the live artifact, not synthesize directly from pending session notes.
- `weave-next` should surface pending session context and recommend bare `weave-capture` before downstream progress.

## Scenarios

### Scenario: Artifact is missing and session notes exist

A user has five exploration session-only captures but no substantive `exploration.md`.

When the user runs bare `weave-capture` in exploration context, the skill reads all exploration session notes plus the current discussion, extracts durable discoveries, decisions, constraints, rejected approaches, user preferences, unresolved questions, risks, and next-phase context, and creates `exploration.md`.

### Scenario: Artifact exists and newer session notes exist

A user has an `exploration.md` with `updated_at` set to an earlier time. They later create three exploration session-only notes.

When the user runs bare `weave-capture`, the skill reads only exploration session notes created after the artifact `updated_at` cutoff plus the current discussion, then merges durable content into `exploration.md`.

### Scenario: Future capture after promotion

After artifact capture updates `exploration.md`, the previous session notes are now older than the artifact `updated_at`.

A future bare `weave-capture` does not reconsider those older notes. It considers only sessions created after the new artifact update time.

### Scenario: Downstream work has pending upstream context

A user tries to generate a PRD while `exploration.md` exists but newer exploration session notes have not been promoted.

The system should not silently ignore the newer context. It should direct the user to run bare `weave-capture` for exploration first, or at minimum warn that the live exploration may not include pending session context.

## Existing Behavior

The current capture skill distinguishes artifact capture from session-only capture, but artifact capture is specified primarily around the current discussion and the live artifact. It does not clearly require scanning prior session-only notes when creating or updating the live artifact.

Current resume-oriented skills read session notes as continuation context, but live artifacts remain canonical. This means important session-only details can remain outside `exploration.md`, `prd.md`, or `architecture.md` unless the agent manually brings them into the current discussion before artifact capture.

## PRD Readiness

Ready
