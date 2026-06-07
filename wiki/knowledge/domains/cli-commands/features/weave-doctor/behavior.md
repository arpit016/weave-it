# weave doctor

## Purpose

`weave doctor` gives users and agents a health report for the current Weave project and a narrow repair path for missing safe scaffold files.

Use this as current-state product knowledge when deciding how project health checks, scaffold repair, or doctor output should behave.

## Current Behavior

`weave doctor` is a top-level CLI command:

```bash
weave doctor
weave doctor --json
weave doctor --fix
weave doctor --fix --json
```

By default, `weave doctor` is read-only. It resolves the current Weave root by walking up from `cwd` to a readable `.weave/workspace.yml`, then reports project health checks without changing files.

`weave doctor --fix` only performs safe, additive scaffold repair. It creates missing safe scaffold directories and files through the same write-if-missing scaffold path used by init. It never overwrites existing files.

## Domain Model

Doctor result status:

- `ok`: no relevant issues found.
- `warning`: project is usable but has non-blocking issues, such as missing safe scaffold files, skill drift, no active change, or branch mismatch.
- `error`: Weave context is missing or invalid enough that normal commands may fail, such as no readable `.weave/workspace.yml`.

Doctor checks include:

- `weave_context`: whether readable Weave metadata exists.
- `safe_scaffold`: whether standard safe scaffold files exist.
- `safe_scaffold_dirs`: whether standard scaffold directories exist.
- `skill_drift`: whether installed skills differ from bundled templates when `.weave/agents.yml` exists.
- `active_change`: whether the current session has an active change for the resolved root and whether the current git branch matches the change branch when known.

Safe scaffold files currently include:

```text
.weave/sync.yml
.weave/architecture-considerations.md
wiki/knowledge/index.md
wiki/knowledge/README.md
wiki/knowledge/domains/README.md
wiki/knowledge/shared/README.md
```

Safe scaffold directories currently include:

```text
.weave/
wiki/changes/
wiki/knowledge/domains/
wiki/knowledge/shared/
```

## Behavioral Rules

- `weave doctor` never creates, edits, deletes, or overwrites files.
- `weave doctor --fix` only creates missing safe scaffold files and directories.
- `weave doctor --fix` does not update installed skills.
- `weave doctor --fix` does not change branches.
- `weave doctor --fix` does not edit `status.yml`.
- `weave doctor --fix` does not mutate live change artifacts under `wiki/changes/**`.
- `weave doctor --fix` does not run migrations or package upgrades.
- Doctor reports installed skill drift as a warning, but repair remains an explicit `weave agent update` or `weave agent reset` action.
- Doctor reports missing active change as a warning, not an error.
- Doctor exits non-zero only for `error` status.

## Integrations And Side Effects

- `weave doctor` is a Tier 1 command and includes a stable top-level `notices` array in `--json` output via `withNotices()`.
- `weave doctor --fix` may create missing scaffold files through `ensureWeaveScaffold()`.
- `weave doctor --fix` may add missing safe scaffold paths to its `changed` list.

## Source Anchors

- Command: `src/commands/doctor.ts`
- Doctor library: `src/lib/doctor.ts`
- Scaffold writer: `src/lib/weave-scaffold.ts`
- Skill drift rows: `src/lib/status.ts` (`collectSkillRows`)
- Context resolver: `src/lib/workspace-mode.ts` (`findWorkspaceMode`)
- Branch lookup: `src/lib/git.ts` (`currentBranch`)
- Tests: `tests/cli-doctor.test.ts`, `tests/cli-tier1-notices.test.ts`

## Change History

- 2026-06-07 (change `260607-vuwa-architecture-skill-update`): `weave doctor` added as a read-only health report with JSON output, Tier 1 notices, installed skill drift reporting, active change/branch checks, and a narrow `--fix` mode for missing safe scaffold files.

## Open Questions

- Whether later versions should add more check categories. Any stronger repair action should remain explicit and separate from v1 `doctor --fix`.
