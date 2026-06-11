---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-10T05:55:20.536Z
updated_at: 2026-06-10T18:21:57.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Removing Local Cache

## Topic

Removing local cache

## Current Understanding

The target is not the npm version cache. The target is hidden local workflow state in the user-local current session, especially:

- `current_change`: a saved active-change pointer that lets commands operate even when the current branch does not identify the change.
- `current_artifact`: a saved discussion/capture lane that tells `weave-capture` which artifact to update.

The product problem is that both fields are implicit, local, and easy to become stale. They can cause agents to act on a hidden context that is no longer visible from the working tree or current conversation.

The preferred direction is:

- Active change should be derived from the current branch when it has the shape `change/<change-id>` and the matching `wiki/changes/<change-id>/status.yml` exists.
- If the branch does not have this shape, agents should ask the user to create or switch to a change rather than using a saved local pointer.
- Staleness should remain unchanged because it already lives in durable `status.yml` metadata for the selected change.
- The current discussion lane should not be persisted as `current_artifact`. It should come from explicit user input, the invoked skill, or strong conversation-substance inference.

This is a simplification of workflow authority: visible branch state selects the change; visible invocation/conversation context selects the capture lane.

## Open Questions

- In workspace mode, should the workspace root branch be the only active-change authority, even when the user is currently inside a registered sub-repo on a different `change/<id>` branch?
- Should non-git folders stop supporting implicit active changes entirely, or should there be an explicit non-git alternative?
- Should bare `weave-capture` infer the lane silently when the last invoked skill and conversation substance agree, or should it always ask for the lane?
- Should `weave artifact current` be removed, deprecated with a compatibility warning, or repurposed to report that no stored lane exists?
- How should older local session files containing `current_change` or `current_artifact` be treated during rollout: ignored, cleaned up opportunistically, or left untouched?

## Decisions

- Prefer removing `current_artifact` as persisted local state. Plan Mode failures in `weave-explore` and `weave-architect` are a direct symptom of relying on this hidden lane commit.
- Prefer branch-derived active-change lookup over `current_change` lookup. Branches named `change/<change-id>` should silently identify the active change.
- If the current branch is not a `change/<change-id>` branch, agents should ask the user to run `weave change new` or `weave change switch` rather than relying on local session state.
- Keep staleness state in `status.yml`; local session removal should not change the durable staleness model.
- Use `weave-clarify architecture` for restructuring already-captured architecture into facets. Use `weave-architect` for thinking through the facet boundaries and `weave-capture architecture` for persisting a fresh architecture discussion.

## Scenarios

### Branch Identifies Active Change

A user is on `change/260610-l397-removing-local-cache`. Weave reads `wiki/changes/260610-l397-removing-local-cache/status.yml` and treats that change as active without reading a saved local active-change pointer.

### Branch Does Not Identify Active Change

A user is on `main`, `develop`, a detached HEAD, or another non-`change/<id>` branch. Weave does not infer an active change from local session state. The agent stops and asks the user to create or switch to a change.

### Progress And Staleness

A user runs `weave change progress prd --source exploration` while on `change/<id>`. Weave selects `<id>` from the branch, updates `wiki/changes/<id>/status.yml`, and applies the existing staleness propagation rules. If the branch does not identify a change, Weave does not know which `status.yml` to mutate and must stop.

### Capture After Exploration Or Architecture Discussion

After `weave-explore` or `weave-architect`, bare `weave-capture` should not depend on a stored `current_artifact` lane. It should use explicit user input first, then visible recent skill invocation and conversation substance when clear, and ask the user when ambiguous.

### Architecture Facets After Initial Capture

If architecture was already captured and the user wants to split or reorganize it into facets, the appropriate follow-up is `weave-clarify architecture`, not another hidden lane update.

## Existing Behavior

- `src/lib/session-state.ts` stores per-folder `current_change` and `current_artifact` inside the user-local current session file.
- `weave change current`, `weave change status`, `weave change progress`, `weave change knowledge`, `weave task prepare`, and `weave slice rollup` currently depend on active-change resolution that can read or write local session state.
- `weave artifact current`, `weave artifact current set`, and `weave artifact current clear` expose the stored artifact-lane context.
- `weave-explore`, `weave-prd`, and `weave-architect` currently write local artifact context; `weave-capture` and `weave-next` read it.
- Workspace mode already resolves the change artifact root from `.weave/workspace.yml`; registered repos are implementation locations, not separate change artifact roots.
- Durable lifecycle and staleness metadata already lives in `wiki/changes/<change-id>/status.yml`, not in local session state.

## PRD Readiness

Not ready. The direction is clear, but the workspace branch-authority rule, non-git behavior, bare `weave-capture` inference rule, and rollout behavior for existing session files still need decisions.
