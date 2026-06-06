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

For context-gathering skills, workspace mode has two layers:

- Artifact layer: the workspace root owns `wiki/changes/<change-id>/` and the current durable Weave artifacts.
- Evidence layer: registered `repos[]` are candidate sources of docs, repo-local wiki content, specs, ADRs, code, and tests that may explain current product behavior or technical boundaries.

`weave-explore` and `weave-architect` use registered repos as bounded context sources. They lightly inventory all registered repos, then deeply inspect only relevant repos based on the user request, active change artifacts, repo names/kinds, docs, knowledge, prior changes, or code references. They prefer current docs, knowledge specs, ADRs, and repo-local Weave wiki content before implementation code, and use code/tests to verify important claims.

`weave-clarify` is narrower: it may inspect registered sub-repos only when the selected artifact clarification depends on repo-local truth. It does not inventory or inspect every registered repo by default, and it should recommend `weave-explore` or `weave-architect` when the needed context is broad or uncertain.

## Behavioral Rules

- Skills must not treat `folders: []` as no context when `workspace` is present.
- Skills should identify the change folder under the resolved workspace or repo context, not under every registered repo.
- Skills must not create, read, or update change artifacts under each registered sub-repo by default.
- `weave-explore` uses relevant sub-repo context to understand product behavior, domain language, workflows, roles, permissions, states, rollout behavior, and edge cases.
- `weave-architect` uses relevant sub-repo context to understand affected repos, cross-repo boundaries, contracts, data flow, schema/API/event/job/deployment constraints, rollout, observability, testing, and risks.
- `weave-clarify` uses sub-repo context as targeted verification context when the selected artifact references repo-local docs/code or the requested clarification changes behavior, technical direction, permissions, rollout, integration boundaries, or architecture facet ownership.
- Context-gathering skills should report which repos/docs/code anchors were inspected and which repos were skipped when findings depend on workspace sub-repo context.
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
- 2026-06-06 (change `260606-k0l6-architecture-folder`): `weave-explore` and `weave-architect` gained an explicit workspace repo context protocol: registered `repos[]` are lightly inventoried as docs/code evidence sources, relevant repos are inspected deeply, docs/wiki/specs are preferred before code, and findings report inspected/skipped repos.
- 2026-06-06 (change `260606-k0l6-architecture-folder`): `weave-clarify` gained narrower sub-repo awareness for targeted verification during artifact clarification, without broad repo discovery by default.
