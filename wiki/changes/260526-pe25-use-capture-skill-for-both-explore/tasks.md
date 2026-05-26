---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-05-26
updated_at: 2026-05-26
source: architecture.md
---

# Tasks: Structured Session Capture For Weave Artifacts

## Source Artifacts

- PRD: `wiki/changes/260526-pe25-use-capture-skill-for-both-explore/prd.md`
- Architecture: `wiki/changes/260526-pe25-use-capture-skill-for-both-explore/architecture.md`

## Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified

## Task Index

| ID | Status | Type | Title | Blocked by |
| --- | --- | --- | --- | --- |
| T1 | done | AFK | Scaffold new changes with sessions and exploration frontmatter | None |
| T2 | done | AFK | Add local artifact context state and CLI commands | None |
| T3 | done | AFK | Wire artifact context into change lifecycle | T1, T2 |
| T4 | done | AFK | Update workflow skills to set artifact context and preserve frontmatter | T2 |
| T5 | done | AFK | Rework weave-capture for structured artifact capture | T2, T3, T4 |
| T6 | done | AFK | Add compatibility and regression coverage | T1, T2, T3, T4, T5 |

## T1: Scaffold New Changes With Sessions And Exploration Frontmatter

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 1, 2

### What to build

Update new-change creation so every new Weave change starts with a `sessions/` directory and an `exploration.md` file that includes artifact lifecycle frontmatter. Keep `status.yml` as the change lifecycle source and make the generated exploration artifact remain usable by existing exploration and PRD flows.

### Acceptance Criteria

- [x] Creating a new change produces `status.yml`, `exploration.md`, and `sessions/`.
- [x] Generated `exploration.md` includes artifact frontmatter with `artifact: exploration`, `status: draft`, product ownership, lifecycle timestamp fields, and `source: discussion`.
- [x] Change-level lifecycle metadata remains in `status.yml`.
- [x] Existing new-change output remains compatible with current CLI JSON and text responses.
- [x] Unit tests cover the new folder and frontmatter behavior.

## T2: Add Local Artifact Context State And CLI Commands

Status: done

Type: AFK

Blocked by: None - can start immediately

User stories covered: 10, 11

### What to build

Add optional current artifact context to local Weave session state and expose it through a new `weave artifact current` command surface. The command should let skills set, read, and clear the current artifact for the active change in machine-readable form.

### Acceptance Criteria

- [x] Local session state supports optional `current_artifact` without breaking existing session files.
- [x] `weave artifact current --json` reports when no current artifact exists.
- [x] `weave artifact current set <exploration|prd|architecture> --json` records artifact name, change id, artifact path, target path, timestamp, and source.
- [x] `weave artifact current clear --json` removes artifact context without changing the active change.
- [x] Invalid artifact names and missing active-change state produce actionable errors.
- [x] Tests cover set, read, clear, invalid input, and backward-compatible session loading.

## T3: Wire Artifact Context Into Change Lifecycle

Status: done

Type: AFK

Blocked by: T1, T2

User stories covered: 1, 10, 11

### What to build

Connect artifact context to existing change lifecycle commands. New changes should initialize the current artifact to exploration. Switching changes should clear stale artifact context unless it already points to the switched change.

### Acceptance Criteria

- [x] New-change creation initializes current artifact context to `exploration`.
- [x] Switching to a different change clears stale artifact context from the previous change.
- [x] Switching to the same change preserves valid artifact context.
- [x] Multi-target change behavior keeps artifact context scoped to the correct target.
- [x] CLI JSON output remains stable enough for skills to consume.
- [x] Tests cover initialization, preservation, stale-context clearing, and multi-target behavior where applicable.

## T4: Update Workflow Skills To Set Artifact Context And Preserve Frontmatter

Status: done

Type: AFK

Blocked by: T2

User stories covered: 2, 10, 11

### What to build

Update the exploration, PRD, and architecture skill templates so they set artifact context after resolving the active change. PRD and architecture generation should create frontmatter-backed artifacts when missing and preserve lifecycle metadata when revising existing artifacts.

### Acceptance Criteria

- [x] `weave-explore` sets artifact context to `exploration`.
- [x] `weave-prd` sets artifact context to `prd`.
- [x] `weave-architect` sets artifact context to `architecture`.
- [x] `weave-prd` creates `prd.md` with artifact frontmatter when missing.
- [x] `weave-architect` creates `architecture.md` with artifact frontmatter when missing.
- [x] Skill instructions preserve existing lifecycle frontmatter unless the user explicitly asks to change it.
- [x] Template tests or skill-content tests verify the new instructions.

## T5: Rework Weave-Capture For Structured Artifact Capture

Status: done

Type: AFK

Blocked by: T2, T3, T4

User stories covered: 3, 4, 5, 6, 7, 8, 10, 11

### What to build

Change `weave-capture` from creating a new exploration change to capturing the current discussion into the active artifact context. Capture should create a structured session record, then merge only durable artifact-relevant content into the selected live artifact.

### Acceptance Criteria

- [x] Capture accepts an explicit target artifact when provided.
- [x] Capture reads `weave artifact current --json` when no explicit target is provided.
- [x] Capture asks for an explicit target before writing if no valid artifact context exists.
- [x] Capture creates `sessions/` on first use when it is missing.
- [x] Capture creates session files using `yyyy-mm-dd-<4-char-id>-<artifact>.md`.
- [x] Session notes include discussion summary, decisions, options considered, rejected approaches, user preferences, agent recommendations, unresolved points, live artifact updates applied, and next resume point.
- [x] Capture does not store raw transcripts in v1.
- [x] Capture updates the selected live artifact while preserving template structure and lifecycle frontmatter.
- [x] Skill-content tests verify target inference, fallback prompting, session file format, structured-note requirements, and live artifact merge rules.

## T6: Add Compatibility And Regression Coverage

Status: done

Type: AFK

Blocked by: T1, T2, T3, T4, T5

User stories covered: 1, 2, 3, 4, 8, 9, 10, 11

### What to build

Add focused regression coverage around old changes, older local session files, and installed skill copies so the new flow can be adopted without breaking existing Weave workspaces.

### Acceptance Criteria

- [x] Existing session files without `current_artifact` still load successfully.
- [x] Existing changes without `sessions/` are treated as recoverable by capture instructions.
- [x] Existing artifacts without frontmatter are handled without destructive rewrites.
- [x] Generated template skill changes are propagated to installed skill copies used by the repo.
- [x] Tests verify the relevant template and installed skill content stays aligned.
- [x] Final verification runs the project test suite or the smallest relevant subset and records the command used.

### Verification

- `npm run typecheck`
- `npm test`
