---
artifact: prd
status: draft
owner: product
created_at: 2026-06-10T18:27:01.000Z
updated_at: 2026-06-10T18:44:13.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Removing Local Cache PRD

## Problem Statement

Weave currently uses user-local session state to remember workflow routing decisions that are not visible from the working tree or the current conversation. The most problematic fields are the saved active change pointer (`current_change`) and saved artifact lane pointer (`current_artifact`).

This hidden state creates confusion for users and agents because commands can act on a previously saved context even when the current branch or conversation does not clearly indicate that context. It is especially fragile for Plan Mode skills such as `weave-explore` and `weave-architect`, where the skill is expected to set `current_artifact` before discussion, but the lane update can fail or be skipped. Downstream flows such as `weave-capture` and `weave-next` can then read stale lane state and recommend or write to the wrong artifact.

The change should make Weave's active workflow context observable and predictable: resolved root branch state identifies the active change, and explicit user input identifies the capture lane.

## Goals

- Remove hidden persisted artifact-lane state from capture and resume workflows.
- Replace saved active-change lookup with branch-derived active-change behavior where possible.
- Keep durable lifecycle and staleness behavior unchanged in `status.yml`.
- Make no-active-change states explicit when the resolved root branch does not identify a change.
- Preserve the cwd-dispatched workspace/repo context model.
- Require explicit capture targets for v1 so artifact writes do not depend on stored or inferred lane state.

## Non-Goals

- Do not change the durable staleness model stored in `wiki/changes/<change-id>/status.yml`.
- Do not redesign the full change lifecycle stage model.
- Do not change how change folders are named or where `wiki/changes/<change-id>/` lives.
- Do not make registered workspace sub-repos separate change artifact roots.
- Do not solve architecture facet restructuring in this change; that remains the role of `weave-clarify architecture`.
- Do not remove the npm latest-version cache as part of this change.
- Do not introduce a new explicit active-change selection model for non-git folders in v1.
- Do not design branch-disagreement switching UX between workspace roots and registered sub-repos in v1.

## Actors

- Human developer using the `weave` CLI.
- AI coding agent invoking Weave skills and CLI commands.
- Weave design-discussion skills such as `weave-explore`, `weave-prd`, and `weave-architect`.
- Weave capture/resume skills such as `weave-capture` and `weave-next`.
- Weave implementation workflow skills such as `weave-prepare`, `weave-execute`, `weave-slices`, and `weave-knowledge`.

## Current Behavior

- `src/lib/session-state.ts` stores per-folder session entries, including optional `current_change` and `current_artifact` fields.
- `weave change current`, `weave change status`, `weave change progress`, `weave change knowledge`, `weave task prepare`, and `weave slice rollup` can rely on active-change resolution that reads or writes local session state.
- `weave artifact current`, `weave artifact current set`, and `weave artifact current clear` expose and mutate the stored artifact-lane context.
- `weave-explore`, `weave-prd`, and `weave-architect` currently write artifact context as lane-entry state.
- `weave-capture` and `weave-next` currently read artifact context as a resume/capture signal.
- In workspace mode, `.weave/workspace.yml` already selects the workspace root as the single change artifact root, even when commands run inside registered sub-repos.
- Durable lifecycle progress, artifact sources, stale lanes, and stale history already live in `status.yml` and are not stored in local session state.

## Proposed Product Behavior

### Active Change

The current branch should be the primary active-change source of truth.

- If the resolved root's current branch has the shape `change/<change-id>` and `wiki/changes/<change-id>/status.yml` exists, Weave should treat `<change-id>` as the active change.
- In workspace mode, the resolved root is the workspace root; registered sub-repo branches do not select the active change in v1.
- If the resolved root branch does not have the `change/<change-id>` shape, Weave should report that no active change is available and ask the user or agent to create or switch to a change.
- If the branch names a change id but the matching change folder or `status.yml` is missing, Weave should report a clear invalid-active-change state instead of falling back to a saved local pointer.
- `weave change switch <change>` remains the explicit way to move to an existing change because it checks out or creates the `change/<change-id>` branch.
- In non-git folders, Weave should not support implicit active-change selection in v1.

### Artifact/Capture Lane

The system should stop using persisted `current_artifact` state to decide what artifact receives writes.

Capture target resolution should follow this priority in v1:

1. Explicit user target wins, such as `weave-capture prd`, `weave-capture architecture`, or `weave-capture session prd`.
2. If no explicit target is provided, the agent should ask which artifact to capture before writing.

`current_artifact` should no longer be the source of truth for `weave-capture`, `weave-next`, or Plan Mode lane entry. Plan Mode skills should not commit local lane state before discussion.

The `weave artifact current` command family should be removed immediately rather than deprecated or repurposed because stored artifact-lane state is no longer a supported routing concept.

### Staleness

Staleness should continue to work exactly through durable `status.yml` metadata.

Once the active change is identified from the branch, commands such as `weave change progress <lane>` and `weave change clear-stale <lane>` should read and mutate `wiki/changes/<change-id>/status.yml` using the existing source-aware staleness rules.

If no branch-derived active change exists, staleness-mutating commands should stop rather than guessing which `status.yml` to mutate.

Existing local session files may remain on disk. Legacy `current_change` and `current_artifact` fields should be ignored silently for routing, not cleaned up opportunistically and not surfaced as warnings in normal command output.

## User Workflows

### Workflow: User Works On A Branch-Named Change

1. User is on branch `change/<change-id>` at the resolved root.
2. User runs `weave change current`, `weave change status`, `weave change progress`, `weave-capture`, or another active-change command.
3. System resolves the Weave root from `cwd`.
4. System reads the root branch and extracts `<change-id>`.
5. System verifies `wiki/changes/<change-id>/status.yml` exists.
6. System treats `<change-id>` as active without consulting a local saved active-change pointer.

### Workflow: User Is Not On A Change Branch

1. User is on `main`, `develop`, a detached HEAD, or another non-`change/<id>` branch.
2. User or agent runs a command requiring an active change.
3. System reports no active change is available from the current branch.
4. System asks the user to run `weave change new` or `weave change switch`.
5. System does not read a saved active-change pointer to continue silently.

### Workflow: User Captures With An Explicit Target

1. User discusses product behavior, requirements, findings, or architecture.
2. User invokes `weave-capture <artifact>` or `weave-capture session <artifact>`.
3. Agent captures into the explicitly named artifact lane without reading persisted `current_artifact`.
4. Agent does not require Plan Mode skills to have committed local lane state.

### Workflow: User Invokes Capture Without A Target

1. User invokes bare `weave-capture` without naming an artifact target.
2. Agent asks whether to capture under `exploration`, `prd`, `findings`, or `architecture` before writing.
3. User chooses a lane.
4. Agent writes the capture and updates only the selected artifact when artifact capture is requested.

### Workflow: User Updates Staleness After PRD Progress

1. User is on branch `change/<change-id>`.
2. Agent writes or revises `prd.md`.
3. Agent runs `weave change progress prd --source exploration --source sessions --json`.
4. System updates `wiki/changes/<change-id>/status.yml`.
5. Existing source-aware staleness propagation rules mark downstream lanes stale only according to the current lifecycle protocol.

## User Stories

1. As a developer, I want the active change to be visible from the current branch, so that I can understand what Weave will operate on without inspecting hidden local state.
2. As an agent, I want a clear no-active-change response when the branch does not identify a change, so that I do not mutate the wrong change artifact.
3. As a developer, I want `weave change switch` to remain the explicit way to move to an existing change, so that branch and active change stay aligned.
4. As an agent using `weave-capture`, I want an explicit capture target, so that I do not depend on stale `current_artifact` state or heuristic lane inference.
5. As a developer, I want bare `weave-capture` to ask for the target lane, so that it does not write to the wrong artifact.
6. As a maintainer, I want durable staleness to remain in `status.yml`, so that removing local session pointers does not lose lifecycle correctness.
7. As a workspace user, I want commands run from registered sub-repos to keep resolving to the workspace change root, so that product artifacts remain centralized.
8. As a user with older local session files, I want the new behavior to ignore stale pointers safely, so that outdated local state does not affect current commands.
9. As a maintainer, I want the obsolete `weave artifact current` command surface removed, so that users and agents do not keep relying on unsupported lane state.

## Functional Requirements

- The system should derive active change from the resolved root's current branch when the branch matches `change/<change-id>`.
- The system should verify that `wiki/changes/<change-id>/status.yml` exists before treating a branch-derived change as active.
- The system should not use `current_change` from local session state as the source of active change for commands that require an active change.
- The system should show a clear no-active-change message when the resolved root branch does not match `change/<change-id>`.
- The system should keep `weave change switch <change>` as the explicit way to activate an existing change by checking out or creating the expected branch.
- The system should not require `weave-explore`, `weave-prd`, or `weave-architect` to set `current_artifact` before doing their lane work.
- The system should not require `weave-capture` or `weave-next` to read `current_artifact` to decide the current lane.
- The system should require explicit capture targets for capture writes in v1.
- The system should ask the user for the capture target when `weave-capture` is invoked without one.
- The system should remove `weave artifact current`, `weave artifact current set`, and `weave artifact current clear` immediately.
- The system should keep staleness state, artifact source metadata, and stale history in `status.yml`.
- The system should prevent staleness-mutating commands from running when no branch-derived active change is available.
- The system should preserve cwd-dispatched root resolution for workspace mode and repo mode.
- The system should avoid creating `wiki/` or `.weave/` inside workspace sub-repos during active-change resolution.
- The system should use the workspace root branch as the active-change authority in workspace mode.
- The system should not select an active change implicitly in non-git folders.
- The system should ignore legacy `current_change` and `current_artifact` fields silently and leave existing local session files untouched.

## Permissions and Access Control

Weave is a local developer CLI with no product roles or admin permission model for this behavior. Any user who can run Weave commands in the working tree can inspect or mutate change artifacts according to existing file permissions.

The change should not introduce new permissions, approvals, or remote access behavior.

## States and Lifecycle

### Active Change Resolution State

- `branch_active`: resolved root branch is `change/<change-id>` and the matching change status exists.
- `no_active_change`: resolved root branch does not match `change/<change-id>`.
- `invalid_active_branch`: resolved root branch matches `change/<change-id>` but the matching change folder or status file is missing.
- `non_git_no_active_change`: resolved root has no git branch and no explicit non-git active-change model exists.

Valid transitions:

- `no_active_change -> branch_active` by `weave change new` or `weave change switch` creating/checking out a `change/<id>` branch.
- `branch_active -> no_active_change` when the user checks out a non-change branch.
- `branch_active -> invalid_active_branch` when the branch remains but the matching change artifact is missing or moved.

Invalid transitions:

- The system should not move from `no_active_change` to active by reading a saved local pointer.
- The system should not move from `invalid_active_branch` to active by selecting a different saved local pointer.

### Capture Lane Resolution State

- `explicit_lane`: user supplied the lane for the invocation.
- `missing_lane`: user did not supply a lane, so the agent must ask before writing.

## Notifications and Visibility

- `weave change current` and `weave change status` should make the active-change source visible in human and JSON output.
- When no active change is available, agents should surface the recovery action: create a new change or switch to an existing one.
- When capture target is missing, agents should ask a direct lane-selection question before writing.
- Hidden local session pointers should not be surfaced as authoritative current state.

## Edge Cases

- Branch is `change/<id>` but `wiki/changes/<id>/status.yml` is missing: report invalid active branch and do not fall back to local session state.
- Branch is detached or unavailable: report no active change unless an explicit non-git behavior is later defined.
- Branch is `change/<id>` but `status.yml.branch` names a different branch: report a mismatch and do not silently choose a saved pointer.
- Workspace command is run from inside a registered sub-repo: resolve the workspace root first, then apply the active-branch rule for the workspace root unless the workspace authority rule changes.
- Registered sub-repo has a `change/<id>` branch but workspace root does not: do not select the sub-repo change artifact in v1.
- Workspace root and registered sub-repo are on different `change/<id>` branches: keep workspace-root authority in v1; future work may ask which branch to switch.
- User invokes bare `weave-capture`: ask for the lane before writing.
- User invokes `weave-capture prd` after an architecture discussion: explicit target wins for the invocation, subject to normal defensive lane verification by the agent.
- Existing local session file contains `current_change` or `current_artifact`: new behavior should ignore those fields silently for routing and should not edit the file.
- Command runs in a non-git folder: report no active change rather than using local session state.

## Acceptance Criteria

- [ ] `weave change current` reports the active change when the resolved root branch is `change/<change-id>` and the matching status file exists.
- [ ] `weave change current` reports no active change when the resolved root branch is not `change/<change-id>`.
- [ ] Active-change commands do not use saved `current_change` to recover from a non-change branch.
- [ ] `weave change switch <change>` still activates a change by checking out or creating its expected branch.
- [ ] `weave change progress <lane>` updates staleness metadata in the branch-derived change's `status.yml`.
- [ ] `weave change progress <lane>` refuses to run when no branch-derived active change exists.
- [ ] `weave-explore` and `weave-architect` no longer need a Plan Mode lane-commit to local session state.
- [ ] `weave-capture` can use an explicit lane target without reading stored artifact context.
- [ ] Bare `weave-capture` asks for a lane before writing.
- [ ] `weave-next` no longer depends on stored `current_artifact` to recommend next work.
- [ ] Workspace mode commands still resolve the workspace root as the change artifact root from registered sub-repos.
- [ ] Older local session fields do not override branch-derived active-change behavior.
- [ ] `weave artifact current`, `weave artifact current set`, and `weave artifact current clear` are removed.
- [ ] Non-git folders do not provide implicit active-change recovery from local session state.
- [ ] Workspace root branch remains authoritative when a registered sub-repo branch disagrees.

## Rollout Considerations

This is a behavior change for users and agents who currently rely on hidden session state. It should be rolled out with clear command and skill documentation updates.

Recommended rollout shape:

- First remove `current_artifact` dependency from skills and capture/resume behavior, because it directly addresses the Plan Mode failure class.
- Then replace `current_change` dependency with branch-derived active-change resolution.
- Update bundled skill instructions and tests in the same release so agents stop calling `weave artifact current set <lane>` as lane-entry behavior.
- Remove the obsolete `weave artifact current` command family in the same release.
- Treat existing local session files as legacy local data; the new behavior should ignore stale routing fields silently rather than requiring cleanup, warnings, or local file edits.

## Analytics and Success Metrics

Success can be evaluated through:

- Fewer user reports of `weave-capture` selecting the wrong artifact lane.
- Fewer Plan Mode failures caused by skipped or blocked lane-commit commands.
- Fewer branch/session mismatch warnings or stale active-change pointer incidents.
- Increased predictability of `weave change current` output based on visible branch state.
- Reduced need for users to inspect or repair local session files.

## Revision History

- 2026-06-10: Initial PRD generated from `exploration.md` and exploration session context.
- 2026-06-10: Closed PRD open questions from product discussion and updated requirements for explicit capture targets and branch-derived active change.

## Assumptions

- The branch-derived model should use the resolved Weave root's branch, not an arbitrary nested directory's git branch, unless a later workspace decision changes this.
- Existing source-aware staleness behavior is correct and should not be redesigned in this change.
- Existing local session files may remain on disk for unrelated or legacy data, but `current_change` and `current_artifact` should no longer be authoritative.

## Resolved Product Decisions

- Workspace mode uses the workspace root branch as the active-change authority in v1.
- Non-git folders stop supporting implicit active changes in v1.
- Bare `weave-capture` asks for an explicit lane before writing.
- `weave artifact current` and its mutation subcommands are removed immediately.
- Old local session fields are ignored silently and left untouched.

## Out of Scope

- Npm package latest-version cache behavior.
- Architecture artifact facet restructuring.
- A global event log of skill invocations.
- Workspace/sub-repo branch-disagreement switching UX.
- Explicit active-change selection for non-git folders.
- Remote branch management, PR creation, or package release behavior.
- New permissions or multi-user access controls.

## Further Notes

The central product distinction is that `status.yml` remains durable product/lifecycle truth, while the resolved root branch and explicit user target are routing signals. Hidden local session state should not determine which durable artifact receives writes.
