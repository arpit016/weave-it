# Knowledge Delta

## Durable Behavior Changes

- Architecture artifacts now support both legacy file mode (`architecture.md`) and folder mode (`architecture/index.md` plus direct child facet files). Folder mode is substantive when either the index or any facet file contains substantive markdown.
- `weave-architect` is now a read-only Plan Mode thinking partner. It sets local architecture artifact context, gathers technical context, interviews, and returns an architecture dissection without writing or progressing artifacts.
- `weave-capture` owns durable architecture writes. It writes architecture folder mode by default for new architecture artifacts, records architecture session `facets: [...]`, and uses direct child `weave-architect/*-template.md` resources when matching templates exist.
- `weave-clarify architecture` owns explicit architecture restructuring: create/split/merge/rename/delete facets, move content, update index, and migrate legacy `architecture.md` only on explicit user request.
- `weave-issues` treats PRD and architecture as optional sources, but when they exist it acts as a downstream coverage and consistency gate before writing tasks.
- Skill resources are direct child files beside `SKILL.md`; architect templates are installed, updated, reset, diffed, and preserved under the same resource rules as existing PRD and knowledge templates.

## Affected Knowledge Areas

- `change-workflow/domain-wide/architecture-artifacts`
- `change-workflow/domain-wide/lifecycle-progress-and-staleness`
- `change-workflow/domain-wide/plan-mode-guard`
- `change-workflow/features/weave-architect`
- `change-workflow/features/weave-capture`
- `change-workflow/features/weave-clarify`
- `change-workflow/features/weave-issues`
- `cli-distribution/features/skill-resources`

## Knowledge Files Updated

- `wiki/knowledge/domains/change-workflow/index.md`
- `wiki/knowledge/domains/change-workflow/domain-wide/architecture-artifacts.md`
- `wiki/knowledge/domains/change-workflow/domain-wide/lifecycle-progress-and-staleness.md`
- `wiki/knowledge/domains/change-workflow/domain-wide/plan-mode-guard.md`
- `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md`
- `wiki/knowledge/domains/change-workflow/features/weave-capture/behavior.md`
- `wiki/knowledge/domains/change-workflow/features/weave-clarify/behavior.md`
- `wiki/knowledge/domains/change-workflow/features/weave-issues/behavior.md`
- `wiki/knowledge/domains/cli-distribution/index.md`
- `wiki/knowledge/domains/cli-distribution/features/skill-resources/behavior.md`

## No-Impact Rationale

Not applicable. The change updates durable current-state behavior for architecture artifacts, skill responsibilities, lifecycle source inference, and skill resource management.

## Source Evidence

- PRD: `wiki/changes/260606-k0l6-architecture-folder/prd.md`
- Architecture: `wiki/changes/260606-k0l6-architecture-folder/architecture.md`
- Tasks: `wiki/changes/260606-k0l6-architecture-folder/tasks.md`
- Resolver: `src/lib/architecture-artifact.ts`
- Lifecycle integration: `src/lib/changes.ts`
- Skill templates: `templates/skills/weave-architect/SKILL.md`, `templates/skills/weave-capture/SKILL.md`, `templates/skills/weave-clarify/SKILL.md`, `templates/skills/weave-issues/SKILL.md`, `templates/skills/weave-next/SKILL.md`, `templates/skills/weave-knowledge/SKILL.md`
- Skill resources: `templates/skills/weave-architect/*-template.md`
- Tests: `tests/architecture-artifact.test.ts`, `tests/changes.test.ts`, `tests/agent-skills.test.ts`

## Follow-Up Knowledge Work

- Add deeper knowledge for `weave-next` and `weave-knowledge` if their behavior grows beyond reader compatibility with architecture folder mode.
