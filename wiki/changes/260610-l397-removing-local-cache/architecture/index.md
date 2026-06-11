---
artifact: architecture
facet: index
status: draft
owner: engineering
created_at: 2026-06-10T19:05:20.000Z
updated_at: 2026-06-10T19:05:20.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md, codebase, architecture discussion
---

# Removing Local Cache Architecture

## Decision Summary

- Active change routing moves from hidden local session fields to the resolved root branch.
- The valid active branch shape is `change/<change-id>` and it must point at an existing `wiki/changes/<change-id>/status.yml`.
- `weave change new` must require a git-backed resolved root so every new change can be activated by its branch immediately.
- `current_change` and `current_artifact` remain tolerated legacy fields in local session files, but routing code must not read them as authority.
- `weave artifact current`, `weave artifact current set`, and `weave artifact current clear` are removed instead of deprecated.
- Capture and resume flows use explicit user targets, visible artifacts, `status.yml`, and session notes rather than stored artifact-lane state.
- Durable lifecycle, artifact sources, stale lanes, and stale history stay in `status.yml` and keep their current source-aware propagation rules.

## System Context

- `src/lib/changes.ts` is the central active-change seam. `currentChange`, `statusChange`, `progressChange`, `clearChangeStaleness`, `knowledgeChange`, `activeChangeContext`, `listChanges`, `createChange`, and `switchChange` all currently interact with session-backed current change behavior.
- `src/lib/session-state.ts` owns the local session file shape and currently exposes helpers for `current_change` and `current_artifact`.
- `src/lib/artifact-context.ts` and `src/commands/artifact.ts` exist solely to read/write stored artifact-lane state.
- `src/cli.ts` registers `weave artifact` as a top-level command.
- Skill templates in `templates/skills/` currently mention `weave artifact current` and lane-commit commands.
- Current knowledge docs describe the old session-backed behavior and need to be updated after implementation.
- Tests in `tests/changes.test.ts` and `tests/agent-skills.test.ts` currently assert the old behavior and should become regression coverage for the new rules.

## Architecture Overview

The new routing model has two separate authorities:

- Change authority: the resolved root branch.
- Artifact authority: explicit user target plus live artifact/session context.

Active-change commands should first resolve the Weave context from `cwd`, preserving repo mode and workspace mode behavior. In workspace mode, this yields the workspace root, so registered sub-repo branches are implementation state and do not select the change artifact. Once the root is known, active-change resolution reads the git branch at that root and validates the matching change folder.

Artifact-lane state stops being a CLI-owned persisted concept. Skills should ask for an explicit capture target when needed and should inspect `status.yml`, live artifacts, and session notes for resume context.

## Facets

- `active-change-resolution.md`: Branch-derived active-change resolver, non-git creation refusal, JSON state shape, and affected `changes.ts` functions.
- `artifact-lane-removal.md`: Removal of the artifact command surface and local artifact-lane routing.
- `skill-contracts.md`: Skill template, installed skill, and knowledge-doc contract updates.
- `verification-rollout.md`: Test replacement plan, rollout order, and verification commands.

## Tradeoffs

- Keeping legacy session fields parseable avoids local-data migration risk and matches the PRD preference to leave old files untouched.
- Removing helper functions immediately gives a cleaner codebase but increases churn. The safer first pass is to remove all routing reads/writes, then delete unused helpers only when TypeScript confirms no imports remain.
- Removing `weave artifact` immediately breaks old automation, but keeping it would preserve the hidden routing concept this change is explicitly removing.
- Requiring git for `weave change new` removes non-git change creation but keeps active-change behavior coherent and testable.

## Risks And Open Questions

- Skill templates and installed skill copies may drift; tests should enforce the bundled template contract first.
- Some commands may still use `currentChange` transitively, so the resolver result shape must remain stable enough for `task prepare` and `slice rollup`.
- Existing tests were built around session-backed current state and need careful replacement rather than broad deletion.
- `weave doctor` currently reports active change from session state; its behavior must be aligned or it will keep surfacing stale local pointers.

## Capture Guidance

This architecture should be captured as folder-mode architecture. If clarified later, keep `architecture/index.md` as the entry point and refine the direct child facet files rather than creating a legacy `architecture.md`.
