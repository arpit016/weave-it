# Change Workflow

This domain captures the current behavior of Weave's change lifecycle and the agent skills that participate in it: exploration, PRD, architecture, issues/tasks, knowledge, capture, clarify, next, new, and propagate.

A Weave change moves through artifact lanes (`exploration`, `prd`, `architecture`, `issues`, `knowledge`) tracked in `wiki/changes/<change-id>/status.yml`. Each lane has an owning skill that creates or revises a single durable artifact and records lifecycle progress via `weave change progress <lane>`.

## Features

- [weave-issues](features/weave-issues/behavior.md): local task breakdown into `tasks.md` with categorized sections for implementation tasks (`T#`), QA findings (`QF#`), and refactors (`R#`).

## Glossary Cross-References

- The canonical specification for each Weave skill lives in `templates/skills/<skill-name>/SKILL.md`. Knowledge entries here summarize observable behavior and link back to that source rather than restating the full skill prose.

## Source Map

See each feature's own `source-map` references; this domain does not yet have a top-level `source-map.md`.
