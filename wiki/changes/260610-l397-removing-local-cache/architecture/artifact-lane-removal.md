---
artifact: architecture
facet: artifact-lane-removal
status: draft
owner: engineering
created_at: 2026-06-10T19:05:20.000Z
updated_at: 2026-06-10T19:05:20.000Z
source: prd.md, codebase, architecture discussion
---

# Artifact Lane Removal

## Current Model

The artifact lane currently has its own persisted local session state:

- `src/lib/session-state.ts` defines `SessionCurrentArtifact` and `SessionFolder.current_artifact`.
- `src/lib/artifact-context.ts` implements `currentArtifact`, `setCurrentArtifact`, and `clearCurrentArtifact`.
- `src/commands/artifact.ts` exposes `weave artifact current`, `weave artifact current set`, and `weave artifact current clear`.
- `src/cli.ts` registers the artifact command.
- Design-discussion skills call `weave artifact current set <lane>` to persist lane-entry state.
- `weave-capture` and `weave-next` read `weave artifact current --json` as a routing signal.

This state is hidden, local, and stale-prone. It is the root of the Plan Mode lane-commit failure class described in the PRD.

## Proposed Model

Remove artifact-lane routing as a CLI concept.

Artifact writes should be routed by explicit user target, for example:

```text
weave-capture prd
weave-capture architecture
weave-capture session prd
```

If the target is missing, the agent asks before writing. No CLI command persists or reports a current artifact lane.

## File-Level Changes

`src/cli.ts`

- Remove the import of `artifactCommand`.
- Remove `program.addCommand(artifactCommand())`.

`src/commands/artifact.ts`

- Delete the file after command registration is removed.

`src/lib/artifact-context.ts`

- Delete the file once no imports remain.
- If deletion creates too much churn in the first pass, leave it temporarily unreachable from the CLI, then remove in the same task after tests are updated.

`src/lib/changes.ts`

- Remove imports of `setCurrentArtifactForPath` and `clearCurrentArtifactForPath` when no longer used.
- Stop setting an artifact on feature `createChange`.
- Stop clearing or preserving artifact context in `switchChange`.
- Remove `activeArtifactForTarget` when unused.

`src/lib/session-state.ts`

- Keep the optional `current_artifact` field for legacy parse tolerance.
- Do not read it for routing.
- Do not write it from any command or skill path.

## Command Surface Contract

The command should be removed, not deprecated. The expected user-visible result is that `weave artifact` is no longer in help and direct invocation fails as an unknown command through Commander.

No compatibility shim should emit warnings because a shim would keep teaching agents and users that artifact lane state exists.

## Skill Contract Impact

All shipped skills and wrappers must stop invoking artifact current commands. This includes templates and installed generated copies where tests assert bundled content.

Primary template references to remove:

- `templates/skills/weave-explore/SKILL.md`: remove `weave artifact current set exploration --json`.
- `templates/skills/weave-prd/SKILL.md`: remove `weave artifact current set prd --json`.
- `templates/skills/weave-architect/SKILL.md`: remove `weave artifact current set architecture --json` and verification with `weave artifact current --json`.
- `templates/skills/weave-capture/SKILL.md`: remove stored artifact context lookup and require explicit target or ask.
- `templates/skills/weave-next/SKILL.md`: remove `weave artifact current --json` and orient from `status.yml`, artifacts, stale flags, and sessions.

## Compatibility

- Old session files may still contain `current_artifact`; the field is inert.
- Existing architecture folder/file shape resolution remains in `architecture-artifact.ts`, but it is used by artifact writers/readers, not by a current-lane command.
- Existing changes that relied on `current_artifact` for resume should now be resumed via `weave-next` using visible artifact state and session notes.

## Risks

- Tests in `tests/agent-skills.test.ts` currently assert exact old strings. Update them in the same change as template edits.
- If `src/lib/artifact-context.ts` is deleted before all imports are removed, TypeScript will catch the misses. Use typecheck as the guard.
