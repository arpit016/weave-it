---
artifact: knowledge-delta
status: draft
owner: engineering
created_at: 2026-06-04T19:59:23.000Z
updated_at: 2026-06-04T19:59:23.000Z
source: tasks.md
---

# Knowledge Delta

## Durable Behavior Changes

- Weave skill templates now use the cwd-dispatched workspace-or-repo context model when resolving change artifacts.
- In workspace mode, skills treat the workspace root as the single change context and registered `repos[]` as implementation locations, not separate artifact targets.
- `weave-explore`, `weave-prd`, `weave-architect`, and `weave-clarify` no longer depend on `weave workspace --json` returning populated `folders[]`.
- `weave-prd` and `weave-architect` completion guidance now distinguishes multiple repo-mode contexts from workspace mode's single root context.

## Affected Knowledge Areas

- Domain `change-workflow`, domain-wide behavior `workspace-aware-skill-context`.

## Knowledge Files Updated

- `wiki/knowledge/domains/change-workflow/domain-wide/workspace-aware-skill-context.md` — added current-state rules for how skills interpret `weave workspace --json` in workspace mode and repo mode.
- `wiki/knowledge/domains/change-workflow/index.md` — linked the new domain-wide behavior.

## No-Impact Rationale

Not applicable. The change updates durable agent skill behavior and current-state knowledge.

## Source Evidence

- CLI context resolution: `src/lib/workspace-mode.ts`, `src/lib/show-workspace.ts`, `src/lib/changes.ts`.
- Reference skill wording already compatible with workspace mode: `templates/skills/weave-new/SKILL.md`, `templates/skills/weave-next/SKILL.md`.
- Updated skill templates: `templates/skills/weave-explore/SKILL.md`, `templates/skills/weave-prd/SKILL.md`, `templates/skills/weave-architect/SKILL.md`, `templates/skills/weave-clarify/SKILL.md`.
- Sanity-checked skill templates without stale folder-iteration matches: `templates/skills/weave-capture/SKILL.md`, `templates/skills/weave-knowledge/SKILL.md`, `templates/skills/weave-issues/SKILL.md`, `templates/skills/weave-new/SKILL.md`, `templates/skills/weave-next/SKILL.md`.

## Follow-Up Knowledge Work

- None for this change.
