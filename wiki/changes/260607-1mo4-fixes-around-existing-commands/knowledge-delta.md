# Knowledge Delta

## Durable Behavior Changes

- `weave workspace` now includes runtime workspace repo availability for workspace-mode `repos[]`. Each registered repo reports `availability: "present"` when its path exists locally and `availability: "missing"` when it does not.
- Workspace repo availability is display-time local state. It is not persisted to `.weave/workspace.yml`, and `weave workspace` remains read-only: it does not clone, pull, create, delete, move, or otherwise hydrate missing repos.
- Weave skill guidance now uses the shared `# Silent Weave Command Output` contract instead of `# Surface Weave Notices`. Skills treat Weave CLI command output as internal by default and summarize only blockers, failures, missing relevant repos, branch/task outcomes, lifecycle failures, relevant notices, and user-required actions.
- Tier 1 command JSON notices remain available for automation, but skills no longer show raw notice text or command JSON by default.
- `weave-architect` now explicitly allows its local architecture lane commit while continuing to forbid repo-tracked artifact writes. It verifies the stored lane with `weave artifact current --json`, keeps success silent, and continues with a warning if the lane cannot be updated.

## Affected Knowledge Areas

- `cli-commands`: `weave workspace` output shape and fresh workspace clone behavior.
- `cli-distribution`: Tier 1 notices and the shared skill command-output contract.
- `change-workflow`: workspace-aware skill context, `weave-architect` lane behavior, and skill notice-output behavior for affected workflow skills.

## Knowledge Files Updated

- `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md`
- `wiki/knowledge/domains/cli-distribution/index.md`
- `wiki/knowledge/domains/cli-distribution/features/notices/behavior.md`
- `wiki/knowledge/domains/change-workflow/domain-wide/workspace-aware-skill-context.md`
- `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md`
- `wiki/knowledge/domains/change-workflow/features/weave-capture/behavior.md`
- `wiki/knowledge/domains/change-workflow/features/weave-issues/behavior.md`

## No-Impact Rationale

Not applicable. This change updates durable CLI output behavior and durable skill guidance.

## Source Evidence

- `src/lib/show-workspace.ts` computes workspace repo availability at render time.
- `tests/init.test.ts` covers present and missing workspace repo availability.
- `src/lib/skill-template-checks.ts` defines `EXPECTED_SILENT_COMMAND_OUTPUT`.
- `templates/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md`, and `.claude/skills/*/SKILL.md` carry the new silent command output policy.
- `templates/skills/weave-architect/SKILL.md`, `.agents/skills/weave-architect/SKILL.md`, and `.claude/skills/weave-architect/SKILL.md` include lane verification and the non-blocking warning.
- `tests/agent-skills.test.ts` asserts the new silent policy, rejects old verbatim notice guidance, and verifies the architect lane-entry wording.
- Verification during execution: `npm run test -- tests/init.test.ts`, `npm run test -- tests/agent-skills.test.ts`, and `npm run typecheck` passed.

## Follow-Up Knowledge Work

- If a future explicit `weave hydrate` command is added, update `cli-commands` and workspace-aware skill context to distinguish hydration behavior from passive workspace discovery.
