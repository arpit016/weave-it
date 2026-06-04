---
artifact: prd
status: draft
owner: product
created_at: 2026-06-04T19:58:54.000Z
updated_at: 2026-06-04T19:58:54.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Workspace-Aware Skills PRD

## Problem Statement

Weave's CLI now supports cwd-dispatched workspace mode: in workspace mode, `weave workspace --json` returns a `workspace` object and `repos[]`, while `folders[]` is empty. Several Weave skill templates still instruct agents to use returned folders or "workspace folders" as the context boundary. In workspace mode, that wording can cause agents to load no change context or to treat registered sub-repos as separate artifact targets.

## Goals

- Make every Weave skill template describe the current cwd-dispatched workspace-or-repo context model accurately.
- Ensure skills that read change artifacts use the workspace root as the single change store in workspace mode.
- Preserve repo-mode guidance for session folders.
- Keep this as a template-text correction only; no CLI behavior changes.

## Non-Goals

- Changing `weave workspace`, `weave change`, or `weave artifact` behavior.
- Solving workspace sub-repo `--target all` or short-id routing.
- Updating installed user skill copies directly; the normal skill update/reset flow handles propagation.

## Current Behavior

`weave-new` and `weave-next` already describe workspace mode correctly: the current cwd resolves one workspace or repo context, and workspace sub-repos are implementation locations inside a single workspace change context.

`weave-explore`, `weave-prd`, `weave-architect`, and `weave-clarify` still use older folder-iteration language. `weave-capture`, `weave-knowledge`, `weave-issues`, `weave-new`, and `weave-next` need a sanity pass to confirm their wording remains compatible.

## Proposed Product Behavior

Skill templates should consistently tell agents to use the cwd-dispatched context returned by `weave workspace --json`:

- In workspace mode, the workspace root owns `wiki/changes/<change-id>/`, and registered `repos[]` are implementation locations within that context.
- In repo mode, the active session folders remain the context boundary.
- Skills should not infer that `folders[]` being empty means there is no context when `workspace` is present.

## Acceptance Criteria

- [ ] `weave-explore` no longer uses `folders[]` as the only exploration boundary in workspace mode.
- [ ] `weave-prd`, `weave-architect`, and `weave-clarify` identify the change folder under the resolved workspace or repo context.
- [ ] Completion language in `weave-prd` and `weave-architect` distinguishes multiple repo-mode contexts from the single workspace-mode context.
- [ ] The remaining five skill templates are checked for stale workspace-mode assumptions.
- [ ] No CLI behavior changes are required.

## Rollout Considerations

This is a template update. Users with locally modified installed skills will continue to see skill notices until they reconcile or reset their installed copies.

## Revision History

- 2026-06-04: Initial PRD generated from the workspace-aware skills plan and current implementation review.

## Assumptions

- The canonical behavior is the cwd-dispatched model already implemented in `src/lib/workspace-mode.ts` and reflected in `weave-new` / `weave-next`.
- The changes are wording-only and do not require new automated tests beyond existing test suite and skill diff checks.

## Open Questions

None.
