---
artifact: prd
status: draft
owner: product
created_at: 2026-05-31
updated_at: 2026-05-31T06:37:10.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Promote Pending Session Context Into Artifacts PRD

## Problem Statement

Weave users can capture discussion in two ways today: bare `weave-capture` updates the selected live artifact, while `weave-capture session` writes a lane-aware session note without updating any live artifact.

Session-only capture is useful when a discussion should be preserved before it becomes canonical. The problem is that those saved notes can later contain durable decisions, discoveries, constraints, user preferences, or open questions that are not reflected in `exploration.md`, `prd.md`, or `architecture.md`.

This creates uncertainty when a user later runs bare `weave-capture`:

- if the live artifact is missing, it is unclear whether prior session-only notes should be used to create it
- if the live artifact exists, it is unclear which session-only notes are newer than the artifact and should be considered

The result is a risk that important captured context is preserved historically but not promoted into the canonical artifact when the user intentionally runs artifact-updating capture.

## Goals

- Define session-only notes as pending context until the relevant live artifact is updated.
- Make bare `weave-capture` promote durable pending session context into the selected live artifact.
- Use a simple timestamp cutoff to avoid repeatedly reconsidering old session notes.
- Keep live artifacts as the canonical source of current truth.
- Use precise timestamp metadata for reliable pending-context comparisons.
- Avoid adding per-session promotion metadata in v1.

## Non-Goals

- Do not add a new compiled capture command in v1.
- Do not add per-session promotion status or a promotion database in v1.
- Do not make downstream skills synthesize directly from unpromoted session-only notes.
- Do not add downstream pending-session scans, hard stops, or warnings to `weave-prd`, `weave-architect`, `weave-issues`, or `weave-next` in v1.
- Do not store raw transcripts.
- Do not change review or approval lifecycle metadata.

## Actors

- Weave user: captures discussion, resumes lane work, and moves a change through exploration, PRD, architecture, and issues.
- Agent using Weave skills: reads artifacts and session notes, updates artifacts, and recommends next steps.

## Current Behavior

Bare `weave-capture` writes a structured session note and merges durable content into the selected live artifact.

`weave-capture session [exploration|prd|architecture]` writes only a lane-aware session note. It does not create or update `exploration.md`, `prd.md`, or `architecture.md`.

The current capture skill treats session files as continuation aids and live artifacts as durable truth. It does not clearly require artifact capture to scan previous session-only notes when creating or updating a live artifact.

Resume-oriented skills read session notes for context, rationale, unresolved points, and resume points. However, downstream skills still treat live artifacts as canonical. This means important session-only details can remain outside canonical artifacts unless they are manually brought into the current discussion before artifact capture.

## Proposed Product Behavior

Weave should introduce the concept of pending session context.

A lane session note is pending context when it may contain durable lane context that is not yet reflected in the lane's live artifact. Pending context is not canonical. It becomes canonical only when bare `weave-capture` updates the lane artifact.

Bare `weave-capture` should use this cutoff rule:

- If the target artifact is missing, consider all session notes for that lane.
- If the target artifact exists, consider only lane session notes created after the artifact frontmatter `updated_at`.
- After artifact capture updates the artifact's `updated_at`, previously considered session notes naturally fall before the cutoff and should not be reconsidered on future bare captures.

New artifact timestamps should use ISO values for `created_at` and `updated_at`, such as `2026-05-31T06:10:52.622Z`, so same-day session captures can be compared reliably.

New session notes should keep filesystem-safe sortable filenames such as:

```text
20260531-113741-k8p3-exploration.md
```

New session notes should also include frontmatter with exact capture metadata:

```yaml
artifact: exploration
capture_mode: session-only
captured_at: 2026-05-31T06:07:41.000Z
```

Regular artifact-capture session notes should use `capture_mode: artifact`.

Artifact capture should promote only durable content:

- discoveries
- explicit decisions
- accepted constraints
- rejected approaches
- user preferences
- unresolved questions
- risks and edge cases
- next-phase context

Live artifacts remain canonical. Downstream pending-session checks are intentionally out of scope for v1 to avoid repeated token-heavy audits in every lane skill.

## User Workflows

### Workflow: User Creates Artifact From Prior Session Notes

1. User discusses exploration behavior across several sessions.
2. User runs `weave-capture session exploration` after each session.
3. No substantive `exploration.md` exists yet.
4. User runs bare `weave-capture` in exploration context.
5. System considers all exploration session notes plus the current discussion.
6. System creates `exploration.md` from durable pending context.
7. System updates the artifact `updated_at`.

### Workflow: User Updates Existing Artifact From Newer Session Notes

1. User has an existing `exploration.md`.
2. User later captures several exploration session-only notes.
3. User runs bare `weave-capture`.
4. System considers only exploration session notes created after `exploration.md` frontmatter `updated_at`.
5. System merges durable content into `exploration.md`.
6. System updates `exploration.md` frontmatter `updated_at`.
7. Future bare captures ignore the older session notes because they now fall before the cutoff.

### Workflow: User Keeps Session-Only Context Out Of Artifacts

1. User captures discussion with `weave-capture session`.
2. System writes a session note with `capture_mode: session-only`.
3. System does not update the live artifact.
4. Downstream skills continue to use canonical live artifacts and do not audit pending sessions in v1.
5. If the user wants the session-only context promoted, they run bare `weave-capture` in the relevant lane.

## User Stories

1. As a Weave user, I want prior session-only notes to be considered when creating a missing artifact, so that durable context is not lost outside the canonical workflow.
2. As a Weave user, I want existing artifacts updated only from newer session notes, so that old historical notes are not repeatedly reconsidered.
3. As a Weave user, I want live artifacts to remain canonical, so that downstream work has a clear source of truth.
4. As a Weave user, I want session notes to carry exact capture metadata, so that pending-session comparisons can be reliable.
5. As a maintainer, I want to avoid per-session promotion status and downstream audits in v1, so that the workflow stays simple and avoids unnecessary token use.

## Functional Requirements

- The system should define session-only notes as pending context until the relevant live artifact is updated.
- Bare `weave-capture` should consider all lane session notes when the selected live artifact is missing.
- Bare `weave-capture` should consider only lane session notes newer than artifact frontmatter `updated_at` when the selected live artifact exists.
- Bare `weave-capture` should use artifact frontmatter `updated_at` as the cutoff source, not filesystem mtime.
- New live artifact frontmatter should use ISO timestamps for `created_at` and `updated_at`.
- New session notes should keep the filesystem-safe `YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md` filename shape.
- New session notes should include frontmatter with `artifact`, `capture_mode`, and ISO `captured_at`.
- Bare `weave-capture` should use session `captured_at` as the preferred session creation time.
- Bare `weave-capture` should fall back to the filename timestamp when `captured_at` is absent.
- Bare `weave-capture` should promote only artifact-relevant durable context.
- Bare `weave-capture` should preserve live artifact structure and lifecycle frontmatter.
- Session-only capture should continue to avoid creating or updating live artifacts.
- The system should not add per-session promotion status in v1.
- Downstream lane skills should not scan for or block on pending upstream session context in v1.
- `weave-next` should not scan for or recommend based on pending session context in v1.
- Existing session files should remain valid historical notes.

## Permissions and Access Control

No role-based permissions are required in v1.

The behavior uses the same active workspace, active change, and artifact-context boundaries as existing Weave skills.

## States and Lifecycle

Session notes have two product states in v1:

- historical resume context: a structured note preserved under `sessions/`
- pending context: a session note that may contain durable lane context newer than the lane artifact cutoff

These states are derived from artifact existence and timestamp comparison. They are not stored as metadata on each session note.

Live artifacts remain the canonical lifecycle artifacts:

- `exploration.md`
- `prd.md`
- `architecture.md`

Artifact capture promotes pending session context into the selected live artifact and updates the artifact timestamp. Once updated, previously considered session notes no longer count as pending by the cutoff rule.

`capture_mode` records how a session note was created, but it is not a promotion status. The system should not mutate old session notes to mark them promoted, superseded, rejected, or ignored.

## Notifications and Visibility

No external notifications are required.

Visibility is file- and command-output based:

- `weave-capture` should describe that pending session context was considered when updating an artifact.
- Session note frontmatter should make capture mode and capture time visible to agents and reviewers.

## Edge Cases

- Target artifact is missing and no lane session notes exist: create from the current discussion when enough durable content exists.
- Target artifact is missing and lane session notes exist: consider all lane session notes.
- Target artifact exists and no newer lane session notes exist: proceed from the artifact and current discussion.
- Target artifact exists and newer lane session notes exist: consider only notes newer than artifact `updated_at`.
- Session note has `captured_at`: use it as the session creation time.
- Session note lacks `captured_at` but has a new `YYYYMMDD-HHMMSS` filename: parse the filename timestamp as a fallback.
- Session note has a legacy date-only filename: include it conservatively during bare capture when comparison is ambiguous.
- Existing artifact has date-only `updated_at`: include same-date lane sessions conservatively during bare capture.
- Session note conflicts with the live artifact: prefer the live artifact unless the newer session note records an explicit newer user decision; unresolved conflicts should become open questions.
- Artifact frontmatter lacks `updated_at`: treat the cutoff as unavailable and handle conservatively.
- Filesystem mtime differs from artifact frontmatter: ignore filesystem mtime for product freshness.

## Acceptance Criteria

- [ ] Bare `weave-capture` considers all lane session notes when creating a missing artifact.
- [ ] Bare `weave-capture` considers only lane session notes newer than artifact `updated_at` when updating an existing artifact.
- [ ] Bare `weave-capture` does not repeatedly reconsider session notes older than or equal to artifact `updated_at`.
- [ ] Session-only capture still does not create or update live artifacts.
- [ ] Artifact freshness is based on artifact frontmatter `updated_at`, not filesystem mtime.
- [ ] New artifact frontmatter uses ISO `created_at` and `updated_at` values.
- [ ] New session notes include `artifact`, `capture_mode`, and ISO `captured_at` frontmatter.
- [ ] New timestamped session filenames can be used as a fallback session creation time.
- [ ] Downstream lane skills do not add pending-session scans or hard stops in v1.
- [ ] Existing session files remain valid historical notes.

## Rollout Considerations

This should be a backward-compatible skill behavior update.

Existing session files should not require migration. Existing artifacts should remain valid. The new behavior should be documented in skill instructions and README usage guidance so users understand the difference between session-only capture and artifact promotion.

Existing date-only artifact timestamps remain valid. New artifact writes should use ISO timestamps going forward. Legacy session notes without precise timestamps should be handled conservatively during bare capture.

Installed skill copies for supported agents should stay aligned with canonical templates.

## Analytics and Success Metrics

No automated analytics are required in v1.

Success can be evaluated qualitatively:

- users can create artifacts from prior session-only notes without losing durable context
- users can update artifacts from only newer session notes without repeatedly reprocessing old notes
- session notes and artifacts have precise metadata for cutoff comparison
- downstream lane skills avoid extra token-heavy pending-session audits

## Revision History

- 2026-05-31: Initial PRD generated from `exploration.md`.
- 2026-05-31: Revised to use ISO metadata and keep downstream pending-session guardrails out of v1.

## Assumptions

- Capture remains agent-owned in v1.
- Artifact frontmatter `updated_at` is reliably updated when Weave-managed artifact writes occur.
- New session filenames include a sortable timestamp prefix and session frontmatter includes ISO `captured_at`.
- Pending session context detection can be implemented through skill instructions unless deterministic helper support is needed later.
- Avoiding downstream pending-session scans is more important for v1 than automatically detecting every unpromoted session before later lane work.

## Open Questions

None.

## Out of Scope

- A dedicated promotion command.
- Per-session promotion metadata.
- Downstream pending-session scans, hard stops, or warnings.
- `weave-next` pending-session recommendations.
- Automatic migration of legacy session filenames.
- Raw transcript storage.
- Artifact approval or review lifecycle changes.
- Standalone captures outside active Weave changes.

## Further Notes

This PRD intentionally keeps the v1 model simple: live artifacts remain canonical, session-only notes remain resumable context, and bare `weave-capture` is the promotion path that makes pending context durable.
