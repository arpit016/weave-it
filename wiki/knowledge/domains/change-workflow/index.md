# Change Workflow

This domain captures the current behavior of Weave's change lifecycle and the agent skills that participate in it: exploration, PRD, architecture, issues/tasks, knowledge, capture, clarify, next, new, and propagate.

A Weave change moves through artifact lanes (`exploration`, `prd`, `architecture`, `issues`, `knowledge`) tracked in `wiki/changes/<change-id>/status.yml`. Each lane has an owning skill that creates or revises a single durable artifact and records lifecycle progress via `weave change progress <lane>`.

## Features

- [weave-issues](features/weave-issues/behavior.md): local task breakdown into `tasks.md` with categorized sections for implementation tasks (`T#`), QA findings (`QF#`), and refactors (`R#`).
- [weave-capture](features/weave-capture/behavior.md): two-mode capture (artifact vs session-only) of the current discussion, including the Defensive Lane Verification step that catches stored artifact context drift.

## Domain-Wide Behavior

- [lifecycle-progress-and-staleness](domain-wide/lifecycle-progress-and-staleness.md): `weave change progress` semantics, the default pessimistic stale propagation, CLI levers (`--no-invalidate`, `--invalidate`), explicit `weave change clear-stale`, the `stale_history` audit trail, and the agent-side verification protocol embedded in five skills.
- [plan-mode-protocol](domain-wide/plan-mode-protocol.md): the byte-identical two-phase protocol that lets design-discussion skills (`weave-explore`, `weave-prd`, `weave-architect`, `weave-clarify`) reliably set artifact context across every supported agent harness, including plan/ask/read-only modes.

## Glossary Cross-References

- The canonical specification for each Weave skill lives in `templates/skills/<skill-name>/SKILL.md`. Knowledge entries here summarize observable behavior and link back to that source rather than restating the full skill prose.
- Notice surfacing, package versioning, and per-skill version drift live in the [cli-distribution](../cli-distribution/index.md) domain.

## Source Map

See each feature's own `source-map` references; this domain does not yet have a top-level `source-map.md`.
