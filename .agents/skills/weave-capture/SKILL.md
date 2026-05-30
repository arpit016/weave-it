---
name: weave-capture
description: Capture the current discussion into a structured session note for a Weave change, optionally updating the active change artifact.
---

# Purpose

Capture the current discussion into the active Weave change context.

Use this when the user wants to preserve discussion rationale, decisions, options considered, unresolved points, user preferences, agent recommendations, and the next resume point without storing a raw transcript.

There are two capture modes:

- Artifact capture: bare `weave-capture` creates a structured session note and updates the selected live artifact.
- Session-only capture: `weave-capture session [exploration|prd|architecture]` creates a lane-aware structured session note and does not create or update any live artifact.

The session file is a continuation aid. Live artifacts remain the durable current truth.

# Workflow

1. Run:

```bash
weave workspace --json
weave change current --json
```

2. Resolve the capture mode and lane.

If the user invoked session-only mode, such as:

```text
weave-capture session
weave-capture session exploration
weave-capture session prd
weave-capture session architecture
```

use session-only behavior for this invocation.

In session-only mode, an explicit lane wins over stored artifact context:

```text
exploration
prd
architecture
```

If the user invoked `weave-capture session` without a lane, run:

```bash
weave artifact current --json
```

Use the current artifact context only when it is valid for the active change.

If no valid lane exists, stop before writing and ask:

```text
Which lane should I capture this session under: exploration, prd, or architecture?
```

If the user did not invoke session-only mode, use artifact capture behavior.

3. For artifact capture, resolve the capture target.

If the user explicitly named an artifact target, use it for this invocation. Supported targets are:

```text
exploration
prd
architecture
```

If the user did not name a target, run:

```bash
weave artifact current --json
```

Use the current artifact context only when it is valid for the active change.

If no valid context exists, stop before writing and ask:

```text
Which artifact should I capture this into: exploration, prd, or architecture?
```

4. Identify the active change folder:

```text
wiki/changes/<change-id>/
```

5. Ensure the sessions folder exists:

```text
wiki/changes/<change-id>/sessions/
```

If it is missing in an older change, create it before writing the session note.

6. Create a new structured session file:

```text
wiki/changes/<change-id>/sessions/YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md
```

Use the local timestamp for `YYYYMMDD-HHMMSS`. Use a 4-character lowercase alphanumeric id and retry if the filename already exists.

Existing session files using `yyyy-mm-dd-<4-char-id>-<artifact>.md` remain valid historical notes.

7. Write structured session notes with this shape:

```md
# Session Capture: <Artifact> - <YYYY-MM-DD>

## Summary

## Decisions Made

## Options Considered

## Rejected Approaches

## User Preferences

## Agent Recommendations

## Unresolved Points

## Live Artifact Updates Applied

## Next Resume Point
```

Do not copy or store the raw transcript. Summarize and structure the discussion.

For session-only capture, write `None; session-only capture` or equivalent under `Live Artifact Updates Applied`.

8. For session-only capture, stop after writing the session note.

Do not create or update:

```text
wiki/changes/<change-id>/exploration.md
wiki/changes/<change-id>/prd.md
wiki/changes/<change-id>/architecture.md
```

Session-only capture is resume context only. It is not canonical artifact truth. It does not require the lane's live artifact to exist and does not require upstream prerequisite artifacts.

9. For artifact capture, create or merge durable content into the selected live artifact:

```text
exploration -> wiki/changes/<change-id>/exploration.md
prd -> wiki/changes/<change-id>/prd.md
architecture -> wiki/changes/<change-id>/architecture.md
```

Only merge artifact-relevant current truth:

- decisions
- clarified requirements
- accepted constraints
- important rejected approaches
- unresolved questions
- risks or edge cases relevant to the artifact
- next-phase-relevant context

When the live artifact already exists, preserve its template structure and lifecycle frontmatter. When the live artifact is missing but allowed by the target rules below, create it with appropriate lifecycle frontmatter and the normal artifact structure for that lane.

Do not add transcript-style discussion to the live artifact.

# Target Rules

## Session-Only Capture

- Session-only mode is selected by invocations like `weave-capture session`, `weave-capture session exploration`, `weave-capture session prd`, or `weave-capture session architecture`.
- Explicit session-only lane wins over stored artifact context for this invocation.
- Supported lanes are `exploration`, `prd`, and `architecture`.
- `weave-capture session` without an explicit lane uses stored artifact context only when it points to the active change.
- If no valid lane exists, ask which lane to use before writing.
- Session-only capture requires a valid active change.
- Session-only capture does not require the selected live artifact to exist.
- Session-only capture does not enforce upstream prerequisite artifacts.
- Session-only capture must not create or update `exploration.md`, `prd.md`, or `architecture.md`.

## Artifact Capture

- An explicit user target wins over stored artifact context for this invocation.
- `weave-explore` maps to `exploration`.
- `weave-prd` maps to `prd`.
- `weave-architect` maps to `architecture`.
- Stored context must point to the active change. If it points elsewhere, treat it as invalid and ask for a target.
- If the selected live artifact does not exist, create it only when the active change, target context, and prerequisite artifact are valid:
  - missing `exploration.md`: create it for the valid active change
  - missing `prd.md`: create it only when a usable `exploration.md` exists
  - missing `architecture.md`: create it only when a usable `prd.md` exists
- Treat a prerequisite artifact as unusable when it is missing, blank or whitespace-only, scaffold-only with headings but no substantive content, or explicitly marked not ready for the next lane.
- If a prerequisite artifact is missing or unusable, stop before writing and ask the user to run the prerequisite lane skill first.

# Missing Artifact Creation

Creating a missing live artifact is allowed only for the selected capture target. The captured discussion supplies the current lane context, and prerequisite artifacts supply the upstream product or technical contract.

- For `exploration.md`, synthesize the artifact from the current discussion and mark unresolved discovery points clearly.
- For `prd.md`, synthesize the artifact from the current discussion plus usable `exploration.md`; do not simulate a full exploration interview inside capture.
- For `architecture.md`, synthesize the artifact from the current discussion plus usable `prd.md`; a just-completed Plan Mode `weave-architect` discussion is valid source material for the first architecture draft.
- If the current discussion does not contain enough durable content for the selected missing artifact, write the session note and stop before creating the live artifact. Tell the user which lane conversation is needed next.

# Behavior Rules

- The CLI owns active change lookup and artifact context lookup.
- The skill owns discussion synthesis, session note writing, and live artifact merging.
- Do not create a new change unless the user explicitly asks for a new change.
- Do not create `exploration.md`, `prd.md`, or `architecture.md` in session-only mode.
- Do not create `exploration.md`, `prd.md`, or `architecture.md` in artifact capture mode without a valid active change, valid target context, and required prerequisite artifact.
- Do not store raw transcripts in v1.
- Do not remove existing lifecycle frontmatter.
- Do not modify `status.yml` unless the user explicitly asks for change lifecycle updates.
- Do not update `reviewed_at`, `approved_at`, or `approved_by` unless a future approval flow defines that behavior.
- Keep unresolved choices explicit in the session note and live artifact where relevant.

# Completion Response

For artifact capture, report both outputs:

```text
Captured session: wiki/changes/<change-id>/sessions/<filename>.md
Updated artifact: wiki/changes/<change-id>/<artifact-file>.md
```

For session-only capture, report the session and explicitly state that no live artifact was updated:

```text
Captured session: wiki/changes/<change-id>/sessions/<filename>.md
Updated artifact: none (session-only capture)
```
