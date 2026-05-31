---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-05-31T06:52:00.000Z
updated_at: 2026-05-31T07:29:10.000Z
source: architecture.md
---

# Tasks: Promote Pending Session Context Into Artifacts

## Source Artifacts

- PRD: `wiki/changes/260531-56zg-promote-pending-session-context-into-artifacts/prd.md`
- Architecture: `wiki/changes/260531-56zg-promote-pending-session-context-into-artifacts/architecture.md`

## Publishing Status

External issue publishing status: not published. The user requested local issues in `tasks.md`.

## Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified

## Task Index

| ID | Status | Type | Title | Blocked by |
| --- | --- | --- | --- | --- |
| T1 | done | AFK | Emit ISO timestamps for generated artifact frontmatter | None |
| T2 | done | AFK | Add pending-session promotion rules to capture skill | T1 |
| T3 | done | AFK | Align artifact-writing skills and user docs | T1, T2 |
| T4 | done | AFK | Update tests for metadata and skill contracts | T1, T2, T3 |

## T1: Emit ISO Timestamps For Generated Artifact Frontmatter

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 4, 5

### What to build

Update artifact frontmatter generation so new CLI-created live artifacts use UTC ISO timestamps for `created_at` and `updated_at`.

The change should keep the existing frontmatter fields, preserve the `ArtifactFrontmatterOptions` API shape, and avoid changing `status.yml` lifecycle behavior, which already uses ISO timestamps.

### Acceptance Criteria

- [x] New generated artifact frontmatter uses `Date.toISOString()` values for `created_at` and `updated_at`.
- [x] Existing frontmatter fields remain unchanged apart from timestamp format.
- [x] The `ArtifactFrontmatterOptions` public shape does not change.
- [x] `status.yml` generation and progress timestamps remain unchanged.
- [x] Existing date-only artifacts remain valid; no migration is added.

## T2: Add Pending-Session Promotion Rules To Capture Skill

Status: done

Type: AFK

Blocked by: T1

User stories covered: 1, 2, 3, 4, 5

### What to build

Update the canonical `weave-capture` skill so artifact capture mode reads pending lane session notes before creating or updating the selected live artifact.

For missing artifacts, bare capture should consider all matching lane session notes. For existing artifacts, bare capture should consider matching lane session notes newer than artifact `updated_at`. Session-only capture must remain non-mutating for live artifacts.

New session notes should include YAML frontmatter with `artifact`, `capture_mode`, and ISO `captured_at`, while keeping the `YYYYMMDD-HHMMSS-<4-char-id>-<artifact>.md` filename shape.

### Acceptance Criteria

- [x] Artifact capture documents pending-session promotion before live artifact updates.
- [x] Missing-artifact capture considers all matching lane session notes.
- [x] Existing-artifact capture considers matching lane session notes newer than artifact `updated_at`.
- [x] Capture uses `captured_at` first, timestamped filename second, and conservative inclusion for ambiguous legacy notes.
- [x] Session-only capture still does not create or update `exploration.md`, `prd.md`, or `architecture.md`.
- [x] New session note guidance includes `artifact`, `capture_mode`, and ISO `captured_at`.
- [x] Regular artifact-capture session notes use `capture_mode: artifact`.

## T3: Align Artifact-Writing Skills And User Docs

Status: done

Type: AFK

Blocked by: T1, T2

User stories covered: 3, 4, 5

### What to build

Update user-facing and agent-facing documentation so all artifact-writing workflows describe ISO artifact frontmatter and the capture/promotion model consistently.

This includes canonical templates, installed skill copies, and README guidance. Do not add pending-session scans or hard stops to downstream lane skills or `weave-next` in v1.

### Acceptance Criteria

- [x] `weave-prd`, `weave-architect`, and `weave-clarify` describe ISO `created_at` and `updated_at` frontmatter for new or revised artifacts.
- [x] `weave-capture` describes pending session context as promoted only by bare `weave-capture`.
- [x] README explains session-only capture versus artifact promotion.
- [x] README does not imply downstream skills scan pending session context in v1.
- [x] `.agents` and `.claude` skill copies match canonical templates.
- [x] opencode wrapper behavior remains argument-pass-through compatible.

## T4: Update Tests For Metadata And Skill Contracts

Status: done

Type: AFK

Blocked by: T1, T2, T3

User stories covered: 1, 2, 3, 4, 5

### What to build

Update tests to cover the deterministic metadata change and the revised skill contracts.

The tests should verify generated artifact frontmatter uses ISO timestamps, capture skill instructions include pending-session promotion and session metadata, and installed skill alignment remains intact.

### Acceptance Criteria

- [x] `tests/changes.test.ts` expects ISO `created_at` and `updated_at` in generated artifact frontmatter.
- [x] `tests/agent-skills.test.ts` asserts pending-session promotion rules in `weave-capture`.
- [x] `tests/agent-skills.test.ts` asserts `captured_at`, `capture_mode`, and ISO artifact cutoff guidance.
- [x] Tests assert session-only capture still avoids live artifact updates.
- [x] Tests assert downstream skills do not gain pending-session hard-stop requirements.
- [x] Installed-copy alignment tests still pass.
- [x] `npm run test` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run build` passes.

## Verification

- [x] `npm run test`
- [x] `npm run typecheck`
- [x] `npm run build`
