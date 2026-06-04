# Knowledge Delta

## Durable Behavior Changes

- `weave change` and `weave artifact` commands now resolve their operating root from `cwd` by walking up to `.weave/workspace.yml`.
- In workspace mode, the workspace root owns the single durable change and artifact store at `workspace/wiki/changes/`, even when commands run from inside registered sub-repos.
- In repo mode, nested directories resolve to the repo root, preventing accidental nested `wiki/changes/` scaffolds.
- Change and artifact command surfaces are single-context: `--target`, `all` positional target behavior, and `weave change propagate` are removed.
- JSON compatibility is preserved where existing consumers expect `targets: [...]`; affected commands return a one-element `targets` array.
- `weave-propagate` is no longer a shipped or installed skill/command wrapper. `weave-new` and `weave-next` now describe cwd-dispatched single-context behavior.

## Affected Knowledge Areas

- CLI command reference: change and artifact command context, examples, use cases, removed multi-target behavior, and source anchors.
- Change workflow: change creation and plan-mode guard summaries now reflect the current shipped skill set and single-context change creation behavior.

## Knowledge Files Updated

- `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md`
- `wiki/knowledge/domains/change-workflow/index.md`
- `wiki/knowledge/domains/change-workflow/domain-wide/change-creation-and-stages.md`
- `wiki/knowledge/domains/change-workflow/domain-wide/plan-mode-guard.md`

## No-Impact Rationale

Not applicable. This change has durable user-facing CLI behavior and agent-skill behavior impact.

## Source Evidence

- Product behavior: `wiki/changes/260605-2sy1-make-change-and-artifact-commands-workspace/prd.md`
- Technical design: `wiki/changes/260605-2sy1-make-change-and-artifact-commands-workspace/architecture.md`
- Implementation tasks and verification: `wiki/changes/260605-2sy1-make-change-and-artifact-commands-workspace/tasks.md`
- Context resolution implementation: `src/lib/workspace-mode.ts`
- Change command implementation: `src/lib/changes.ts`, `src/commands/change.ts`
- Artifact command implementation: `src/lib/artifact-context.ts`, `src/commands/artifact.ts`
- Test coverage: `tests/changes.test.ts`, `tests/cli-change-progress.test.ts`, `tests/cli-change-staleness.test.ts`, `tests/cli-skills.test.ts`, `tests/cli-tier1-notices.test.ts`, `tests/agent-skills.test.ts`
- Skill guidance: `templates/skills/weave-new/SKILL.md`, `templates/skills/weave-next/SKILL.md`

## Follow-Up Knowledge Work

- If a future change reintroduces scoped sub-repo metadata or explicit multi-context operations, update the CLI command reference and change workflow domain to distinguish that model from the current workspace-only change store.
- If removed-command UX changes from Commander unknown-option/subcommand errors to custom migration messages, update the removed behavior examples.
