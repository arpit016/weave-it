# Architecture Artifacts

## Purpose

Define how the architecture lane is represented on disk and how Weave code and skills resolve architecture context for a change.

## Current Behavior

The architecture lane is one lifecycle lane in `status.yml`, but it can be stored in either legacy file mode or folder mode:

- Legacy file mode: `wiki/changes/<change-id>/architecture.md`
- Folder mode: `wiki/changes/<change-id>/architecture/index.md` plus optional direct child facet files such as `architecture/schema.md`, `architecture/api-contract.md`, or user-defined facets

New architecture artifacts prefer folder mode. Legacy `architecture.md` changes remain valid and are not migrated automatically.

`architecture/index.md` is the folder-mode entry point and overview. A folder-mode architecture can still be substantive when `index.md` is missing or thin if at least one direct child facet file contains substantive content. Reader skills may use facet-only context, but should treat it as partial architecture context.

## Domain Model

Architecture artifact resolution has four states:

- `missing`: neither `architecture.md` nor `architecture/` exists
- `file`: only `architecture.md` exists
- `folder`: only `architecture/` exists
- `conflict`: both `architecture.md` and `architecture/` exist

Folder mode tracks:

- `indexPath`: `architecture/index.md`
- `indexExists`: whether the index file exists
- `indexSubstantive`: whether the index has meaningful markdown content
- `facetPaths`: direct child markdown files under `architecture/` except `index.md`
- `substantiveFacetPaths`: facet files with meaningful markdown content
- `substantive`: `indexSubstantive || substantiveFacetPaths.length > 0`
- `partial`: `!indexSubstantive && substantiveFacetPaths.length > 0`

Markdown substance ignores frontmatter, headings, blank lines, and the scaffold marker `Not ready`.

## Behavioral Rules

- `architecture.md` and `architecture/` existing together is a shape conflict. Skills should report it instead of silently choosing one side.
- `index.md` is not treated as a facet.
- Folder mode only scans direct child markdown files under `architecture/`; nested folders are not part of the v1 architecture artifact shape.
- Architecture lifecycle progress remains lane-atomic. No per-facet lifecycle lane or source ID exists.
- `weave change progress issues` infers `architecture` as the source when file mode or folder mode is substantive.
- Non-substantive folder mode does not infer `architecture` as an issues source.
- Issue evidence scanning includes `architecture/index.md` and direct child facet files in folder mode.

## Integrations And Side Effects

- `weave-architect` reads architecture context but never writes or progresses the architecture lane.
- `weave-capture` writes new architecture artifacts in folder mode by default and uses available architecture templates when appropriate.
- `weave-clarify architecture` can restructure folder-mode architecture and can migrate legacy `architecture.md` to folder mode only when explicitly requested.
- Reader skills such as `weave-issues`, `weave-next`, and `weave-knowledge` consume both legacy file mode and folder mode.

## Source Anchors

- Resolver: `src/lib/architecture-artifact.ts`
- Lifecycle integration: `src/lib/changes.ts` (`resolveProgressSources`, issue evidence scanning)
- Skill templates: `templates/skills/weave-architect/SKILL.md`, `templates/skills/weave-capture/SKILL.md`, `templates/skills/weave-clarify/SKILL.md`, `templates/skills/weave-issues/SKILL.md`, `templates/skills/weave-next/SKILL.md`, `templates/skills/weave-knowledge/SKILL.md`
- Tests: `tests/architecture-artifact.test.ts`, `tests/changes.test.ts`, `tests/agent-skills.test.ts`

## Change History

- 2026-06-06 (change `260606-k0l6-architecture-folder`): introduced folder-mode architecture artifacts, the shared resolver, direct child facet files, conflict detection, partial folder-mode substance, and lifecycle source inference for folder-mode architecture.

## Open Questions

- Whether nested architecture facet folders should be supported later. v1 only supports direct child markdown facets.
