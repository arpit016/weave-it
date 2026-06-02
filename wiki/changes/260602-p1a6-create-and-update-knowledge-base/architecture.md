---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-06-02T12:33:27.000Z
updated_at: 2026-06-02T12:33:27.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md
---

# Create And Update Knowledge Base Architecture

## Summary

This change adds a current-state knowledge workflow to Weave. `wiki/knowledge/**` becomes the durable behavioral spec layer, while `wiki/changes/**` remains historical provenance for how behavior changed over time.

The implementation touches four main surfaces: the init scaffold, change lifecycle status, bundled agent skills, and documentation/tests. The CLI owns knowledge lifecycle metadata through `weave change knowledge <status>`. The `weave-knowledge` skill owns authoring `knowledge-delta.md` and current-state knowledge files.

The design deliberately keeps v1 lightweight. It scaffolds conventions and gives agents a strict contract, but it does not add full folder validation or migrate existing user-authored knowledge.

## PRD Context

PRD: `wiki/changes/260602-p1a6-create-and-update-knowledge-base/prd.md`

The architecture supports these product goals:

- Make `wiki/knowledge/**` the current-state behavioral spec layer.
- Keep `wiki/changes/**` as historical provenance.
- Provide a scalable knowledge folder structure for small and large domains.
- Add a manual `weave-knowledge` workflow.
- Track knowledge freshness in `status.yml`, not `tasks.md`.
- Keep lifecycle status writes CLI-owned.

Product non-goals that shape the design:

- No automatic knowledge update after task completion.
- No full CLI validation for knowledge folder structure in v1.
- No forced migration or reorganization of existing knowledge folders.
- No fake example domains during init.

## Current System

`src/lib/weave-scaffold.ts` currently creates:

```text
wiki/knowledge/index.md
wiki/changes/
.weave/sync.yml
```

Scaffold writes are idempotent and non-overwriting through `writeFileIfMissing`.

`src/lib/changes.ts` owns change metadata, status parsing, lifecycle progress, stale lane calculation, and human-readable change status output. Current lifecycle lanes are `exploration`, `prd`, `architecture`, and `issues`. `progressChange` preserves unknown `status.yml` fields when rewriting lifecycle metadata.

`src/commands/change.ts` exposes `new`, `list`, `current`, `status`, `progress`, `switch`, and `propagate`. There is no knowledge lifecycle command today.

Bundled skills are directory-driven under `templates/skills/**`. Agent install copies them to `.agents/skills/**` or `.claude/skills/**`, and opencode wrappers come from `templates/opencode/commands/**`.

`weave-next` is a read-only skill, not a CLI command. It inspects current change state and recommends the next skill.

## Proposed Architecture

Extend the scaffold to create:

```text
wiki/knowledge/index.md
wiki/knowledge/README.md
wiki/knowledge/domains/README.md
wiki/knowledge/shared/README.md
wiki/knowledge/domains/
wiki/knowledge/shared/
```

The scaffold remains non-overwriting. `.weave/sync.yml` continues to track only `wiki/knowledge/index.md` in v1. README files are guidance documents, not sync-managed knowledge content.

Add knowledge metadata parsing to `src/lib/changes.ts`:

```ts
type KnowledgeStatus = "pending" | "stale" | "updated" | "none";

interface KnowledgeMetadata {
  status: KnowledgeStatus;
  updated_at: string;
  domains: string[];
  shared: string[];
  files: string[];
  delta?: string;
  reason?: string;
  invalidated_by?: KnowledgeInvalidationSource;
  invalidated_at?: string;
}
```

Supported invalidation sources are existing lifecycle lanes and artifact source IDs: `exploration`, `prd`, `architecture`, `issues`, `discussion`, `sessions`, and `codebase`.

Add `knowledge?: KnowledgeMetadata` to `ChangeSummary` and related JSON outputs. Malformed or missing knowledge metadata should parse as absent rather than failing status reads.

Add a `knowledgeChange` operation and expose it as:

```text
weave change knowledge <status>
```

Supported flags:

```text
--target <target>
--domain <domain>
--shared <shared-behavior>
--file <path>
--delta <path>
--reason <text>
--invalidated-by <source>
--json
```

`--domain`, `--shared`, and `--file` are repeatable and deduped.

Command behavior:

- Always update `knowledge.status` and `knowledge.updated_at`.
- Replace `domains`, `shared`, and `files` only when the corresponding flags are provided.
- Set `delta` and `reason` when provided.
- For `stale`, set `invalidated_at` and optional `invalidated_by`.
- For `updated` and `none`, clear `invalidated_by` and `invalidated_at`.
- Never change the lifecycle `stage`.

When `progressChange` runs after knowledge is `updated` or `none`, mark knowledge `stale` with `invalidated_by: <lane>` and the same timestamp. Existing `pending` or `stale` knowledge remains as-is.

Add a bundled `weave-knowledge` skill. The skill should:

- Resolve the active change.
- Read `status.yml`, live artifacts, sessions, tasks when present, relevant knowledge files, and source anchors.
- Create or update `wiki/changes/<change-id>/knowledge-delta.md`.
- Create or update current-state specs under `wiki/knowledge/domains/**` or `wiki/knowledge/shared/**`.
- Create missing standard folders/files as needed.
- Avoid reorganizing existing user-authored knowledge without explicit approval.
- Call `weave change knowledge updated`, `none`, `pending`, or `stale` with the relevant flags.
- Ask for orientation when there is no active change or the target knowledge area is ambiguous.

Update existing skills’ knowledge-read guidance to reference the new structure:

```text
wiki/knowledge/index.md
wiki/knowledge/README.md
wiki/knowledge/domains/**/index.md
wiki/knowledge/domains/**/features/**/behavior.md
wiki/knowledge/domains/**/domain-wide/**
wiki/knowledge/shared/**/behavior.md
wiki/knowledge/**/source-map.md
```

Update `weave-next` to include knowledge freshness in its advisory output and recommend `weave-knowledge` when knowledge is `pending`, `stale`, or effectively stale.

## Data Flow

For normal artifact progress:

1. A skill writes or revises a live change artifact.
2. The skill calls `weave change progress <lane> --source ... --json`.
3. `progressChange` updates lane metadata and stale dependent lanes.
4. If knowledge was previously `updated` or `none`, `progressChange` marks knowledge `stale`.
5. `weave-next` reports stale knowledge and recommends `weave-knowledge`.

For knowledge update:

1. User invokes `weave-knowledge`.
2. The skill reads the active change and relevant knowledge context.
3. The skill writes `knowledge-delta.md`.
4. The skill updates current-state files under `wiki/knowledge/**`, or records a no-impact rationale.
5. The skill calls `weave change knowledge updated` or `weave change knowledge none`.
6. `status.yml.knowledge` records the status, affected areas, files, delta path, and reason.

## Architecture Decisions

- Decision: Track knowledge freshness in `status.yml.knowledge`.
  Rationale: `status.yml` already owns lifecycle state and is written by CLI commands.
  Consequence: Skills do not hand-edit status files and agents can inspect one change-level status source.

- Decision: Keep knowledge out of `changeStages`.
  Rationale: Knowledge is a current-state maintenance concern, not a sequential artifact lane.
  Consequence: Existing stage ordering and stale lane logic remain focused on change artifacts.

- Decision: Scaffold guidance without v1 validation.
  Rationale: The standard structure needs to prove itself in real repositories before warnings become policy.
  Consequence: Tests assert guidance exists, but the CLI does not block unusual knowledge folders.

- Decision: Preserve existing knowledge organization.
  Rationale: Existing repos may already have useful nonstandard docs.
  Consequence: Agents can create missing standard files, but must not reorganize user-authored knowledge without approval.

## Rejected Alternatives

- Full CLI validation in v1.
  Rejected because it creates a policy surface before the workflow has enough real-world usage.

- Store knowledge status in `tasks.md`.
  Rejected because `tasks.md` is an implementation tracking artifact, not lifecycle metadata.

- Automatically run knowledge updates after task completion.
  Rejected because current-state product specs require judgment and source anchoring.

- Add README hashes to `.weave/sync.yml`.
  Rejected for v1 because scaffold README files are guidance and should not expand sync semantics yet.

## Constraints and Tradeoffs

- The implementation must preserve backward compatibility with existing `status.yml` files.
- Unknown status fields must continue to be preserved.
- Skill installation protects user edits, so repo-installed skill copies must be updated deliberately in this repo and covered by tests.
- `weave-next` remains advisory and read-only.
- The knowledge scaffold must not overwrite user-authored files.

## Integration Points

- CLI command: `weave change knowledge <status>`.
- Status file: `wiki/changes/<change-id>/status.yml`.
- Change-local knowledge delta: `wiki/changes/<change-id>/knowledge-delta.md`.
- Current-state knowledge: `wiki/knowledge/**`.
- Skill templates: `templates/skills/**`.
- Installed repo skill copies: `.agents/skills/**` and `.claude/skills/**`.
- opencode wrappers: `templates/opencode/commands/**`.
- README skill and command documentation.

## Rollout and Migration

No data migration is required.

Existing repos gain new scaffold files only when `weave init`, `weave add`, or change creation invokes the scaffold. Because writes are non-overwriting, existing knowledge files are preserved.

Older changes without `status.yml.knowledge` continue to work and are treated as having no recorded knowledge lifecycle state.

Rollback is straightforward: removing the new command and skill leaves existing knowledge files and `status.yml.knowledge` as inert metadata.

## Observability and Operations

No runtime service observability is needed. Operational feedback is through CLI output and JSON:

- `weave change status` should show knowledge status when present.
- `weave change current --json` and `weave change status --json` should include parsed knowledge metadata.
- `weave change knowledge <status> --json` should return the updated change summary.
- Unsupported status or invalidation source errors should use existing `ChangeCommandError` JSON handling.

## Testing Strategy

Unit and integration coverage should include:

- Scaffold creates knowledge folders and README files.
- Scaffold does not overwrite existing knowledge files.
- `weave change knowledge updated` writes metadata and preserves lifecycle stage.
- Repeatable `--domain`, `--shared`, and `--file` flags dedupe and persist.
- `stale` records invalidation metadata.
- `updated` and `none` clear invalidation metadata.
- Artifact progress after resolved knowledge marks knowledge stale.
- Human status output includes knowledge status.
- JSON outputs include knowledge metadata.
- Bundled `weave-knowledge` skill is discoverable and installable.
- opencode wrapper is installed.
- Installed `.agents` and `.claude` skill copies stay aligned with templates.
- README and `skill show` include the new skill.

Final verification:

```bash
npm run typecheck
npm run build
npm run test
```

## Security and Data Integrity

Knowledge files may include product behavior, source anchors, and operational notes. The skill should summarize durable behavior and avoid raw transcript capture.

The CLI should validate status values and invalidation sources before writing. File paths provided through `--file` and `--delta` are metadata references; v1 does not need to enforce path existence, but tests should ensure they are stored as provided.

Status updates must use atomic or existing safe write patterns where practical and must preserve unknown status fields.

## Implementation Risks

- Risk: Knowledge status becomes stale too aggressively.
  Impact: Users may see extra `weave-knowledge` recommendations.
  Mitigation: Only auto-stale when prior knowledge was resolved as `updated` or `none`.

- Risk: Skill guidance becomes too broad for agents to follow.
  Impact: Knowledge files may become inconsistent.
  Mitigation: Contract tests should assert the key folder structure, templates, status command, and no-reorganization rule.

- Risk: Existing skill tests become brittle as another bundled skill is added.
  Impact: Install/list tests may fail in several places.
  Mitigation: Update skill inventory assertions and installed-copy alignment together.

## Assumptions

- `status.yml.knowledge` is lifecycle metadata, not the source of behavioral truth.
- Current behavior lives in `wiki/knowledge/**`.
- Historical rationale lives in `wiki/changes/**`.
- V1 does not need a separate `weave knowledge validate` command.
- `weave-knowledge` is manually invoked by the user.

## Open Technical Questions

None.

## Product Questions Raised by Technical Design

None.

## Revision History

- 2026-06-02: Initial architecture generated from `prd.md`, exploration decisions, codebase review, and architecture discussion.
