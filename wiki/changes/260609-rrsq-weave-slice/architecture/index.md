---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-06-09T16:24:59.000Z
updated_at: 2026-06-09T18:30:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
sources: [discussion, codebase, sessions]
facet: index
---

# Weave Slice Architecture

## Decision Summary

- Introduce a per-change `task-slices/<NN>-<slug>/` folder model. Each slice is the unit of vertical (tracer-bullet) work, with its own narrative, FE/BE contracts, task list, and machine-readable status. See `slice-model.md`.
- Tasks within a slice are horizontal sub-units, grouped under per-repo headings. Cross-slice coordination happens at slice level via `status.yml.depends_on`; cross-slice task-level deps are disallowed in v1.
- Add `weave-fix` skill + `findings.md` artifact for bug-fix changes. Scope-growth handled by idempotent re-run of `weave-slices`. See `skill-ecosystem.md`.
- Hard-rename `weave-issues` to `weave-slices`; rename the artifact lane `issues` to `slices`. Deprecate `weave-prepare` entirely; its branch-prep responsibility folds into `weave-execute`.
- Update `weave-execute`, `weave-next`, `weave-clarify`, `weave-capture`, `weave-architect` to support the slice model and the `findings` lane. Skills run in dual mode for backwards compatibility with legacy flat `tasks.md` changes.
- A shared rollup library (`src/lib/sliceRollup.ts`) re-derives per-slice `task_summary`, slice `status`, and `task-slices/dependency-graph.md`. Every Weave writer calls it inline; `weave slice rollup` CLI handles non-skill writes. Harness-agnostic — no editor PostToolUse hooks. See `rollup-library.md`.
- AFK / HITL classification moves to per-task `Execution: afk | hitl`. `weave-execute` already pauses for HITL; the field rename preserves the behavior.

## System Context

### Today's model (flat `tasks.md`)

- One `wiki/changes/<id>/tasks.md` per change. Single file lists all tasks under `T#` IDs.
- `weave-issues` skill generates `tasks.md` from PRD + architecture.
- `weave-prepare` skill resolves selectors and calls `weave task prepare` CLI to checkout the change branch.
- `weave-execute` skill reads `tasks.md`, runs prepare, implements each task, updates statuses + verification notes.
- Change branches are change-level (one branch across all repos), not task-level or scope-level.

### Why this needs to change

- Multi-engineer collaboration on a single shared `tasks.md` creates predictable git-conflict thrash.
- Current `weave-issues` conflates vertical (cross-layer behavior) with horizontal (a single task's scope). No first-class home for tracer bullets spanning multiple tasks.
- Bug fixes follow the same shape as features today, adding product-discovery ceremony that isn't relevant to fixing a typo.
- External issue tracker integration doesn't exist; future-proofing without baking provider-specific code into Weave matters.

### Constraints

- Local-first, file-based, markdown-and-CLI. No service dependencies.
- Single source of truth in git. Derived state must be regenerable from primary state.
- Markdown over YAML where humans need to read it.
- Tolerate residual git conflicts as the price of multi-engineer collaboration on shared markdown.
- No external users; no migration ceremony required for old changes.

## Architecture Overview

The change introduces three architectural layers:

1. **Slice model** — per-change `task-slices/` folders with per-slice artifacts (`slice.md`, `contracts.md`, `tasks.md`, `status.yml`) and a change-level `dependency-graph.md`. Detailed in `slice-model.md`.
2. **Rollup library** — writer-derives derivation of `task_summary`, slice `status`, and `dependency-graph.md` via a shared library + CLI. No harness-specific hooks. Detailed in `rollup-library.md`.
3. **Skill ecosystem** — new `weave-fix` skill, hard rename `weave-issues` -> `weave-slices`, slice-aware `weave-execute` / `weave-next`, `findings` lane plumbing, dual-mode backwards compatibility. Detailed in `skill-ecosystem.md`.

```text
wiki/changes/<change-id>/
  exploration.md / prd.md / findings.md   (per change type)
  architecture/
    index.md          <- you are here
    slice-model.md
    rollup-library.md
    skill-ecosystem.md
  status.yml
  task-slices/
    dependency-graph.md   (auto-generated)
    <NN>-<slug>/
      slice.md / contracts.md / tasks.md / status.yml
```

## Facets

- `slice-model.md`: task-slices directory structure, `contracts.md` as slice-level technical contracts (not FE/BE-only), per-slice `status.yml` and `tasks.md` references with examples, `dependency-graph.md` section reference, AFK/HITL semantics.
- `rollup-library.md`: writer-derives rollup library, CLI surface, batched trigger boundaries, dependency-graph generation.
- `skill-ecosystem.md`: skill inventory and updates, bug-fix workflow, lifecycle frontmatter, dual-mode compatibility, branch model.

## Tradeoffs

- **Writer-derives vs editor PostToolUse hooks.** Chose writer-derives for harness-agnosticism. Tradeoff: manual edits outside Weave skills leave derived state stale until next skill invocation or `weave slice rollup`. See `rollup-library.md`.
- **Batched rollup vs per-write rollup.** Rollup runs once per `weave-execute` episode, not after every `tasks.md` write. Intermediate staleness reconverges at episode boundaries.
- **Markdown rollup vs YAML rollup for `dependency-graph.md`.** Chose markdown for human glanceability; per-slice `status.yml` files remain machine truth.
- **Stored 3 + derived 2 status vocab vs stored 5.** Chose stored 3 (`pending | in_progress | done`, rollup-derived) + derived 2 (`ready | blocked` in graph only).
- **Slice status fully rollup-derived (no manual override).** Cleanest; can add `status_override:` later if needed.
- **Per-task `Execution:` vs slice-level inheritance.** Chose per-task; a slice can mix mechanical and judgment-call tasks.
- **`weave-fix` produces slice folder, never flat `tasks.md`.** One mental model across all change types.
- **`findings.md` required for every fix, even trivial.** Consistency over ceremony.
- **Hard rename `weave-issues` -> `weave-slices` vs gradual deprecation.** Chose hard rename; no external users.
- **Drop `weave-prepare` skill entirely.** Branches are change-level; `weave-execute` already does prepare internally.
- **Cross-slice task deps disallowed vs allowed with `/` separator.** Disallow for v1; restructure slices instead.
- **Dual-mode dispatch vs migration tool vs hard cutover.** Dual mode is simple and doesn't orphan in-flight changes.
- **No dedicated `weave-findings` skill.** `weave-fix` + `weave-clarify findings` cover the surface.

## Risks And Open Questions

### Risks

- **Non-skill writes leave derived state stale.** Mitigation: `weave slice rollup` CLI; next Weave skill invocation re-derives.
- **Defensive parser bugs.** Mitigation: only overwrite when sections parse cleanly; leave previous value otherwise.
- **Cycle introduction in `depends_on`.** Mitigation: cycle detection + visible warning in `dependency-graph.md`.
- **Stale `dependency-graph.md` between skill invocations.** Acceptable; recovery is one CLI invocation.
- **Dual-mode code paths in `weave-execute` / `weave-next`.** Mitigation: clear detection logic at top of each skill.

### Open questions

- **Defensive parser exact heuristics.** Informed by implementing the rollup library on real slice generation.
- **Cross-cutting heading literal name.** `## cross-cutting` is the working choice; confirm on first real generation.
- **Flat-mode dispatch removal timeline.** No forced timeline.
- **Pre-commit hook installer in a future release.** Skipped for v1.

## References

- Implementation plan: `/Users/arpit/.cursor/plans/task-slices_model_c219422f.plan.md`
- Session notes: `wiki/changes/260609-rrsq-weave-slice/sessions/20260609-144437-s7k2-architecture.md`, `20260609-162459-9a3k-architecture.md`, `20260609-174155-b5q2-architecture.md`
- Skills to modify: `.claude/skills/weave-issues/SKILL.md` (rename), `weave-execute/SKILL.md`, `weave-next/SKILL.md`, `weave-prepare/SKILL.md` (deprecate)
