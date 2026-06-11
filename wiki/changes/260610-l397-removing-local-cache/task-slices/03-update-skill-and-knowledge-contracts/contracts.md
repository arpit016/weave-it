# Contracts: Update Skill And Knowledge Contracts

Slice-level technical contracts for docs, skill templates, and template tests.

## Interfaces

- Skill contract entry commands remain skill-level instructions, not CLI flags.
- `weave-capture <artifact>` and `weave-capture session <artifact>` are the explicit target examples.
- `weave-next` uses `weave change current`, `weave change status`, `status.yml`, live artifacts, and sessions for orientation.

## Data

- Knowledge docs under `wiki/knowledge/` should describe current implemented behavior after slices 01 and 02.
- Template tests should enforce the absence of removed command strings.
- Installed skill copies may be locally modified and should not be overwritten unless the implementation task explicitly decides to refresh generated copies.

## State

- Design-discussion skills are no longer responsible for setting current artifact state.
- `weave-capture` owns explicit artifact target resolution and artifact writing.
- `weave-next` owns read-only next-step recommendation from durable state.

## Validation and errors

- Skill tests should fail if bundled templates reintroduce `weave artifact current` routing.
- Knowledge docs should not claim non-git change creation is supported.

## Files and artifacts

- Skill templates: `templates/skills/weave-explore/SKILL.md`, `templates/skills/weave-prd/SKILL.md`, `templates/skills/weave-architect/SKILL.md`, `templates/skills/weave-capture/SKILL.md`, `templates/skills/weave-next/SKILL.md`.
- Shared checks: `src/lib/skill-template-checks.ts`.
- Tests: `tests/agent-skills.test.ts`.
- Knowledge docs: `wiki/knowledge/domains/change-workflow/**`, `wiki/knowledge/domains/cli-commands/**` as referenced by architecture.

## Observability

- Skill output policy remains silent for raw Weave command output.
- User-facing guidance should point to explicit capture commands and branch switch/new recovery actions.
