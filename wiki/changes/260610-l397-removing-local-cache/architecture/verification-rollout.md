---
artifact: architecture
facet: verification-rollout
status: draft
owner: engineering
created_at: 2026-06-10T19:05:20.000Z
updated_at: 2026-06-10T19:05:20.000Z
source: prd.md, codebase, architecture discussion
---

# Verification And Rollout

## Implementation Order

1. Refactor `src/lib/changes.ts` to resolve active changes from branch state only.
2. Make `weave change new` fail in non-git roots before writing change files.
3. Remove the `weave artifact` command registration and artifact-context implementation.
4. Update skill templates and skill-template tests.
5. Update current-state knowledge docs.
6. Run typecheck and tests.

This order keeps the central active-change seam coherent before removing the artifact lane surface.

## Test Replacement Plan

### `tests/changes.test.ts`

Replace session-backed assertions with branch-backed assertions:

- Change the non-git create test from "creates and skips branch creation outside git" to "rejects change creation outside git".
- Initialize git in fixtures that call `createChange` and expect an active change.
- Remove imports and tests for `currentArtifact`, `setCurrentArtifact`, and `clearCurrentArtifact`.
- Replace "records created changes as current in the local session" with assertions that the branch is checked out and `currentChange` resolves from that branch.
- Replace "shows current changes from session state" with "shows current changes from branch state".
- Replace "self-heals current changes from matching branches" with a regression test that branch resolution does not write session state.
- Add a regression test where a stale `current_change` exists but the branch is not `change/<id>`; `currentChange` should report no active change.
- Add a regression test where stale `current_change` points at one change and the branch points at another valid change; branch wins.
- Add a regression test for `change/<missing-id>` returning `invalid_active_branch`.
- Remove switch tests that only verify `current_artifact` clearing/preservation.
- Update list/status tests so active markers come from branch-derived id.

### `tests/cli-change-progress.test.ts`

- Initialize git in setup before `createChange`.
- Keep source-aware staleness assertions unchanged.

### `tests/cli-change-staleness.test.ts`

- Initialize git in setup before `createChange`.
- Keep stale propagation assertions unchanged.

### `tests/agent-skills.test.ts`

- Remove expectations for `weave artifact current set ...` and `weave artifact current --json`.
- Add expectations for explicit capture target prompts.
- Add expectations that design-discussion skills no longer commit local lane state.

### CLI command registration tests

- If a CLI help/registration test exists, update it so `weave artifact` is not present.
- If none exists, add a small CLI-level assertion that `createProgram()` does not include an `artifact` command.

## Verification Commands

Run targeted tests first while refactoring:

```bash
npm run test -- tests/changes.test.ts tests/agent-skills.test.ts tests/cli-change-progress.test.ts tests/cli-change-staleness.test.ts
```

Run full verification before considering the implementation complete:

```bash
npm run typecheck
npm run test
```

If command registration or skill-template checks fail, fix the templates/tests before broadening the implementation.

## Rollout Notes

- This is an intentional breaking behavior change for users and agents relying on hidden session pointers.
- Existing local session files are not migrated or cleaned.
- Users on non-change branches must run `weave change new` or `weave change switch`.
- Users in non-git roots must initialize git before creating a change.
- Installed skills may need refresh after bundled templates change.

## Success Criteria

- `weave change current` returns active change only from a valid `change/<id>` branch.
- `weave change current` reports no active change on non-change branches even if local session has `current_change`.
- `weave change progress`, `weave change knowledge`, `weave task prepare`, and `weave slice rollup` refuse to run without a branch-derived active change.
- `weave artifact` is no longer registered.
- No shipped skill template calls `weave artifact current`.
- Staleness behavior in `status.yml` remains unchanged.

## Deferred Work

- Branch-disagreement UX between workspace root and registered sub-repos remains future scope.
- Explicit active-change selection for non-git folders remains out of scope.
- Cleanup of legacy local session fields on disk remains out of scope.
