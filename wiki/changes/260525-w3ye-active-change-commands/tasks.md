# Active Change Commands Tasks

## Source

This task breakdown is derived from the active change commands exploration, PRD, and implementation plan. The tasks are written as tracer-bullet slices: each one should deliver user-visible or agent-visible behavior across command handling, core behavior, state changes, output, and tests.

## Tracking

Use the task metadata below as the durable source of truth for implementation progress inside this change.

Status values:

```text
todo
in_progress
blocked
done
```

Rules:

- Set exactly one task to `in_progress` per agent at a time.
- Set `Owner` when a task is picked up.
- Set `Started` when implementation begins.
- Set `Completed` only after the task is done and verified.
- Fill `Verification` with the commands or checks that proved the task is complete.
- Use `Notes` for blockers, partial progress, or handoff context.

## Task Breakdown

### 1. Activate Newly Created Changes

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** 7, 8, 9, 10, 44, 45, 53, 73, 75

**What to build**

When a user creates a new change, Weave should activate that change in the local workspace session for every target where the change was created. The behavior should work for single-target and multi-target creation, preserve compatibility with sessions that do not yet have active change data, and keep active state out of committed repo metadata.

**Acceptance criteria**

- [x] Creating a change records that change as current for every affected workspace folder.
- [x] The active session entry includes the change id, relative artifact location, expected branch, and updated timestamp.
- [x] Existing session files without active change entries continue to load and save correctly.
- [x] Dirty worktrees do not block `new`.
- [x] Text output states that the created change is now current.
- [x] JSON output includes the current/activated state for each target.
- [x] Tests cover single-target creation, multi-target creation, backwards-compatible session loading, and dirty-worktree allowance.

### 2. List Known Changes With Active Marker

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Task 1

**User stories covered:** 1, 2, 3, 4, 39, 48, 50, 75

**What to build**

Add the `list` command for the current target. It should discover known changes, read their metadata, sort them newest first, and mark the active change from local session state. The command should stay focused on being a clean index and avoid branch diagnostics.

**Acceptance criteria**

- [x] `list` shows known changes for the current target.
- [x] Results are sorted newest first.
- [x] The active change is marked in text output.
- [x] JSON output includes change metadata and active marker state.
- [x] Missing optional metadata is handled gracefully.
- [x] Inactive branch diagnostics are not shown.
- [x] Tests cover sorting, metadata parsing, active marker output, no-active output, and JSON output.

### 3. Show Current Change and Self-Heal From Branch

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Tasks 1 and 2

**User stories covered:** 26, 27, 28, 29, 30, 33, 46, 48, 51, 59, 68, 75

**What to build**

Add the `current` command for the current target. It should report the saved active change when present, report a clear no-active state when absent, and save inferred active state when no active session entry exists but the current git branch maps unambiguously to a known change.

**Acceptance criteria**

- [x] `current` reports the saved active change with id, title, type, stage, branch, and artifact location.
- [x] `current` reports a clear no-active result when no active state or branch inference exists.
- [x] `current` infers and saves active state from a matching branch when no session active state exists.
- [x] Output clearly indicates when active state was inferred and saved.
- [x] JSON output distinguishes saved, inferred-and-saved, and no-active states.
- [x] Tests cover saved active state, no-active state, branch inference, inferred state persistence, and JSON output.

### 4. Switch Existing Change Safely

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Tasks 1, 2, and 3

**User stories covered:** 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 42, 43, 53, 69, 70, 71, 72, 75

**What to build**

Add the `switch` command as the explicit way to replace active context with an existing change. It should resolve change references, block dirty worktrees, create or check out the expected branch, and update session state only after branch work succeeds.

**Acceptance criteria**

- [x] `switch` resolves a full change id.
- [x] `switch` resolves a unique 4-character token.
- [x] `switch` resolves a unique slug/title substring.
- [x] Ambiguous and missing references fail clearly and do not mutate state.
- [x] Dirty worktrees block switching and preserve previous active state.
- [x] Git repos check out or create the expected branch before session state changes.
- [x] Non-git folders update active state and report branch work as skipped.
- [x] Branch checkout/create failure preserves previous active state.
- [x] Text and JSON output report selected change, branch result, and active-state update.
- [x] Tests cover successful switching, resolution modes, ambiguous references, missing references, dirty worktrees, non-git folders, branch failure, and JSON output.

### 5. Report Status and Branch Alignment

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Tasks 1, 2, 3, and 4

**User stories covered:** 34, 35, 36, 37, 38, 40, 41, 47, 48, 49, 52, 60, 61, 62, 63, 64, 75

**What to build**

Add the `status` command for the current target. Without an explicit change, it should report active change metadata and branch alignment. With an explicit change, it should inspect that change without switching or saving active state. It should detect saved-state versus branch-state mismatch and report it clearly.

**Acceptance criteria**

- [x] Default `status` reports the active change metadata.
- [x] Default `status` self-heals missing active state from a matching branch using the same rules as `current`.
- [x] Explicit `status <change>` inspects that change without activating it.
- [x] Status reports whether the current branch matches the expected branch.
- [x] Mismatches show both saved active context and branch-inferred context.
- [x] Mismatch output instructs the user to resolve with `switch`.
- [x] Status remains metadata-focused and does not include implementation progress.
- [x] JSON output includes active marker, branch match/mismatch state, and self-heal state when applicable.
- [x] Tests cover active status, explicit inspection, branch match, branch mismatch, self-healing, no-active state, and JSON output.

### 6. Support Workspace-Wide `all` Views

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Tasks 2, 3, and 5

**User stories covered:** 5, 6, 31, 32, 33, 50, 51, 52, 56, 57, 58, 65, 66, 67, 75

**What to build**

Extend `list`, `current`, and `status` to operate across all folders in the current Weave session. Results should be grouped by workspace folder, and `current all` / `status --target all` should self-heal missing active state across every matching workspace repo.

**Acceptance criteria**

- [x] `list all` groups known changes by workspace folder.
- [x] `current all` reports active, no-active, and inferred-and-saved state per folder.
- [x] `status --target all` reports metadata and branch alignment per folder.
- [x] `current all` and `status --target all` save inferred active state for every matching repo with no conflicting active state.
- [x] Output clearly identifies each workspace folder.
- [x] Target arguments accept session folder ids and explicit paths where applicable.
- [x] JSON output preserves workspace grouping and per-folder status.
- [x] Tests cover all-workspace grouping, per-folder self-healing, mixed active/no-active folders, folder id targets, path targets, and JSON output.

### 7. Activate Propagated Changes in Destination Repos

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Tasks 1 and 4

**User stories covered:** 11, 12, 13, 14, 15, 54, 55, 57, 69, 70, 74, 75

**What to build**

Update propagation so destination repos become current for the propagated change after successful artifact copy and branch work. Propagation should leave source active state unchanged, copy only change planning artifacts, and block dirty destination repos before changing branch or session state.

**Acceptance criteria**

- [x] Successful propagation activates the propagated change in every destination repo.
- [x] Source repo active state is not changed by propagation.
- [x] Propagation continues to copy only planning artifacts.
- [x] Destination repos check out or create the expected change branch.
- [x] Dirty destination repos block propagation before branch or session changes.
- [x] Failure in a destination repo does not leave incorrect active state behind.
- [x] Text output shows which destination repos are now current.
- [x] JSON output includes destination activation state and branch result.
- [x] Tests cover destination-only activation, unchanged source state, dirty destination blocking, copied artifacts, branch behavior, failure preservation, and JSON output.

### 8. Harden Structured Errors for Agents

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Tasks 3, 4, 5, 6, and 7

**User stories covered:** 48, 49, 50, 51, 52, 53, 75

**What to build**

Make failure states predictable for scripts and agents across active change commands. Text output should remain readable, while JSON output should expose stable categories for missing changes, ambiguous references, dirty worktrees, branch failures, no-active state, and active/branch mismatches.

**Acceptance criteria**

- [x] JSON failures include a stable status/category and human-readable message.
- [x] Ambiguous references include enough candidate information for a user or agent to choose next steps.
- [x] Dirty worktree errors identify the affected folder.
- [x] Mismatch errors identify both saved active state and branch-inferred state.
- [x] Branch failures do not claim active-state updates.
- [x] Tests cover JSON failure contracts for ambiguity, missing change, dirty worktree, branch failure, no-active, and mismatch.

### 9. Update Documentation and Agent Guidance

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Tasks 1 through 8

**User stories covered:** 46, 47, 54, 58, 65, 66, 67, 73, 74, 75

**What to build**

Update user and agent documentation so humans and agents know how to use active change commands. Documentation should explain local session active state, `all` workspace behavior, the intended command order for agents, dirty-worktree blocking, mismatch resolution, and propagation semantics.

**Acceptance criteria**

- [x] User docs describe `list`, `current`, `status`, and `switch`.
- [x] User docs state that active change state is local workspace/session state and is not committed.
- [x] User docs describe `all` behavior and target selection.
- [x] User docs explain dirty-worktree blocking for `switch` and `propagate`.
- [x] User docs explain mismatch resolution with `switch`.
- [x] Agent guidance tells agents to check `current` or `status` before continuing work.
- [x] Agent guidance clarifies that propagation copies planning artifacts and activates destination repos, not implementation files.
- [x] Tests or checks that validate generated/installed agent guidance are updated where applicable.

## Review Questions

- Does this granularity feel right, or should any task be split further?
- Are the dependency relationships correct?
- Should any task be marked HITL, or are all of these safe as AFK implementation slices?
