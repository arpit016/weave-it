# Knowledge Delta

## Durable Behavior Changes

- Workspace-mode `weave add` now distinguishes committed repo registration from local repo availability.
- A repo path that is registered in `.weave/workspace.yml` is a duplicate only when the corresponding workspace directory exists locally.
- A registered-but-missing repo path is a materialization target:
  - `weave add <git-url>` clones into the registered path.
  - `weave add <local-path>` moves the local folder into the registered path.
- Materializing a registered-but-missing repo does not rewrite `.weave/workspace.yml` or `.gitignore`.
- Existing unregistered add behavior remains unchanged: new repos are cloned or moved, gitignored, and registered.

## Affected Knowledge Areas

- `cli-commands`
- `cli-commands/features/core-command-reference`

## Knowledge Files Updated

- `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md`

## No-Impact Rationale

Not applicable. This change updates durable user-facing CLI behavior.

## Source Evidence

- `src/lib/add-folder.ts`: workspace-mode `weave add` checks whether a registered path exists locally before returning `already_exists`; registered-but-missing paths are cloned or moved without calling the workspace metadata write path.
- `tests/init.test.ts`: regression coverage for materializing a missing registered workspace repo from both a local path and a git URL without rewriting `.weave/workspace.yml` or `.gitignore`.
- `wiki/changes/260608-78sp-fix-weave-add/architecture/index.md`: architecture decision that registered-present and registered-missing workspace repo paths have different outcomes.
- `wiki/changes/260608-78sp-fix-weave-add/tasks.md`: T1 completed with focused and full test verification.

## Follow-Up Knowledge Work

- None.
