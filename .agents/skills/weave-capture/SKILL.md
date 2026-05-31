---
name: weave-capture
description: Capture the current discussion into the active Weave change artifact and a structured session note. Use when a discussion should update exploration.md, prd.md, or architecture.md under wiki/changes.
---

# Purpose

Capture the current discussion into the active Weave change artifact context.

Use this when the user wants to preserve discussion rationale, decisions, options considered, unresolved points, user preferences, agent recommendations, and the next resume point without storing a raw transcript.

The session file is a continuation aid. The selected live artifact remains the durable current truth.

# Workflow

1. Run:

```bash
weave workspace --json
weave change current --json
```

2. Resolve the capture target.

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

3. Identify the active change folder:

```text
wiki/changes/<change-id>/
```

4. Ensure the sessions folder exists:

```text
wiki/changes/<change-id>/sessions/
```

If it is missing in an older change, create it before writing the session note.

5. Create a new structured session file:

```text
wiki/changes/<change-id>/sessions/yyyy-mm-dd-<4-char-id>-<artifact>.md
```

Use the local date for `yyyy-mm-dd`. Use a 4-character lowercase alphanumeric id and retry if the filename already exists.

6. Write structured session notes with this shape:

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

7. Create or merge durable content into the selected live artifact:

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
- Do not create `exploration.md`, `prd.md`, or `architecture.md` without a valid active change, valid target context, and required prerequisite artifact.
- Do not store raw transcripts in v1.
- Do not remove existing lifecycle frontmatter.
- Do not modify `status.yml` unless the user explicitly asks for change lifecycle updates.
- Do not update `reviewed_at`, `approved_at`, or `approved_by` unless a future approval flow defines that behavior.
- Keep unresolved choices explicit in the session note and live artifact where relevant.

# Completion Response

Report both outputs:

```text
Captured session: wiki/changes/<change-id>/sessions/<filename>.md
Updated artifact: wiki/changes/<change-id>/<artifact-file>.md
```

If the capture wrote new content to the live artifact (or its session note) and the user has not yet shipped this lane, also suggest:

```text
To publish this update, run: weave ship
```

Skip the suggestion when no content was actually written or when the user explicitly asked you not to ship.
