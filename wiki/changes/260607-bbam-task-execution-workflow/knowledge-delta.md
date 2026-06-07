# Knowledge Delta: Task Execution Workflow

## Summary

This change introduced a local agent-first task execution workflow and tightened `weave-architect` Plan Mode lane-commit behavior.

Durable knowledge updates:

- Added current-state knowledge for `/weave-execute` at `wiki/knowledge/domains/change-workflow/features/weave-execute/behavior.md`.
- Updated the change workflow index to include `weave-execute` as a task execution feature.
- Updated `weave-architect` current-state knowledge to document that `weave artifact current set architecture --json` runs inside the initial discovery command block and writes local session state only.

## Behavior Added

`/weave-execute` is now a bundled skill and opencode wrapper for local task execution. It:

- resolves the active change and reads `tasks.md`;
- supports no-argument prompt, explicit task ids, scope selectors, and `all`;
- derives dependencies from `Blocked by:`;
- always runs `weave task prepare ... --json` before implementation;
- executes eligible `T#` tasks in dependency order;
- pauses for HITL tasks;
- runs verification;
- updates only affected task statuses, satisfied acceptance criteria, and task-local verification notes;
- avoids commits, pushes, PRs, remote branches, stash/discard behavior, external issue publishing, and separate run-history artifacts.

`weave-architect` now makes its Plan Mode-safe local lane commit harder to skip by inlining this discovery sequence:

```bash
weave workspace --json
weave change current --json
weave change status --json
weave artifact current set architecture --json
```

The skill explicitly states that the artifact-context command writes local session state, not repo-tracked change artifacts.

## Source Evidence

- Product contract: `wiki/changes/260607-bbam-task-execution-workflow/prd.md`
- Architecture: `wiki/changes/260607-bbam-task-execution-workflow/architecture/index.md`
- Scope expansion facet: `wiki/changes/260607-bbam-task-execution-workflow/architecture/weave-architect-lane-commit.md`
- Task plan and implementation evidence: `wiki/changes/260607-bbam-task-execution-workflow/tasks.md`
- Skill source: `templates/skills/weave-execute/SKILL.md`
- Opencode wrapper: `templates/opencode/commands/weave-execute.md`
- Architect skill source: `templates/skills/weave-architect/SKILL.md`
- Packaging assertions: `tests/agent-skills.test.ts`

## Follow-Up Notes

- Future versions may add deterministic task-evidence helpers if direct `tasks.md` patching proves brittle.
- `weave task execute` remains out of scope for v1; implementation remains agent behavior.
