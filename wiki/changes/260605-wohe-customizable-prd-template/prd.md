---
artifact: prd
status: draft
owner: product
created_at: 2026-06-04T20:41:38.000Z
updated_at: 2026-06-04T20:41:38.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Customizable PRD Template PRD

## Problem Statement

`weave-prd` currently embeds the full generated PRD structure inside `templates/skills/weave-prd/SKILL.md`. Users who want to adapt the PRD format for their own workflow must modify the skill instructions themselves, which mixes reusable agent behavior with user-specific document structure and makes updates harder to reason about.

The PRD template should be a user-editable template file that lives outside the PRD skill instructions while still being bundled, installed, diffed, and reset through the normal Weave agent-skill flow.

## Goals

- Let users customize the generated PRD structure without editing the `weave-prd` skill instructions.
- Keep `weave-prd` responsible for behavior, context loading, artifact lifecycle, and synthesis rules.
- Bundle a default PRD template with Weave so first-time users still get a useful structure.
- Preserve user edits to the installed PRD template during normal install/update flows.
- Keep the initial scope focused on `weave-prd`.

## Non-Goals

- Extracting `weave-architect` or `weave-knowledge` templates in this change.
- Changing the lifecycle semantics of `weave-prd`.
- Changing how `prd.md` artifacts are stored under `wiki/changes/<change-id>/`.
- Creating a repo-wide template editor or UI.

## Actors

- Weave user: customizes the PRD template to match their product workflow.
- Agent using `weave-prd`: reads the skill instructions and the sibling PRD template when creating or revising a PRD.
- Weave CLI: installs, updates, diffs, and resets bundled skill files.

## Current Behavior

The PRD structure is embedded directly inside `templates/skills/weave-prd/SKILL.md` under `# PRD Template`. Skill installation currently treats each skill as a folder whose managed artifact is only `SKILL.md`; helper logic in `src/lib/agent-skills.ts` installs `SKILL.md` to each supported agent target.

User-modified installed skill files are preserved by install/update and can be reset explicitly. That protection does not yet apply to supporting files inside a skill folder because no such bundled skill resource files are installed today.

## Proposed Product Behavior

The default PRD structure should move into a sibling template file, `prd-template.md`, inside the `weave-prd` skill folder. `SKILL.md` should instruct agents to read that sibling file as the canonical PRD structure and follow user modifications when present.

When users install Weave skills, the default PRD template should be installed beside `SKILL.md` for each supported agent. If a user edits their installed `prd-template.md`, future install/update operations should preserve that edit and report the resource as modified. Explicit reset should restore the bundled default.

## User Workflows

### Workflow: User Customizes PRD Format

1. User installs Weave skills.
2. Weave installs `weave-prd/SKILL.md` and `weave-prd/prd-template.md`.
3. User edits the installed `prd-template.md` to match their desired PRD sections.
4. User runs `weave-prd`.
5. The agent follows `SKILL.md`, reads the customized template file, and creates or revises `wiki/changes/<change-id>/prd.md` using that structure.

### Workflow: User Updates Weave Skills

1. User has an edited installed `prd-template.md`.
2. User runs the normal Weave agent update flow.
3. Weave detects the installed PRD template differs from the manifest-managed version.
4. Weave preserves the user-modified template instead of overwriting it.
5. User can review differences or explicitly reset when they want the bundled default.

## User Stories

1. As a Weave user, I want the PRD template outside `SKILL.md`, so that I can customize the generated PRD format without changing skill behavior.
2. As a Weave user, I want my customized PRD template preserved during updates, so that package upgrades do not overwrite my workflow.
3. As a Weave user, I want an explicit reset path, so that I can return to the bundled PRD template when needed.
4. As an agent using `weave-prd`, I want clear instructions to read the sibling template file, so that generated PRDs follow the user's configured structure.

## Functional Requirements

- The system should bundle a default `prd-template.md` under the `weave-prd` skill folder.
- The `weave-prd` skill should no longer inline the full PRD document structure in `SKILL.md`.
- The `weave-prd` skill should instruct agents to read the sibling `prd-template.md` as the PRD structure.
- The skill installer should install non-`SKILL.md` files that are direct children of a bundled skill folder.
- The system should preserve user-modified installed template files during install/update.
- The system should reset the installed PRD template only when the user explicitly requests reset for `weave-prd`.
- The system should include the new resource file in relevant diff/reset/install behavior.

## Permissions and Access Control

No new permission model is required. The PRD template is a local file managed inside the user's installed agent-skill directory. Users with filesystem access to installed skills can edit it.

## Edge Cases

- If `prd-template.md` is missing from an installed skill folder, update/install should restore it from the bundled default unless the existing state is explicitly considered modified by manifest rules.
- If the installed `prd-template.md` has user edits, update should not overwrite it.
- If `SKILL.md` is updated but `prd-template.md` is customized, the skill instructions can update while the user template remains preserved.
- If future bundled templates change, users with unmodified installed templates should receive the updated default.
- If the agent cannot find the sibling template file, it should report the missing template rather than silently inventing a different PRD structure.

## Acceptance Criteria

- [ ] `templates/skills/weave-prd/prd-template.md` contains the default PRD structure that was previously embedded in `SKILL.md`.
- [ ] `templates/skills/weave-prd/SKILL.md` points agents to the sibling `prd-template.md` file.
- [ ] Installing Weave skills installs `prd-template.md` beside `SKILL.md` for supported agent targets.
- [ ] Updating Weave skills preserves a user-modified installed `prd-template.md`.
- [ ] Resetting `weave-prd` restores both `SKILL.md` and `prd-template.md` from the bundled defaults.
- [ ] Tests cover install, update preservation, and reset behavior for the PRD template resource.

## Rollout Considerations

This is a template and installer behavior change. Existing users who update skills should receive the new sibling template file. Users who customize the installed template should expect future updates to preserve those customizations unless they explicitly reset.

## Analytics and Success Metrics

No product analytics are required. Success is measured by test coverage and by users being able to edit the installed PRD template without modifying `SKILL.md`.

## Revision History

- 2026-06-05: Initial PRD generated from the discussion about moving the PRD template out of `weave-prd` skill instructions.

## Assumptions

- The best default location is a sibling resource file in the `weave-prd` skill folder.
- Installed skill resource files should use the same user-modification protection model as installed `SKILL.md` files.
- This change should not broaden to architecture or knowledge templates yet.

## Open Questions

- Should the manifest represent supporting skill files in a new `resources` bucket or in the existing `skills` bucket with compound keys?
- Should notices and status include modified resource files, or should those remain visible only through explicit agent diff/update/reset results?

## Out of Scope

- A UI for editing templates.
- Project-level template discovery outside the installed skill folder.
- Automatic migration of user customizations from previously edited `SKILL.md` files.

## Further Notes

The implementation plan captured during discussion recommends a new managed artifact kind for skill resources to keep `SKILL.md` tracking distinct from supporting files.
