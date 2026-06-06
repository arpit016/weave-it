---
artifact: prd
status: draft
owner: product
created_at: 2026-06-06T09:44:33.000Z
updated_at: 2026-06-06T17:57:58.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: sessions
---

# Folder-Based Architecture Artifact And Template Kit PRD

## Problem Statement

Weave's architecture lane currently centers on a single `architecture.md` artifact and the `weave-architect` skill still contains instructions for creating or revising that file. That model creates two related problems.

First, `weave-architect` mixes two jobs: it acts as an engineering thinking partner in Plan Mode, but its instructions also tell it to write durable architecture content. This contradicts the emerging Weave skill separation where `weave-architect` should gather context, interview the user, and dissect engineering decisions, while `weave-capture` is the skill responsible for writing durable artifacts from the discussion.

Second, a single `architecture.md` does not scale well for complex changes. In workspace or multi-system work, a design may need separate durable sections for schema design, API contracts, frontend-backend integration, migrations, operations, or other user-defined facets. Users should be able to customize those facet structures without editing the skill instructions themselves.

Today, users who want richer architecture structure must either keep expanding one long file or modify `weave-architect/SKILL.md`, which makes skill updates harder and blurs the boundary between reusable agent behavior and user-owned document structure.

## Goals

- Make `weave-architect` a strictly read-only architecture thinking skill that never creates or edits files.
- Introduce a folder-based architecture artifact shape for new changes: `architecture/index.md` plus optional facet files.
- Let users add architecture facet templates without modifying `SKILL.md`.
- Make `weave-capture` responsible for turning architecture discussions into durable architecture files using the available templates when present.
- Make `weave-clarify` responsible for restructuring existing architecture facets when the user asks to split, merge, rename, delete, or migrate architecture content.
- Preserve legacy single-file `architecture.md` changes without automatic migration.
- Keep lifecycle progress lane-atomic: architecture remains one artifact lane even when represented by multiple files.
- Preserve the natural-language skill UX; do not add new CLI flags for facet targeting or migration.
- Make `weave-issues` perform the downstream coverage and consistency check before task writing, so flexible or partial architecture capture does not silently under-scope implementation work.

## Non-Goals

- Implementing workspace-mode multi-repo context gathering for architect/capture/clarify. That is a follow-up change.
- Adding per-facet lifecycle or stale flags to `status.yml`.
- Auto-migrating existing `architecture.md` files to folder shape.
- Adding CLI flags such as `--facet`, `--new-facet`, or `--migrate-to-folder`.
- Extending facet templates to PRD or exploration lanes.
- Replacing `weave-capture`'s session-note model with one session note per facet.
- Requiring every architecture topic to have a matching template before it can be captured.

## Actors

- **Weave user**: discusses architecture, adds custom architecture templates, and invokes skills through natural language.
- **Agent running `weave-architect`**: reads context, interviews the user, suggests architecture improvements, and produces a structured dissection in chat without writing files.
- **Agent running `weave-capture`**: creates session notes, loads architecture templates, routes durable content to the right architecture files, and updates lifecycle state.
- **Agent running `weave-clarify`**: refines or restructures existing architecture artifacts without creating a new architecture from scratch.
- **Agents or skills that read architecture as supporting context**: consume architecture artifacts when generating issues, updating knowledge, resuming work, or deciding next steps.
- **Weave CLI / skill installer**: installs bundled skill files and user-customizable template resources while preserving user edits.

## Current Behavior

`weave-architect` currently treats `architecture.md` as a living technical artifact. Its instructions include a Plan Mode Guard, but they also contain sections for `Output Path`, `Lifecycle Progress`, an embedded `Architecture Template`, and completion language for creating or revising `architecture.md`. This makes the skill both a design interviewer and a writer.

`weave-capture` currently owns discussion capture and live artifact merging. Its instructions already state that a completed Plan Mode `weave-architect` discussion is valid source material for the first architecture draft, but the live artifact target is still a single file:

```text
architecture -> wiki/changes/<change-id>/architecture.md
```

`weave-clarify` currently refines one existing artifact and also assumes architecture is a single `architecture.md` file.

Other Weave skills and downstream agents may also read architecture as supporting context by looking only for:

```text
wiki/changes/<change-id>/architecture.md
```

Those readers can miss folder-mode architecture unless they learn the same artifact-shape detection rule. A folder-shaped architecture artifact affects every skill that reads architecture, not only the skills that write it.

The PRD template has already moved to a sibling `prd-template.md` file in the `weave-prd` skill, but architecture still embeds its document structure inside `weave-architect/SKILL.md`.

## Proposed Product Behavior

New architecture artifacts should use a folder shape:

```text
wiki/changes/<change-id>/architecture/
  index.md
  schema.md
  api-contract.md
  frontend-backend.md
  <user-defined-facet>.md
```

`architecture/index.md` is the preferred entry point for the architecture lane. It carries the architecture artifact lifecycle frontmatter when present and summarizes the design, cross-cutting decisions, open questions, and links to facet files. If a change only needs a small architecture, `index.md` alone is enough.

Folder-mode architecture should be flexible rather than index-gated. The architecture lane is considered substantive when `architecture/index.md` is substantive or any facet file under `architecture/*.md` is substantive. If only facet files are substantive, reader skills should treat the architecture as usable but partial, and should say that they are relying on facet-level context rather than a complete index summary.

Legacy changes that already have `architecture.md` continue to use that file. Skills should auto-detect the current shape:

- If only `architecture.md` exists, use file mode.
- If only `architecture/` exists, use folder mode.
- If both exist, stop and report a shape conflict. The user can resolve it with an explicit `weave-clarify architecture` migration request.

`weave-architect` becomes strictly read-only. It reads PRD context, existing architecture files, architecture session notes, decisions, contracts, workspace-level knowledge, repo documentation, and source code as needed. It does not read architecture templates and does not write files. A topic argument like `weave-architect schema` or `weave-architect cache-strategy` scopes the interview only; it is not validated against a template registry.

`weave-capture` becomes the architecture writer. When capturing architecture content, it loads available architecture templates, decides which files are affected, writes session notes, creates or revises architecture files, updates `architecture/index.md` where needed, and runs lifecycle progress.

`weave-clarify` becomes the structural refinement tool for architecture. It can split content out of an existing facet, merge facets, rename facets, delete facets, migrate a legacy `architecture.md` into folder shape, and update the index. It should also handle these requests when the user's current ambient lane is something else, as long as the user explicitly invokes the architecture target.

Every Weave skill that reads architecture as input should use the same architecture artifact resolver instead of hardcoding `wiki/changes/<change-id>/architecture.md`. Reader skills do not need to write folder-mode architecture, but they must be able to consume either legacy file mode or folder mode. In folder mode, readers should prefer `architecture/index.md` as the entry point when it is substantive and load facet files when the task requires deeper technical context. When the index is missing or thin but facets are substantive, readers may still use the facet content while reporting that architecture context is partial.

Architecture templates should be direct skill resources beside `weave-architect/SKILL.md`, not nested under a `templates/` directory. The default resource shape is:

```text
weave-architect/
  SKILL.md
  index-template.md
  schema-template.md
  api-contract-template.md
  frontend-backend-template.md
```

This keeps the architecture template kit aligned with the existing direct-child skill-resource installer behavior and avoids adding nested resource semantics.

## User Workflows

### Workflow: User starts architecture discussion

1. User invokes `weave-architect`.
2. Architect reads the active change's PRD, existing architecture artifact shape, architecture sessions, and relevant codebase context.
3. Architect interviews the user and suggests better architecture flow, tradeoffs, risks, and design decomposition.
4. Architect returns a structured discussion summary in chat.
5. Architect writes nothing.

### Workflow: User deep-dives on a topic

1. User invokes `weave-architect schema`, `weave-architect api-contract`, or another free-form topic.
2. Architect treats the topic as interview focus.
3. If an existing architecture facet file with a related name exists, architect may read it as current context.
4. Architect still raises cross-cutting concerns when the discussion affects other parts of the design.
5. Capture later decides where durable content belongs.

### Workflow: User captures architecture discussion

1. User invokes `weave-capture architecture` or bare `weave-capture` when the discussion is clearly architectural.
2. Capture writes one architecture session note.
3. Capture analyzes the discussion and available templates.
4. If the content matches an installed `<facet>-template.md`, capture creates or revises `architecture/<facet>.md` using that template.
5. If the content has no matching template but fits an existing facet, capture merges it into that facet.
6. If the content is cross-cutting or small, capture writes it into `architecture/index.md`.
7. If the user explicitly asked for a separate facet and no template exists, capture creates `architecture/<name>.md` using the discussion content without synthesizing a template structure.
8. Capture updates `architecture/index.md` to reflect changed facets and cross-cutting questions.
9. Capture runs architecture lifecycle progress once for the lane.

### Workflow: User adds a custom template

1. User adds a file such as `api-contract-template.md` or `cache-strategy-template.md` directly under the installed `weave-architect/` skill folder.
2. The user does not modify `weave-architect/SKILL.md`.
3. Future captures and clarifications discover the template by filename convention.
4. When relevant content is captured, the matching facet file is created or revised using that template.
5. User-added templates survive normal skill updates.

The installed files live directly beside `SKILL.md`; users add `cache-strategy-template.md` or other custom templates as direct child files in the installed `weave-architect` skill folder.

### Workflow: User creates a facet without a template

1. During discussion or capture, user explicitly says a topic should become its own facet.
2. Capture finds no matching `<facet>-template.md`.
3. Capture creates `architecture/<facet>.md` with the discussion content as-is.
4. Capture does not invent a generic skeleton or fabricated headings.
5. If the user later wants structure for that facet, they can add a matching template for future updates.

### Workflow: User restructures architecture after issues work

1. User may be working in another lane, such as issues.
2. User invokes `weave-clarify architecture` and asks to split part of an existing facet into a new facet.
3. Clarify reads the architecture artifact shape and affected files.
4. Clarify performs the requested structural change, updates the index, and reports follow-up artifacts if implementation tasks may be stale.
5. The ambient lane does not prevent architecture clarification because the explicit target wins.

### Workflow: User migrates legacy architecture

1. Active change has `architecture.md` and no `architecture/` folder.
2. User explicitly asks `weave-clarify architecture` to migrate it to folder shape.
3. Clarify creates `architecture/index.md` and any user-requested facets.
4. Clarify removes or supersedes the old file according to the migration plan.
5. No automatic migration happens without the user's explicit request.

### Workflow: A downstream skill reads architecture context

1. User invokes a skill such as `weave-issues`, `weave-knowledge`, `weave-next`, `weave-capture`, or `weave-clarify`.
2. The skill needs architecture context to answer the request.
3. The skill resolves the architecture artifact shape for the active change.
4. If `architecture.md` exists and `architecture/` does not, the skill reads the legacy file.
5. If `architecture/` exists and `architecture.md` does not, the skill reads `architecture/index.md` first and then reads relevant facet files as needed.
6. If both shapes exist, the skill reports the shape conflict instead of ignoring one side.

### Workflow: Weave issues verifies implementation coverage

1. User invokes `weave-issues` after PRD and architecture context exist.
2. `weave-issues` resolves architecture using the shared shape rule.
3. `weave-issues` reviews PRD workflows, user stories, acceptance criteria, and edge cases against the proposed task breakdown.
4. `weave-issues` reviews architecture decisions, affected systems, migrations, rollout notes, risks, and testing expectations against the proposed task breakdown.
5. `weave-issues` checks PRD and architecture for obvious contradictions before writing tasks.
6. If coverage gaps or PRD/architecture mismatches exist, `weave-issues` reports them and asks whether to add tasks, defer the gap, return to architecture clarification, or proceed with known gaps.
7. Only after this coverage and consistency review does `weave-issues` write or reconcile `tasks.md`.

## User Stories

1. As a Weave user, I want `weave-architect` to be a read-only thinking partner, so that architecture interviews do not unexpectedly mutate artifacts.
2. As a Weave user, I want architecture to be representable as a folder, so that complex designs can be split into coherent facet files.
3. As a Weave user, I want `architecture/index.md` to summarize the full architecture, so that the design remains approachable even when several facet files exist.
4. As a Weave user, I want to add custom architecture templates without editing `SKILL.md`, so that my local architecture workflow survives skill updates.
5. As a Weave user, I want `weave-capture` to decide where architecture discussion belongs, so that I do not have to rigidly specify every affected facet.
6. As a Weave user, I want capture to create a separate facet file when I explicitly ask for one, even if no template exists, so that I can organize emerging architecture topics naturally.
7. As a Weave user, I want capture to avoid inventing template structure when no template exists, so that generated files reflect the discussion rather than hidden defaults.
8. As a Weave user, I want `weave-clarify architecture` to split, merge, rename, delete, or migrate facets, so that architecture artifacts can evolve as understanding improves.
9. As a Weave user working in another lane, I want to explicitly invoke architecture capture or clarification, so that I can fix architecture structure without switching workflow state manually.
10. As a Weave user with an older change, I want existing `architecture.md` files to keep working, so that old work is not broken by the new folder shape.
11. As a Weave user, I want architecture session notes to record affected facets, so that future resume logic can focus on relevant context without creating one note per facet.
12. As a Weave user, I want any skill that reads architecture context to understand both `architecture.md` and `architecture/`, so that folder-mode architecture does not disappear from downstream workflows.
13. As a Weave user, I want `weave-issues` to verify PRD coverage and architecture consistency before writing tasks, so that flexible architecture capture does not miss implementation work.

## Functional Requirements

- The system should use `architecture/` folder shape for new architecture artifacts.
- The system should use `architecture/index.md` as the canonical entry point for folder-shaped architecture.
- The system should support optional facet files under `architecture/<facet>.md`.
- The system should preserve legacy single-file `architecture.md` behavior when that is the only architecture artifact shape present.
- The system should treat simultaneous `architecture.md` and `architecture/` as a shape conflict and stop with a clear message.
- The system should not auto-migrate `architecture.md` to folder shape.
- The system should allow explicit user-requested migration through `weave-clarify architecture`.
- `weave-architect` should never create, update, delete, rename, or move files.
- `weave-architect` should read existing change context and codebase context needed to support architecture interview and recommendations.
- `weave-architect` should not read architecture templates.
- `weave-architect <topic>` should treat `<topic>` as free-form interview focus.
- `weave-capture` should load architecture templates only when capturing or revising architecture content.
- The architecture template kit should live under the `weave-architect` skill resources.
- Architecture template resources should be direct child files beside `SKILL.md`, not nested under `weave-architect/templates/`.
- Templates should be discovered by strict filename convention: `<facet>-template.md`.
- Template files should include frontmatter with `facet: <id>` and `description: <one-line>`.
- The system should ship default templates for `index`, `schema`, `api-contract`, and `frontend-backend`.
- User-added template files should be preserved by skill install/update flows.
- `weave-capture` should create or revise matching facet files when discussion content maps to an available template.
- `weave-capture` should merge no-template content into existing architecture files where it fits.
- `weave-capture` should write cross-cutting or small architecture content into `architecture/index.md`.
- `weave-capture` should create a new facet file without a template only when the user explicitly asks for a separate facet.
- When creating a no-template facet, capture should use the discussion content without synthesizing a generic template structure.
- `weave-capture` should update `architecture/index.md` when it creates, revises, splits, merges, renames, or deletes facets.
- `weave-capture` should surface cross-facet contradictions in `architecture/index.md` Open Questions, but should not block writes solely because a contradiction exists.
- `weave-clarify architecture` should support structural refactor primitives: create facet, split content, merge facets, rename facet, delete facet, move content, update index.
- `weave-clarify architecture` should be able to operate even when the user's prior lane was not architecture, as long as the invocation explicitly targets architecture.
- Architecture session notes should stay lane-level: one session note per capture.
- Architecture session-note frontmatter should add `facets: [...]` listing the facets durably touched by the discussion.
- Legacy architecture session notes without `facets:` should be treated as lane-level notes relevant to all facets.
- Resume logic should be able to filter architecture session notes by facet using the `facets:` frontmatter.
- Per-facet resume filtering should use each facet file's filesystem mtime as the per-facet updated timestamp proxy.
- Architecture lifecycle progress should remain lane-atomic. One capture or clarify operation should run one `weave change progress architecture ...` command regardless of how many architecture files changed.
- The system should not add new CLI flags for facet targeting, new-facet creation, or migration.
- Skills that read architecture as supporting context should use shared artifact-shape resolution instead of hardcoding `wiki/changes/<change-id>/architecture.md`.
- Reader skills should treat `architecture/index.md` as the folder-mode entry point.
- Reader skills should read facet files only when deeper architecture context is needed for their task.
- Reader skills should report the same shape-conflict error when both `architecture.md` and `architecture/` exist.
- Folder-mode architecture should be considered substantive when `architecture/index.md` is substantive or any `architecture/*.md` facet file is substantive.
- If only facet files are substantive, reader skills should treat architecture as usable but partial and report that distinction.
- The shared architecture artifact resolver should expose enough detail for readers to distinguish file mode, folder mode, conflict mode, missing mode, substantive index, and substantive facets.
- `weave-issues` should perform a PRD-to-tasks coverage review before writing tasks.
- `weave-issues` should perform an architecture-to-tasks coverage review before writing tasks.
- `weave-issues` should perform a PRD-to-architecture consistency review before writing tasks.
- If coverage gaps or PRD/architecture mismatches are found, `weave-issues` should ask the user whether to add tasks, defer scope, return to architecture clarification, or proceed with known gaps before writing `tasks.md`.

## Permissions and Access Control

No new permission model is required. Architecture templates are local skill resource files. Users with filesystem access to their installed skill directory can add, edit, or remove templates.

The only important access distinction is behavioral: `weave-architect` has read-only responsibility by skill contract, while `weave-capture` and `weave-clarify` are allowed to write selected artifacts when invoked by the user.

## States and Lifecycle

The architecture lane remains a single lifecycle artifact in `status.yml`, even when represented as a folder.

Architecture artifact shape can be one of:

- **Legacy file mode**: `architecture.md` exists and `architecture/` does not.
- **Folder mode**: `architecture/` exists and contains `index.md` or one or more facet files; `architecture.md` does not.
- **Conflict mode**: both `architecture.md` and `architecture/` exist. Skills should stop and ask the user to resolve or migrate.
- **Missing mode**: neither `architecture.md` nor substantive folder-mode architecture content exists. Capture can create folder mode when enough architecture discussion exists.

Valid transitions:

- Missing mode → folder mode through `weave-capture architecture`.
- Legacy file mode → folder mode only through explicit `weave-clarify architecture` migration.
- Folder mode → revised folder mode through capture or clarify. Folder mode may begin with a substantive facet before the index becomes substantive.
- Conflict mode → file or folder mode through user-directed cleanup.

Lifecycle progress remains:

```text
weave change progress architecture --source <sources> --json
```

The lane is progressed once per successful architecture artifact update.

## Notifications and Visibility

No product notifications are required.

Skill completion responses should clearly report:

- the session note written
- every architecture file created, revised, renamed, moved, or deleted
- whether lifecycle progress succeeded
- any advisory contradictions or open questions surfaced
- any likely follow-up artifacts such as PRD, tasks, or issues

## Edge Cases

- **Both `architecture.md` and `architecture/` exist**: stop with a clear shape-conflict message. Do not guess which is canonical.
- **No architecture artifact exists**: capture can create `architecture/index.md` when the discussion contains enough durable architecture content.
- **Template exists but facet file does not**: capture may create `architecture/<facet>.md` using the matching template.
- **Facet file exists but template does not**: capture and clarify may still revise the existing file while preserving its current structure.
- **User asks for a new facet with no template**: create the facet file using discussion content as-is; do not invent a skeleton.
- **Discussion touches multiple facets**: capture can update multiple files and write one lane-level session note with `facets: [...]`.
- **Discussion touches no durable architecture content**: capture should write a session note if useful and avoid creating or changing live artifacts.
- **Legacy session note lacks `facets:`**: treat it as relevant to all facets during resume filtering.
- **Template frontmatter conflicts with filename**: prefer a clear error or warning before writing; do not silently route to an unexpected facet.
- **User-added template file is not named `<facet>-template.md`**: ignore it as a template resource.
- **Cross-facet contradiction detected**: record it in the index's Open Questions or an equivalent section and proceed unless the contradiction blocks safe writing.
- **Ambient lane is different from architecture**: explicit invocation target wins; capture/clarify can still operate on architecture.
- **Existing `architecture.md` migration requested**: clarify should preserve content and make the migration explicit in revision history.
- **Reader skill only knows `architecture.md`**: the skill must be updated before folder mode ships, otherwise it can silently miss architecture context. Reader updates are part of this change's compatibility work.
- **Folder-mode architecture has many facet files**: reader skills should start with `architecture/index.md` and load only relevant facets to avoid unnecessary context use.
- **Folder-mode architecture has thin index but substantive facets**: reader skills may use the facet content, but should report architecture as partial and avoid pretending the index summarizes the whole design.
- **`weave-issues` finds PRD behavior with no task coverage**: it should surface the missing coverage before writing and let the user add tasks, defer, or proceed explicitly.
- **`weave-issues` finds architecture work with no task coverage**: it should surface the missing technical coverage before writing and let the user add tasks, defer, or proceed explicitly.
- **`weave-issues` finds PRD/architecture mismatch**: it should ask whether the PRD or architecture should be clarified before tasks are written, unless the user explicitly accepts the mismatch as known follow-up.

## Acceptance Criteria

- [ ] New architecture artifacts are created as `wiki/changes/<change-id>/architecture/index.md`.
- [ ] Folder-mode architecture can include facet files such as `schema.md`, `api-contract.md`, and `frontend-backend.md`.
- [ ] Existing changes with only `architecture.md` continue to be read and revised in file mode.
- [ ] Skills stop with a clear error when both `architecture.md` and `architecture/` exist.
- [ ] `weave-architect` no longer contains instructions to write architecture artifacts or run lifecycle progress.
- [ ] `weave-architect` no longer embeds the architecture template structure.
- [ ] `weave-architect` never reads `weave-architect/templates/*-template.md`.
- [ ] `weave-architect <topic>` focuses the interview without requiring a matching template.
- [ ] Default architecture templates are bundled for `index`, `schema`, `api-contract`, and `frontend-backend`.
- [ ] Skill install/update installs direct child architecture template resources and preserves user-added or user-modified template files.
- [ ] Capture discovers templates by `<facet>-template.md` convention.
- [ ] Capture creates or revises a matching facet file when a matching template exists.
- [ ] Capture merges no-template content into existing architecture files where appropriate.
- [ ] Capture writes cross-cutting architecture content to `architecture/index.md`.
- [ ] Capture creates a no-template facet only when explicitly requested by the user.
- [ ] Capture does not synthesize generic headings for a no-template facet.
- [ ] Clarify can split, merge, rename, delete, and move architecture facet content.
- [ ] Clarify can migrate legacy `architecture.md` to folder shape when explicitly requested.
- [ ] Architecture session notes include `facets: [...]` when relevant.
- [ ] Legacy architecture session notes without `facets:` remain valid.
- [ ] Lifecycle progress for architecture remains lane-atomic.
- [ ] No new CLI flags are added for facet routing or migration.
- [ ] Skills that read architecture context no longer assume only `wiki/changes/<change-id>/architecture.md`.
- [ ] Reader skills can consume legacy file mode and folder mode through the same shape-detection rule.
- [ ] In folder mode, reader skills load `architecture/index.md` as the entry point and load facet files only when needed.
- [ ] Folder-mode architecture is treated as substantive when either `architecture/index.md` or at least one facet file is substantive.
- [ ] Reader skills report partial architecture when only facet files are substantive.
- [ ] `weave-issues` previews PRD coverage, architecture coverage, and PRD/architecture consistency before writing `tasks.md`.
- [ ] `weave-issues` asks for user direction before writing tasks when coverage gaps or PRD/architecture mismatches are detected.

## Rollout Considerations

This is a template, skill-behavior, reader-compatibility, and skill-installer change. Existing changes with `architecture.md` remain valid. New changes should use the folder shape when architecture is first captured.

Users who customize installed templates should expect update flows to preserve their edits. Users who want to customize new architecture facets should add new direct child `<facet>-template.md` files beside the installed `weave-architect/SKILL.md` instead of modifying `SKILL.md`.

Any skill that reads architecture as context must be audited before release. At minimum, `weave-issues`, `weave-knowledge`, `weave-next`, `weave-capture`, and `weave-clarify` should stop hardcoding `architecture.md` and use the shared shape-detection behavior.

`weave-issues` should be treated as the downstream consistency gate. Flexible architecture capture may produce partial architecture, but task generation must explicitly verify PRD coverage, architecture coverage, and PRD/architecture sync before writing implementation tasks.

The `weave-architect` portion of the existing workspace-aware skills wording change is superseded by this change. The workspace-mode multi-repo context-gathering behavior is deliberately deferred to a follow-up change.

## Analytics and Success Metrics

No product analytics are required.

Success can be measured by:

- users can complete architecture interviews without accidental file writes from `weave-architect`
- capture can create folder-mode architecture artifacts from architecture discussions
- users can add custom templates without editing skill instructions
- legacy `architecture.md` changes continue to work
- downstream skills continue to find architecture context after folder mode ships
- `weave-issues` catches missing PRD or architecture coverage before task writing
- tests cover installer preservation, capture routing, clarify restructuring, and session-note facet metadata

## Revision History

- 2026-06-06: Initial PRD generated from architecture-folder discussion and PRD session capture. Exploration was intentionally skipped by user direction.
- 2026-06-06: Added downstream reader impact for skills that currently read only `wiki/changes/<change-id>/architecture.md`.
- 2026-06-06: Clarified flat architecture template resources, index-or-facet architecture substance, and `weave-issues` coverage/sync gate behavior.

## Assumptions

- `weave-capture` remains the only skill that promotes discussion into live artifacts by default.
- `weave-clarify` is the right skill for pure architecture restructuring when no new architecture discussion needs to be captured.
- `architecture/index.md` can carry the lifecycle frontmatter for the architecture lane without changing `status.yml`.
- File modification time is acceptable as the per-facet resume timestamp proxy for v1.
- User-added template files live as direct child files in the installed `weave-architect` skill folder and are protected by the same user-edit preservation model as PRD templates.
- Natural-language skill invocation is sufficient for facet targeting and migration requests.
- `weave-issues` is the right place to enforce strong downstream implementation coverage because that is when architecture is converted into concrete work.

## Open Questions

None. All product-level decisions raised during discovery were resolved.

## Out of Scope

- Workspace-mode multi-repo context gathering for architecture skills.
- Per-facet lifecycle/stale state in `status.yml`.
- Automatic migration of existing `architecture.md` files.
- CLI flags for facet targeting or migration.
- Facet templates for PRD or exploration lanes.
- One session note per architecture facet.

## Further Notes

The architecture follow-up should design the technical implementation in detail, especially:

- the artifact-shape detection helper shared by capture and clarify
- the direct-child installer/resource-management behavior for architecture templates
- exact default template contents
- capture's routing heuristics
- clarify's structural refactor behavior
- compatibility with downstream consumers such as `weave-issues`, `weave-knowledge`, and `weave-next`
- `weave-issues` coverage and consistency review behavior
