# Knowledge Delta

## Durable Behavior Changes

- `weave-issues` is now scope-aware at the skill level: `weave-issues <scope>` treats `<scope>` as a free-form planning and ownership label, with examples such as `backend`, `frontend`, and `full-stack`.
- Scope is current task metadata and explicitly is not a repo name, architecture facet name, technical layer, lifecycle lane, or artifact target.
- Scoped task generation still preserves tracer-bullet behavior. Scoped runs may propose `Scope: full-stack` when the smallest independently-verifiable behavior crosses backend and frontend boundaries.
- Generated `T#` tasks now carry implementation-location metadata: `Scope`, `Primary repo`, `Repos`, `Architecture refs`, and `Coordination`.
- Multi-repo tasks and ambiguous-location tasks may include `### Repo Involvement` with repo role, likely code anchors, and test/verification anchors. This section is guidance only and must not include per-repo statuses or become subtask tracking.
- Scoped reruns preserve unrelated scope tasks unless a direct conflict is discovered, reconcile matching-scope tasks, and stop before writing if scoped plans conflict with another scope's task or architecture assumption.
- `weave-issues` still writes only `wiki/changes/<change-id>/tasks.md`; it does not create `tasks/<repo>/tasks.md`, per-repo task artifacts, rigid scope legends, or new lifecycle lanes.

## Affected Knowledge Areas

- Domain: `change-workflow`
- Feature: `weave-issues`

## Knowledge Files Updated

- `wiki/knowledge/domains/change-workflow/features/weave-issues/behavior.md`

## No-Impact Rationale

Not applicable. This change has durable behavior impact for the `weave-issues` skill and the canonical `tasks.md` shape.

## Source Evidence

- PRD: `wiki/changes/260607-ycuo-workspace-aware-issues/prd.md`
- Architecture: `wiki/changes/260607-ycuo-workspace-aware-issues/architecture/index.md`
- Tasks and verification: `wiki/changes/260607-ycuo-workspace-aware-issues/tasks.md`
- Canonical skill: `templates/skills/weave-issues/SKILL.md`
- Installed skill copies: `.agents/skills/weave-issues/SKILL.md`, `.claude/skills/weave-issues/SKILL.md`
- Tests: `tests/agent-skills.test.ts`

## Follow-Up Knowledge Work

- None currently known.
