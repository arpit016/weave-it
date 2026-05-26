---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-05-26
updated_at: 2026-05-26
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md
---

# Structured Session Capture For Weave Artifacts Architecture

## Summary

Implement structured session capture by extending Weave's change scaffold, live artifact metadata, skill instructions, and local session state.

The compiled CLI should own deterministic filesystem and session-state plumbing. Agent skills should own discussion synthesis, session-note quality, and live artifact merging.

The central design is a new artifact-context command surface: `weave artifact current`. Workflow skills set the current artifact context, and `weave-capture` reads it to decide which session file to create and which live artifact to update.

## PRD Context

Source PRD: `wiki/changes/260526-pe25-use-capture-skill-for-both-explore/prd.md`

The PRD asks Weave to support resumable discussion across exploration, PRD, and architecture work without turning live artifacts into raw transcripts. Every new change should have a `sessions/` folder, live artifacts should have artifact lifecycle frontmatter, and `weave-capture` should create a structured session record while merging durable content back into the relevant live artifact.

The PRD also requires artifact target inference. Invoking `weave-explore`, `weave-prd`, or `weave-architect` should set a local current artifact context, and `weave-capture` should use that context when the user does not provide an explicit capture target.

## Current System

`weave change new` creates a change directory with `status.yml` and `exploration.md`. It does not create a `sessions/` directory, and generated `exploration.md` has no artifact frontmatter.

Change lifecycle state is stored in `status.yml`. Active change state is stored in local Weave session data through `current_change`.

The existing skill templates own artifact-level behavior:

- `weave-explore` guides exploration discussion.
- `weave-prd` creates or revises `prd.md` from `exploration.md`.
- `weave-architect` creates or revises `architecture.md` from `prd.md`.
- `weave-capture` currently describes capturing discussion into a new change exploration.

There is no standard session-note artifact, no local current artifact context, and no deterministic way for `weave-capture` to know whether the current discussion belongs to exploration, PRD, or architecture.

## Proposed Architecture

### Change Scaffold

Extend change creation so every new change folder includes:

```text
wiki/changes/<change-id>/
  status.yml
  exploration.md
  sessions/
```

`createChange()` should create `sessions/` during the new-change flow. Missing `sessions/` in older changes should be recoverable: capture behavior should create the directory on first use.

### Artifact Frontmatter

Add artifact frontmatter to newly generated live artifacts:

```yaml
artifact: exploration
status: draft
owner: product
created_at: 2026-05-26
updated_at: 2026-05-26
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
```

Artifact values are:

- `exploration`
- `prd`
- `architecture`

Owners should default to:

- `product` for `exploration.md` and `prd.md`
- `engineering` for `architecture.md`

`status.yml` remains the change lifecycle source. Artifact frontmatter is only artifact lifecycle metadata.

Add a small helper for artifact metadata and frontmatter generation so templates and code do not duplicate YAML strings.

### Session State

Extend local session state with optional `current_artifact` data next to `current_change`:

```yaml
current_artifact:
  artifact: prd
  change_id: 260526-pe25-use-capture-skill-for-both-explore
  path: wiki/changes/260526-pe25-use-capture-skill-for-both-explore/prd.md
  updated_at: "2026-05-26T..."
```

Existing session YAML without `current_artifact` remains valid.

The artifact context is local routing state. It is not committed artifact metadata and does not replace either live artifact frontmatter or `status.yml`.

### CLI Surface

Add an `artifact` command group:

```text
weave artifact current [target] [--json]
weave artifact current set <exploration|prd|architecture> [--target <target>] [--json]
weave artifact current clear [--target <target>] [--json]
```

Behavior:

- `current` reads the active artifact context for the resolved workspace target.
- `current set` stores artifact, change id, artifact path, and timestamp for the active change.
- `current clear` removes artifact context without changing `current_change`.
- `--json` returns machine-readable state for skills.
- If no artifact context exists, the JSON result should make that explicit instead of failing as an exceptional condition.

`weave change new` should initialize artifact context to `exploration`.

`weave change switch` should preserve existing artifact context only if it matches the switched change id. If it points to another change, switch should clear it so capture cannot accidentally update the wrong artifact.

### Skill Template Updates

`weave-explore`, `weave-prd`, and `weave-architect` should set current artifact context after resolving the active change:

```text
weave artifact current set exploration --json
weave artifact current set prd --json
weave artifact current set architecture --json
```

`weave-prd` and `weave-architect` should generate live artifacts with artifact frontmatter when the artifact does not already exist. When revising an existing artifact, they should preserve lifecycle fields unless the user explicitly asks to change them.

`weave-capture` should change from "create a new change exploration" to "capture current discussion into the active artifact context." It should:

- accept an explicit target when provided by the user
- otherwise read `weave artifact current --json`
- ask for an explicit target if no valid context exists
- create `sessions/` if missing
- create `sessions/yyyy-mm-dd-<4-char-id>-<artifact>.md`
- write structured notes only, not raw transcript
- merge agreed artifact-relevant content into the selected live artifact
- preserve the live artifact's template shape and lifecycle frontmatter

### Session File Format

Use a deterministic filename shape:

```text
yyyy-mm-dd-<4-char-id>-<artifact>.md
```

The 4-character id should use the existing short-random-id style and retry on collision.

Session files should include structured sections for:

- discussion summary
- decisions made
- options considered
- rejected approaches
- user preferences
- agent recommendations
- unresolved points
- live artifact updates applied
- next resume point

The session file is a continuation aid, not the source of truth. The selected live artifact remains the durable current truth after capture.

## Data Flow

### New Change

1. User starts a change through `weave-new` or `weave change new`.
2. CLI creates `status.yml`, frontmatter-backed `exploration.md`, and `sessions/`.
3. CLI stores active change state in local session data.
4. CLI stores current artifact context as `exploration`.

### Artifact Discussion

1. User invokes `weave-explore`, `weave-prd`, or `weave-architect`.
2. The skill resolves the active change.
3. The skill runs `weave artifact current set <artifact> --json`.
4. The user and agent discuss the artifact.

### Capture

1. User invokes `weave-capture`.
2. If the user supplied a target, the skill uses it.
3. Otherwise the skill reads `weave artifact current --json`.
4. The skill creates the session file under `sessions/`.
5. The skill writes structured notes that preserve rationale without raw transcript content.
6. The skill updates the selected live artifact with durable decisions, constraints, requirements, risks, and open questions.

## Architecture Decisions

### CLI Owns Deterministic State

Filesystem scaffolding, session-state persistence, artifact-context reads, and artifact-context writes should live in the compiled CLI. This keeps routing behavior consistent across Codex, Claude, Cursor, opencode, and future agent integrations.

### Skills Own Synthesis And Merge Quality

The CLI should not attempt to summarize discussion or rewrite product and architecture artifacts. That is agent work. The skill templates should define what to capture, what to omit, and how to preserve artifact structure.

### Artifact Context Is Local Session State

The current artifact context describes where this local interaction is happening. It should not be stored in committed live artifacts because it is not durable product truth.

### `weave artifact current` Is Separate From `weave change`

Artifact context is related to, but distinct from, active change state. A separate command group keeps the command surface explicit and avoids overloading change lifecycle commands.

### Approval Lifecycle Is Metadata-Only In V1

Generate and preserve `reviewed` and `approved` fields, but do not add commands for approval transitions in this change. Approval behavior can be designed later without changing the session-capture foundation.

### Existing Changes Remain Compatible

Do not require a bulk migration. Existing changes without frontmatter or `sessions/` should continue to work. Capture can create `sessions/` lazily, and artifact generators can add frontmatter when creating new artifacts.

## Rejected Alternatives

### Store Raw Transcripts

Rejected for v1. Raw transcript capture differs by agent and provider, can contain noisy or sensitive content, and would make live artifacts harder to review. Structured session notes meet the resumability goal with lower risk.

### Put Current Artifact Context In The Repo

Rejected because the context is local and ephemeral. Committing it would create stale routing state and conflicts across users or agents.

### Make Session Files The Source Of Truth

Rejected because live artifacts should remain the durable product and engineering record. Session files should explain how the team got there and where to resume.

### Infer Capture Target From Filename Presence

Rejected because it is ambiguous after multiple artifacts exist. Explicit local artifact context gives predictable capture behavior.

## Constraints And Tradeoffs

This design introduces one more local session field, so session-state parsing must remain tolerant of older files and unknown fields.

Agent-authored live artifact merges are not perfectly deterministic. The architecture intentionally keeps merge quality in the skill instructions because discussion synthesis depends on conversational context.

Artifact metadata can say `reviewed` or `approved`, but v1 does not define who can set those states or through what command. That keeps this change focused but leaves approval workflow semantics for later.

Existing changes are not fully migrated. This avoids broad churn, but older changes may not have complete artifact frontmatter until an artifact is regenerated or clarified.

## Integration Points

- `src/lib/changes.ts`: create `sessions/`, generate frontmatter-backed `exploration.md`, initialize artifact context when a change is created, and clear stale context when switching changes.
- `src/lib/session-state.ts`: add optional `current_artifact` type and read/write helpers.
- `src/commands/artifact.ts`: implement the new artifact command group.
- `src/cli.ts`: register the artifact command group.
- `templates/skills/weave-explore/SKILL.md`: set artifact context to `exploration`.
- `templates/skills/weave-prd/SKILL.md`: set artifact context to `prd` and require PRD frontmatter.
- `templates/skills/weave-architect/SKILL.md`: set artifact context to `architecture` and require architecture frontmatter.
- `templates/skills/weave-capture/SKILL.md`: implement target inference, structured session capture, and live artifact merge rules.
- `.agents/skills/*` and `.claude/skills/*`: update generated or installed skill copies as needed for the active repo.

## Rollout And Migration

Roll out through template and CLI changes in `weave-it`.

New changes receive `sessions/` and exploration frontmatter immediately.

Existing changes remain valid. When `weave-capture` runs against an older change, it should create `sessions/` if needed. When `weave-prd` or `weave-architect` creates a missing artifact, it should include frontmatter. When revising an older artifact without frontmatter, the skill should add compatible frontmatter only if it can do so without losing existing content.

No ship/archive cleanup is included in v1.

## Observability And Operations

No external telemetry is required.

CLI JSON output should expose enough state for skills and debugging:

- whether a current artifact exists
- artifact name
- change id
- artifact path
- target path
- timestamp
- source of the state, such as local session

Command failures should be actionable. For example, if no active change exists, the CLI should say that a change must be selected before setting artifact context.

## Testing Strategy

Add or update tests for:

- `createChange()` creates `sessions/`.
- `createChange()` writes `exploration.md` with artifact frontmatter.
- `weave artifact current set prd` stores PRD context for the active change.
- `weave artifact current --json` reports artifact, change id, path, target, and source.
- `weave artifact current clear` removes artifact context without changing active change.
- `weave change switch` clears stale artifact context when switching to a different change.
- Existing session state without `current_artifact` still loads and reports active changes correctly.
- `weave-capture` skill template documents target inference, fallback prompting, session file format, structured notes, and live artifact merge rules.
- `weave-prd` and `weave-architect` templates document frontmatter generation for new artifacts.

## Security And Data Integrity

The design avoids raw transcript capture in v1 to reduce accidental storage of sensitive conversation details.

Capture must update only the active change unless the user explicitly provides another target. The stored `change_id` on `current_artifact` prevents stale artifact context from silently routing captures into a previous change.

Session file creation should avoid overwriting existing files by retrying on 4-character id collision.

Live artifact edits should preserve existing lifecycle frontmatter unless the user explicitly asks to update review or approval metadata.

## Implementation Risks

- Skill copies can drift between templates and installed locations if propagation is incomplete.
- Existing artifacts without frontmatter may need careful merge instructions to avoid destructive rewrites.
- Agent-authored session summaries may omit useful context unless the capture template is specific about required sections.
- Artifact context can become stale if skills do not consistently set it when invoked.
- Tests need to cover session-state backward compatibility so older local sessions do not break.

## Assumptions

- V1 does not implement raw transcript capture.
- V1 does not implement reviewed or approved transitions beyond frontmatter fields.
- Session cleanup at ship/archive is a later workflow.
- Existing changes are not bulk migrated.
- Missing `sessions/` directories in old changes are created lazily by capture.
- Only `weave-it` is in implementation scope for this change.

## Open Technical Questions

- Should frontmatter insertion for older existing artifacts be implemented as a shared parser-backed helper, or should v1 leave that as skill-guided editing?
- Should the artifact command group support a non-current change id directly, or should it only operate through the resolved active change in v1?
- Should session filenames use local timezone dates from the workspace environment, or UTC dates for consistency across machines?

## Product Questions Raised By Technical Design

- What exact command or skill should mark an artifact as `reviewed` or `approved`?
- Should approval metadata be edited only by a dedicated approval flow, or can capture update it when the user explicitly approves an artifact?
- Should session cleanup be part of a future ship/archive flow, or a separate cleanup command?
- Should older change folders be migrated later, or is lazy compatibility enough?

## Revision History

- 2026-05-26: Initial architecture from structured session capture PRD and artifact-context design discussion.
