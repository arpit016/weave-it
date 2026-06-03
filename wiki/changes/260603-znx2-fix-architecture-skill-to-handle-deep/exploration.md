---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-03T17:27:32.022Z
updated_at: 2026-06-03T18:23:22.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Fix Architecture Skill To Handle Deep Architecture

## Topic

Extend the `weave-architect` skill so the `architecture` artifact can scale from a single file for small changes to a structured folder for larger, multi-system changes — without forcing one shape on every change. Make the content shape (sections, filenames) a team-customizable repo template rather than prose embedded in the skill. Clean up the skill responsibility split so design discussion (architect, Plan Mode) is cleanly separated from file persistence (capture/clarify, Agent Mode).

## Current Understanding

### The problem

The `architecture` artifact today is hard-coded to a single file at `wiki/changes/<id>/architecture.md`, with a 17-section template embedded directly inside `weave-architect`'s skill prose. For large, multi-system changes this becomes unwieldy: the largest live artifact in the repo (`260603-piln-...` at 680 lines) covers six cooperating systems in one file, and section-by-section navigation is awkward. There is also no way for an engineering team to customize the template — every change uses the same 17 sections in the same order. Finally, `weave-architect` itself is internally inconsistent: it carries a Plan-Mode Guard but also has `# Output Path` and `# Lifecycle Progress` sections that perform file writes and lifecycle mutation, so its mode story is muddy.

### Two coupled improvements

This change is two intertwined parts:

1. **File-or-folder shape**: the architecture artifact gains a folder shape (`wiki/changes/<id>/architecture/`) alongside the existing single-file shape. The agent decides per change based on signals; the user can pin shape via natural language.
2. **Template-as-files**: the content shape moves out of the skill prose into a customizable repo template at `.weave/architecture-template/`, with Weave-bundled defaults at `templates/architecture/`. Both single-file and folder shapes use this template.

The skill responsibility split is tightened to make these work cleanly:

- `weave-architect` stays in Plan Mode end-to-end. It discusses, interviews, decides shape, and *proposes* the artifact content. It never writes files and never calls `weave change progress`.
- `weave-capture` and `weave-clarify` are both folder-aware, template-driven Agent-Mode executors. Both can write one file or many. The split is by intent: `capture` persists fresh material (including structural changes like convert and collapse), `clarify` refines existing material (in-place amendments and deepens).

### Lane semantics unchanged

`status.yml.artifacts.architecture`, `stale.architecture`, source ID `architecture`, the source-dependency graph (`issues.sources: [architecture]`), and session naming (`sessions/*-architecture.md`) all remain. The only thing that varies on disk is the live artifact's shape.

## Open Questions

These are residual phase-1 details that don't block PRD progress but should be confirmed during implementation:

- Exact folder layout under `.weave/architecture-template/` — `single-file.md` at the root + `folder/<sections>.md` is the current bias; alternative is two symmetric subfolders.
- Whether "add a new section file to an existing folder" flows through `weave-capture` (treat as structural) or `weave-clarify` (single-file write). Current bias is capture.
- Exact contents and ordering of Weave's bundled `templates/architecture/folder/` — proposed set is ~12 files; final phrasing to be settled in phase 1.
- Whether `weave-clarify` accepts cross-cutting multi-file amendments in v1 or defers them to follow-up. Current bias is v1.
- Atomic write strategy for folder mode (temp dir + rename, vs. per-file with rollback). Implementation detail.

## Decisions

1. **Two valid shapes for the architecture artifact**: `architecture.md` (single file) or `architecture/` (folder). The lane identity, source-dependency graph, and staleness semantics are unchanged.
2. **Agent decides shape with user pin override**: the architect skill picks single vs folder based on signals — number of subsystems touched, schema+API+UI combined, phased rollout, projected size. It always explains its decision. Natural-language pins from the user (e.g. "use folder mode", "single file is fine") override.
3. **Template lives as scaffold `.md` files, not a manifest**. Bundled defaults at `templates/architecture/`; per-repo overrides at `.weave/architecture-template/`. Each scaffold file may carry optional frontmatter `purpose:`, `required:`, `order:` used by the agent for prompts, ordering, and substantive-content checks.
4. **Single-file is also template-driven**: no special-case "single-file template" inside the skill. Both shapes use external scaffolds, so teams can edit either or both.
5. **`weave-architect` becomes Plan-Mode-only**: no file writes, no lifecycle progress calls. The existing `# Output Path`, `# Lifecycle Progress`, `# Lifecycle Staleness Verification`, and embedded 17-section template all move out of its prose.
6. **`weave-capture` and `weave-clarify` are both folder-aware executors**: both read the active template, both can write one file or many. Split is by intent (persist vs refine), not file count.
7. **Lifecycle progress moves with the writers**: `weave change progress architecture` is called by capture and clarify, never by architect.
8. **Existing single-file architectures are left alone**: the 11 existing `architecture.md` files stay as-is. Conversion is opt-in via the architect's "convert to folder" proposal.
9. **Lane semantics unchanged**: `status.yml.artifacts.architecture`, `stale.architecture`, source ID `architecture`, `sessions/*-architecture.md` naming all preserved.
10. **Template-drift tracking is out of scope** for this change. It is punted to a follow-up Weave change that can borrow the existing `last_changed_in` / `weave agent update` machinery.
11. **Extending the same customizable-template pattern to PRD and exploration is out of scope**. CLI library code should be parameterized over artifact name so the future extension is cheap.

## Scenarios

### S1: Small bug-fix change

User invokes `weave-architect` for a one-module bug-fix change. PRD touches one subsystem, no schema changes, no phased rollout. Architect picks single-file mode and explains: "I'll generate this as a single-file architecture because the PRD touches one module and the design is straightforward. Reply with 'use folder mode' to switch." User accepts. Architect proposes the full `architecture.md` content in the conversation. User exits Plan Mode and asks to save; `weave-capture` writes `wiki/changes/<id>/architecture.md` using `.weave/architecture-template/single-file.md` as the scaffold.

### S2: Multi-system feature

User invokes `weave-architect` for a feature touching backend schema, public API, and frontend UI with a phased rollout. Architect picks folder mode and explains the signals. User accepts. Architect proposes content for each scaffold file in `.weave/architecture-template/folder/` (skipping any non-required files that aren't needed). User exits Plan Mode and asks to save; `weave-capture` scaffolds `wiki/changes/<id>/architecture/` atomically and writes each file.

### S3: Custom team template

A team customizes `.weave/architecture-template/folder/` to match their conventions — renames files, adds a `runbook.md`, removes `security.md`, edits per-file headings and guidance. Subsequent `weave-architect` runs in their repo respect the customized scaffold and propose content for the team's files, in the team's order, with the team's headings. Weave's bundled default is unaffected; future Weave updates to the default don't overwrite the team's local copy.

### S4: Mid-change deepen

A change already has `architecture/` with the team's default content. User asks `weave-architect`: "deepen the data model." Architect reads all of `architecture/` for context but focuses the interview on data ownership, schemas, migrations, and integrity rules. It proposes a rewritten `architecture/data-model.md` in the conversation. User exits Plan Mode and asks to apply; `weave-clarify` replaces that one file's content and runs lifecycle progress.

### S5: Convert single → folder

A change started as single-file `architecture.md` but has grown. User asks `weave-architect`: "convert this to folder mode." Architect reads the current `architecture.md`, proposes how its sections map to the team's `folder/` scaffold files (calling out anything that does not map cleanly), and produces the proposed per-file content in the conversation. User exits Plan Mode and asks to apply; `weave-capture` deletes `architecture.md`, scaffolds `architecture/`, writes the per-file content atomically.

### S6: Cross-cutting clarification

A change has `architecture/` with several files. User says: "we just decided the data model is per-tenant; update the architecture." `weave-clarify` reads the affected files (`data-model.md`, `security.md`, possibly `api-contracts.md`), amends each in place, and runs `weave change progress architecture` once after the multi-file update with verification.

### S7: Existing change with old artifact

A user opens a six-month-old change whose `architecture.md` was generated against the original 17-section template. They invoke `weave-clarify` to fix a typo. Clarify reads the file as-is (file mode is permanently supported), amends in place. No forced migration, no warning. The team's current template is irrelevant for this pre-existing artifact.

## Existing Behavior

The `architecture` lane today produces a single file `wiki/changes/<change-id>/architecture.md` from a 17-section template embedded in `templates/skills/weave-architect/SKILL.md` (lines ~384-549). The architect skill:

- Reads PRD + codebase + prior architecture sessions.
- Discusses tradeoffs and interviews the user when needed.
- Writes the file directly (lines ~347-357, `# Output Path`).
- Calls `weave change progress architecture` after writing (lines ~361-376).
- Carries the `# Lifecycle Staleness Verification` protocol (lines ~600-645).

It also carries a Plan-Mode Guard (lines ~17-35) that says "do not write repo-tracked artifacts directly" but is currently interpreted as "do not write during Plan Mode, do write after Plan Mode exit." This is the internal inconsistency the new model resolves by making architect never write at all.

`weave-capture` can already create a missing `architecture.md` from session notes when sessions contain enough engineering truth, and `weave-clarify` amends `architecture.md` in place. Both already call lifecycle progress. The new model extends both to be folder-aware.

Consumer skills (`weave-issues`, `weave-next`, `weave-knowledge`) read `architecture.md` as a single file today, and `weave-issues` blocks when `status.yml.stale.architecture` is set.

The repo's `wiki/knowledge/domains/change-workflow/index.md` declares each lane has "a single durable artifact," which becomes inaccurate once the architecture lane can be a folder. The "single durable artifact" wording will need a narrow correction.

The CLI library hard-codes the architecture filename via `artifactFileName("architecture") -> "architecture.md"` in `src/lib/artifact-metadata.ts`, and various code paths (`hasSubstantiveMarkdown`, the issue-URL scanner in `src/lib/changes.ts`, `setCurrentArtifact` in `src/lib/artifact-context.ts`) assume a single file. The lane ID, source ID, and staleness model are file-agnostic and stay unchanged.

## PRD Readiness

Ready. The exploration has converged on the shape of the change, the skill responsibility split, what is in and out of scope, and the high-level user scenarios. PRD work can begin from this exploration and the plan saved at `.cursor/plans/architecture-folder-mode_*.plan.md`.
