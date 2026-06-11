# Contracts: Remove Artifact Lane State

Slice-level technical contracts for removing persisted artifact-lane routing.

## Interfaces

- Removed command surface: `weave artifact`, `weave artifact current`, `weave artifact current set`, and `weave artifact current clear`.
- No replacement CLI command is added for stored lane state.
- Artifact capture is routed outside this slice by explicit skill invocation targets.

## Data

- `SessionFolder.current_artifact` may remain optional for legacy file parse tolerance.
- No code path in this slice should call `setCurrentArtifactForPath`, `clearCurrentArtifactForPath`, or `currentArtifactForPath` for routing.
- Existing local session files are not migrated, cleaned, or warned about.

## State

- `createChange` no longer seeds current artifact context for feature changes.
- `switchChange` no longer clears or preserves artifact context.
- Architecture folder/file resolution remains available through architecture artifact helpers for live artifact writers, not current-lane routing.

## Validation and errors

- Direct `weave artifact` invocation should fail as an unknown command through the normal Commander behavior.
- No compatibility warning or deprecation command is provided.

## Files and artifacts

- Remove from CLI: `src/cli.ts`, `src/commands/artifact.ts`.
- Remove implementation: `src/lib/artifact-context.ts` after call sites are gone.
- Update tests: `tests/changes.test.ts` and any CLI registration tests.

## Observability

- Help output should no longer list `artifact`.
- JSON output from active-change commands should not mention current artifact context.
