# Workspace-Aware Skill Context

## Purpose

Weave skills resolve change context the same way the CLI does: from the current working directory to one workspace or repo root. This keeps agent behavior aligned with workspace mode, where a workspace root owns the change artifacts even when implementation work happens inside registered sub-repos.

## Current Behavior

Skills begin discovery with Tier 1 commands such as:

```bash
weave workspace --json
weave change current --json
weave change status --json
```

The result is interpreted as a cwd-dispatched context:

- In workspace mode, `workspace` is present, `repos[]` lists registered implementation locations, and `folders[]` is empty. The workspace root is the single change context; agents read and write `wiki/changes/<change-id>/` under that root.
- In repo mode, `workspace` is `null` and `folders[]` contains session folders. Skills may use the active session folders as the context boundary.

Registered workspace sub-repos are not separate artifact targets by default. A skill may inspect or edit code in those repos when relevant, but PRD, architecture, exploration, clarification, task, capture, and knowledge artifacts belong to the workspace root change context.

## Behavioral Rules

- Skills must not treat `folders: []` as no context when `workspace` is present.
- Skills should identify the change folder under the resolved workspace or repo context, not under every registered repo.
- In workspace mode, completion summaries should describe the workspace root as the single processed context.
- In repo mode, skills may still describe multiple contexts when multiple session folders are relevant.

## Source Anchors

- Cwd context resolver: `src/lib/workspace-mode.ts` (`findWorkspaceMode`, `resolveChangeContext`)
- Workspace display shape: `src/lib/show-workspace.ts`
- Change command context: `src/lib/changes.ts` (`resolveTarget`)
- Reference skill wording: `templates/skills/weave-new/SKILL.md`, `templates/skills/weave-next/SKILL.md`
- Updated skill wording: `templates/skills/weave-explore/SKILL.md`, `templates/skills/weave-prd/SKILL.md`, `templates/skills/weave-architect/SKILL.md`, `templates/skills/weave-clarify/SKILL.md`

## Change History

- 2026-06-04 (change `260605-bdsu-workspace-aware-skills`): design-discussion and artifact-authoring skills were updated to use the cwd-dispatched workspace-or-repo context instead of assuming `weave workspace --json` always returns populated `folders[]`.
