# Remove Artifact Lane State

## Outcome

The `weave artifact current` command family and persisted artifact-lane routing are removed from the product surface. No command writes `current_artifact`, and explicit capture targets become the only artifact routing path.

## User flow

1. User or agent no longer runs `weave artifact current`.
2. User invokes explicit capture commands such as `weave-capture prd` or `weave-capture architecture`.
3. Weave does not read or write stored artifact-lane state.

## In scope

- Remove top-level `weave artifact` command registration.
- Remove artifact-context implementation when imports are gone.
- Stop feature change creation and switching from writing or preserving `current_artifact`.
- Delete or replace tests that assert artifact current set/read/clear behavior.

## Out of scope

- Updating skill prose and knowledge docs; those are handled in slice 03.
- Cleaning old local session files on disk.

## Acceptance criteria

- [ ] `weave artifact` is not registered in the CLI.
- [ ] No command writes `current_artifact` to local session state.
- [ ] Existing local `current_artifact` fields are ignored and left untouched.
- [ ] TypeScript has no imports from removed artifact-context files.
