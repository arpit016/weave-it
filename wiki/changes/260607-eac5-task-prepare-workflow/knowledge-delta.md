# Knowledge Delta

## Durable Behavior Changes

- Added `weave task prepare` as a deterministic local branch-readiness command for selected `T#` tasks.
- Added `/weave-prepare` through the `weave-prepare` skill and opencode command wrapper.
- Added `status.yml.execution.repos` readiness storage for repo/workspace task preparation.
- Fixed architecture artifact context so folder-mode architecture records `architecture/index.md` when present.

## Affected Knowledge Areas

- `change-workflow`: new `weave-prepare` feature behavior and branch-readiness semantics.
- `cli-commands`: core command reference now includes the `weave task prepare` surface.
- `architecture-artifacts`: artifact context path behavior for folder-mode architecture is current-state behavior.

## Knowledge Files Updated

- `wiki/knowledge/domains/change-workflow/index.md`
- `wiki/knowledge/domains/change-workflow/features/weave-prepare/behavior.md`
- `wiki/knowledge/domains/change-workflow/domain-wide/architecture-artifacts.md`
- `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md`

## No-Impact Rationale

Not applicable. This change adds a user-facing CLI command, a slash-command skill, durable status metadata, and a session-state bug fix.

## Source Evidence

- Implementation: `src/commands/task.ts`, `src/lib/tasks.ts`, `src/lib/task-prepare.ts`, `src/lib/git.ts`, `src/lib/changes.ts`, `src/lib/artifact-context.ts`
- Skill packaging: `templates/skills/weave-prepare/SKILL.md`, `templates/opencode/commands/weave-prepare.md`, installed `.agents`, `.claude`, and `.opencode` copies
- Tests: `tests/tasks.test.ts`, `tests/task-prepare.test.ts`, `tests/changes.test.ts`, `tests/agent-skills.test.ts`

## Follow-Up Knowledge Work

- Future task execution, verification, PR, publish, and remote branch workflows should get separate knowledge updates when implemented.
