# Knowledge Delta

## Durable Behavior Changes

- **`weave-slices` execution default flipped**: `Execution:` now defaults to `afk` for all generated tasks. `hitl` is used only when the user explicitly asks to mark a particular architecture area, slice, or task as human-in-the-loop (previously defaulted to `hitl`, promoting to `afk` only when fully spec'd and mechanical).
- **`weave-slices` manual-verification policy**: a manual verification task is `afk` only when its steps are fully mechanical and performable by the agent in the available environment; it is `hitl` when it needs a browser-only check, product judgment, visual approval, credentials, customer data, production access, or human acceptance.
- **`weave-fix` step 2 corrected**: the change-creation command is `weave change new "<title>" --type fix [--slug <slug>]` (the previously documented `weave new --type fix` does not exist).
- **`weave-fix` branch check**: step 2 now checks the current branch first; if it already follows the `change/<change-id>` structure (an existing change), the skill continues that change and writes/updates `findings.md` rather than creating a duplicate. Workspace-root authority for change creation is documented (workspace mode creates the change at the workspace root even when invoked from a sub-repo).
- **Scoped workspace prepare**: `weave task prepare` accepts repeatable `--repo <id>` filters. In workspace mode, filtered prepare inspects and switches only the requested registered repos; untargeted workspace repos are not switched and do not block, even if dirty. `/weave-execute` slice mode now passes the selected slice's `status.yml.repos` as `--repo` flags.

## Affected Knowledge Areas

- `change-workflow` domain: `weave-slices`, `weave-fix`, `weave-execute`, and `weave-prepare` features.

## Knowledge Files Updated

- `wiki/knowledge/domains/change-workflow/features/weave-slices/behavior.md` (execution default + manual-verification policy, change history)
- `wiki/knowledge/domains/change-workflow/features/weave-fix/behavior.md` (step 2 command + branch check + workspace-root authority, change history)
- `wiki/knowledge/domains/change-workflow/features/weave-execute/behavior.md` (slice-mode prepare scopes to selected slice repos)
- `wiki/knowledge/domains/change-workflow/features/weave-prepare/behavior.md` (`--repo` filter semantics and untargeted repo behavior)

## No-Impact Rationale

N/A — durable skill behavior changed.

## Source Evidence

- Change `260611-cuvh-slices-execution-default-afk`: slices `01-default-afk-execution` (done) and `02-weave-fix-change-new-guidance` (done).
- Skill edits in `templates/skills/{weave-slices,weave-fix}/SKILL.md` and the synced `.agents/` + `.claude/` copies.
- Scoped prepare implementation in `src/lib/task-prepare.ts` and `src/commands/task.ts`; behavior covered by `tests/task-prepare.test.ts`.
- `/weave-execute` skill update in `templates/skills/weave-execute/SKILL.md` and synced `.agents/` + `.claude/` copies.
- Slice `03-change-new-dirty-worktree-guard` is **invalid** (CLI dirty-worktree guard explored and reverted); no CLI behavior change shipped, so no knowledge impact from it.
- Verification: `npm test` (200 passed), `npm run typecheck`, `npm run build` all clean.

## Follow-Up Knowledge Work

- None.
