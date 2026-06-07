# Knowledge Delta

## Durable Behavior Changes

- Weave now scaffolds `.weave/architecture-considerations.md` as a user-owned architecture guidance file during standard scaffold creation and repair paths.
- `weave doctor` is now a top-level project health command.
- `weave doctor` is read-only by default and reports context health, missing safe scaffold files, installed skill drift, active change presence, and branch match where available.
- `weave doctor --fix` performs only safe additive scaffold repair through write-if-missing behavior. It does not overwrite files, update installed skills, change branches, edit `status.yml`, mutate live artifacts, run migrations, or upgrade packages.
- `weave doctor` is a Tier 1 command and includes `notices` in JSON output.
- Bundled `weave-architect` now reads `.weave/architecture-considerations.md` when present and treats it as user-owned advisory team architecture guidance.
- Installed skill copies are intentionally not updated by this change. Skill drift remains surfaced through status/doctor and repaired through explicit `weave agent update` or `weave agent reset` flows.
- Npm latest refresh now targets the scoped package metadata URL for `@weave-tools/weave-it` instead of the unscoped `weave-it` registry URL.

## Affected Knowledge Areas

- `cli-commands`
- `change-workflow`
- `cli-distribution`

## Knowledge Files Updated

- `wiki/knowledge/domains/cli-commands/index.md`
- `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md`
- `wiki/knowledge/domains/cli-commands/features/weave-doctor/behavior.md`
- `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md`
- `wiki/knowledge/domains/cli-distribution/features/notices/behavior.md`
- `wiki/knowledge/domains/cli-distribution/features/weave-status/behavior.md`

## No-Impact Rationale

Not applicable. This change introduced durable user-facing CLI behavior, scaffold behavior, and skill behavior.

## Source Evidence

- `wiki/changes/260607-vuwa-architecture-skill-update/architecture/index.md`
- `wiki/changes/260607-vuwa-architecture-skill-update/tasks.md`
- `src/lib/weave-scaffold.ts`
- `src/lib/npm-version.ts`
- `src/commands/doctor.ts`
- `src/lib/doctor.ts`
- `templates/skills/weave-architect/SKILL.md`
- `tests/cli-doctor.test.ts`
- `tests/init.test.ts`
- `tests/agent-skills.test.ts`
- `tests/cli-tier1-notices.test.ts`
- `tests/npm-version.test.ts`

## Follow-Up Knowledge Work

- None known.
