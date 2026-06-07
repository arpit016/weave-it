---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-07T11:31:00.000Z
updated_at: 2026-06-07T11:41:00.000Z
source: architecture
---

# Tasks: Task Execution Workflow

## Source Context

- PRD: `wiki/changes/260607-bbam-task-execution-workflow/prd.md`
- Architecture: `wiki/changes/260607-bbam-task-execution-workflow/architecture/index.md`, `wiki/changes/260607-bbam-task-execution-workflow/architecture/weave-architect-lane-commit.md`
- Sessions: `wiki/changes/260607-bbam-task-execution-workflow/sessions/20260607-162136-q7m4-exploration.md`, `wiki/changes/260607-bbam-task-execution-workflow/sessions/20260607-163414-k9p2-architecture.md`
- Codebase: `src/cli.ts`, `src/commands/task.ts`, `src/lib/tasks.ts`, `src/lib/task-prepare.ts`, `src/lib/agent-skills.ts`, `templates/skills/weave-prepare/SKILL.md`, `templates/skills/weave-architect/SKILL.md`, `templates/skills/weave-explore/SKILL.md`, `templates/skills/weave-prd/SKILL.md`, `templates/opencode/commands/*.md`, `.agents/skills/*/SKILL.md`, `.claude/skills/*/SKILL.md`, `.opencode/commands/*.md`, `.weave/agents.yml`, `tests/agent-skills.test.ts`, `package.json`
- External references: None
- Local references: None

## Coverage Review

PRD coverage:

- Covered: `/weave-execute` no-argument prompting, explicit task id selectors, scope selectors, `all`, dependency ordering from `Blocked by:`, mandatory prepare before implementation, eligible and skipped task statuses, HITL pauses, task-local status and verification evidence updates, continuation after independent failures, dependency-blocked skips, local-only execution, and non-goals around `weave task execute`, commits, pushes, PRs, remote branches, stash/discard behavior, external issue publishing, per-repo task files, and separate run-history artifacts.
- Not covered by PRD: the `weave-architect` lane-commit compliance fix. This is an explicitly accepted architecture scope expansion recorded in `architecture/index.md` and `architecture/weave-architect-lane-commit.md`.

Architecture coverage:

- Covered: skill-only `/weave-execute` architecture, prepare delegation, task selector mapping, dependency handling, HITL behavior, task artifact patching rules, packaging and install surface, skill/opencode tests, current-state knowledge updates, and the scoped `weave-architect` Plan Mode lane-commit fix.

PRD/Architecture sync:

- In sync for `/weave-execute`: both artifacts define execution as agent-first, local-only, prepare-backed, task-selector-driven, dependency-aware, and responsible for updating local `tasks.md` evidence without commits, pushes, PRs, or a deterministic `weave task execute` CLI.
- Known scope expansion: the architecture adds the `weave-architect` lane-commit fix. The PRD follow-up is optional and non-blocking because this fix is developer-facing and independently captured in the architecture facet.

## Local Tracking Status

External issue publishing status: not used. This change tracks implementation locally in this file.

## Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified
- `not_tested`: implementation appears complete, but automated verification could not be completed
- `invalid`: no longer applies after source context changed

## Active Task Index

| ID | Status | Type | Scope | Primary repo | Repos | Title | Blocked by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | done | AFK | agent | `weave-it` | `weave-it` | Ship `/weave-execute` skill, wrapper, installed copies, and packaging tests | None |
| T2 | done | AFK | agent | `weave-it` | `weave-it` | Restructure `weave-architect` `# Resolve Context` for reliable Plan Mode lane commit | None |
| T3 | done | AFK | docs | `weave-it` | `weave-it` | Document `/weave-execute` and the `weave-architect` discovery fix in current-state knowledge | T1, T2 |
| T4 | done | AFK | tests/docs | `weave-it` | `weave-it` | Lock the change with full verification and knowledge delta | T1, T2, T3 |

## T1: Ship `/weave-execute` skill, wrapper, installed copies, and packaging tests

Status: done

Type: AFK

Scope: agent

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-bbam-task-execution-workflow/architecture/index.md#decision-summary`, `wiki/changes/260607-bbam-task-execution-workflow/architecture/index.md#skill-workflow`, `wiki/changes/260607-bbam-task-execution-workflow/architecture/index.md#packaging-and-install-surface`, `wiki/changes/260607-bbam-task-execution-workflow/architecture/index.md#test-plan`

Coordination: Provides the user-facing execution workflow that later knowledge and final verification tasks document and lock.

Blocked by: None - can start immediately

User stories covered: 1, 2, 3, 4, 5, 7, 8

Origin: none

Related finding: none

### What to build

Add `/weave-execute` as a bundled agent skill and opencode slash command wrapper. The skill should resolve the active Weave change, read `tasks.md`, map arguments to a task selector, order selected work by `Blocked by:`, run `weave task prepare ... --json` for the final task set, implement eligible tasks, run verification, patch task-local evidence, and finish with a grouped summary.

The skill should support `/weave-execute`, `/weave-execute T3`, `/weave-execute T1 T3 T7`, `/weave-execute <scope>`, and `/weave-execute all`. With no arguments, it should ask the short example-driven prompt from the PRD. It should use `npm run dev -- task prepare ... --json` as the local fallback when the global `weave` command is unavailable.

Add the canonical source templates, checked-in installed copies, and opencode wrapper using the existing skill packaging conventions. Update `.weave/agents.yml` through the normal agent install/update flow rather than by hand if the implementation path supports that.

Extend `tests/agent-skills.test.ts` to assert the new skill metadata and behavior coverage: no-argument prompt, selector mapping, prepare invocation, dependency handling, HITL pauses, eligible and skipped status rules, precise `tasks.md` patching rules, final summary expectations, no accidental Plan Mode Guard, no lifecycle progress protocol, opencode wrapper content, installed-copy byte identity, and manifest entries.

### Acceptance Criteria

- [x] `templates/skills/weave-execute/SKILL.md` exists with correct frontmatter and workflow.
- [x] `templates/opencode/commands/weave-execute.md` exists and loads the `weave-execute` skill with `$ARGUMENTS`.
- [x] Checked-in installed copies exist and match the template/wrapper where repository conventions require them.
- [x] The skill asks for a selector when invoked without arguments and includes examples for `all`, a scope, and task ids.
- [x] The skill maps `all` to all executable `T#` tasks.
- [x] The skill maps explicit task ids such as `T1 T3` to those tasks.
- [x] The skill maps a single non-task, non-`all` argument to a task `Scope`.
- [x] The skill uses `Blocked by:` as dependency truth and stops on missing ids, unclear blockers, or cycles.
- [x] The skill always runs `weave task prepare ... --json` before implementation.
- [x] The skill stops before implementation when prepare reports blockers.
- [x] The skill marks a task `in_progress` when execution starts for that task.
- [x] The skill marks tasks `done`, `not_tested`, or leaves them `in_progress` according to implementation and verification outcome.
- [x] The skill skips `done` and `invalid` tasks by default.
- [x] The skill includes HITL tasks in `all` but pauses before each HITL task for required user input.
- [x] The skill only patches affected task rows, task `Status:`, satisfied acceptance criteria, and task-local verification notes.
- [x] `tests/agent-skills.test.ts` covers the bundled skill, installed copies, opencode wrapper, manifest entries, and important behavior instructions.
- [x] The skill does not include a Plan Mode Guard.
- [x] The skill does not require the lifecycle progress protocol unless it calls progress.

### Verification

- Automated tests: `npm test -- tests/agent-skills.test.ts` passed on 2026-06-07.
- Manual/smoke check: reviewed `templates/skills/weave-execute/SKILL.md` and `templates/opencode/commands/weave-execute.md`; examples and command mappings match the PRD.

## T2: Restructure `weave-architect` `# Resolve Context` for reliable Plan Mode lane commit

Status: done

Type: AFK

Scope: agent

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-bbam-task-execution-workflow/architecture/weave-architect-lane-commit.md`

Coordination: Independent tactical fix for a skill-routing defect observed while working this change. Knowledge and final verification depend on it.

Blocked by: None - can start immediately

User stories covered: None

Origin: qa_finding

Related finding: QF1

### What to build

Restructure `# Resolve Context` in `templates/skills/weave-architect/SKILL.md` so the architecture lane commit runs as part of the first-step discovery sequence in Plan Mode.

Inline these commands in one discovery block, mirroring `weave-explore`:

```bash
weave workspace --json
weave change current --json
weave change status --json
weave artifact current set architecture --json
```

Add a clear sentence that setting local artifact context with `weave artifact current set architecture --json` is allowed in Plan Mode because it writes local session state, not repo-tracked change artifacts, and must run as part of the initial discovery sequence instead of as a conditional follow-up.

Remove the old separated-block wording, especially `After the active change is resolved, run:`. Keep the Plan Mode Guard and repo-tracked-artifact read-only contract intact.

Sync the same content to `.agents/skills/weave-architect/SKILL.md` and `.claude/skills/weave-architect/SKILL.md` so installed copies remain byte-identical. Extend `tests/agent-skills.test.ts` to pin the inlined four-command block, the clarifying sentence, and the absence of the old separated-block prose.

### Acceptance Criteria

- [x] `templates/skills/weave-architect/SKILL.md` has a single initial discovery code block containing `weave workspace --json`, `weave change current --json`, `weave change status --json`, and `weave artifact current set architecture --json`.
- [x] The no-active-change stop branch appears after the inlined discovery sequence.
- [x] The skill explicitly states that setting local artifact context is allowed in Plan Mode because it writes local session state, not repo-tracked artifacts.
- [x] The old `After the active change is resolved, run:` wording is removed.
- [x] `.agents/skills/weave-architect/SKILL.md` matches the template.
- [x] `.claude/skills/weave-architect/SKILL.md` matches the template.
- [x] `tests/agent-skills.test.ts` asserts the inlined sequence, the clarifying sentence, and the removed old prose.
- [x] Existing read-only guarantees remain intact: `weave-architect` still does not create, edit, rename, delete, or progress repo-tracked artifacts.

### Verification

- Automated tests: `npm test -- tests/agent-skills.test.ts` passed on 2026-06-07.
- Manual/smoke check: not run; behavior is covered by content assertions and installed-copy byte identity.

## T3: Document `/weave-execute` and the `weave-architect` discovery fix in current-state knowledge

Status: done

Type: AFK

Scope: docs

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-bbam-task-execution-workflow/architecture/index.md#files-affected`, `wiki/changes/260607-bbam-task-execution-workflow/architecture/weave-architect-lane-commit.md`

Coordination: Depends on the implemented skill content and `weave-architect` clarification so current-state knowledge reflects shipped behavior instead of planned behavior.

Blocked by: T1, T2

User stories covered: 6

Origin: none

Related finding: none

### What to build

Update current-state knowledge after the implementation slices land.

Create `wiki/knowledge/domains/change-workflow/features/weave-execute/behavior.md` documenting the user-facing `/weave-execute` workflow: supported selectors, no-argument prompt behavior, dependency resolution from `Blocked by:`, prepare-before-implementation requirement, eligible and skipped statuses, HITL pauses, verification expectations, local `tasks.md` evidence updates, failure continuation, and local-only non-goals.

Update `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md` so Current Behavior describes the inlined discovery sequence and explicitly notes that `weave artifact current set architecture --json` runs as part of initial Plan Mode discovery. Add a 2026-06-07 Change History entry for the lane-commit compliance fix.

Update `wiki/knowledge/domains/change-workflow/index.md` to register the new `weave-execute` feature knowledge page.

### Acceptance Criteria

- [x] `wiki/knowledge/domains/change-workflow/features/weave-execute/behavior.md` exists and describes current `/weave-execute` behavior.
- [x] `weave-execute` knowledge documents task id, scope, `all`, and no-argument selector flows.
- [x] `weave-execute` knowledge documents `Blocked by:` dependency handling and prepare-before-implementation behavior.
- [x] `weave-execute` knowledge documents task status transitions, HITL pauses, verification notes, and local-only non-goals.
- [x] `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md` describes the inlined initial discovery sequence.
- [x] `weave-architect` knowledge includes a 2026-06-07 Change History entry for the lane-commit compliance fix.
- [x] `wiki/knowledge/domains/change-workflow/index.md` links or lists the new `weave-execute` feature page.

### Verification

- Automated tests: no dedicated knowledge tests required; `ReadLints` reported no errors for the updated knowledge files.
- Manual/smoke check: read the knowledge pages and confirmed they describe shipped skill behavior rather than the implementation plan.

## T4: Lock the change with full verification and knowledge delta

Status: done

Type: AFK

Scope: tests/docs

Primary repo: `weave-it`

Repos: `weave-it`

Architecture refs: `wiki/changes/260607-bbam-task-execution-workflow/architecture/index.md#test-plan`, `wiki/changes/260607-bbam-task-execution-workflow/architecture/weave-architect-lane-commit.md#test-plan`

Coordination: Final cross-cutting verification and durable knowledge delta after all implementation and knowledge slices land.

Blocked by: T1, T2, T3

User stories covered: cross-cutting

Origin: none

Related finding: none

### What to build

Run the repository's standard verification and record the outcome in this task. The expected commands are `npm run typecheck`, `npm test`, and `npm run build`.

Create `wiki/changes/260607-bbam-task-execution-workflow/knowledge-delta.md` summarizing durable behavior changes from this change, including `/weave-execute` and the `weave-architect` lane-commit discovery fix. Mark knowledge updated through the appropriate Weave lifecycle command after current-state knowledge is written.

If any verification command cannot run or fails for an unrelated reason, record the command, outcome, and cause in this task's verification notes during implementation rather than silently marking the task complete.

### Acceptance Criteria

- [x] `npm run typecheck` passes.
- [x] `npm test` passes.
- [x] `npm run build` passes.
- [x] `wiki/changes/260607-bbam-task-execution-workflow/knowledge-delta.md` exists and records durable changes and source evidence.
- [x] The knowledge update lifecycle command is run after current-state knowledge is updated.
- [x] This task's verification notes record the final verification commands and outcomes.

### Verification

- Automated tests: `npm run typecheck && npm test && npm run build` passed on 2026-06-07. Full test suite passed: 15 test files, 185 tests.
- Manual/smoke check: inspected `knowledge-delta.md`; `weave change knowledge updated --domain change-workflow ... --json` recorded knowledge status `updated` with the expected files and delta path.

## QA Findings

Finding Status Legend:

- `new`: reported but not yet triaged
- `accepted`: triaged and accepted as a real defect
- `fixed`: implementation believed to address the defect
- `verified`: fix confirmed by re-test
- `duplicate`: already covered by another finding
- `not_reproducible`: could not be reproduced
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |
| QF1 | verified | medium | user report and session observation | T2 | `weave-architect` Plan Mode agents skip `weave artifact current set architecture --json`, leaving the architecture lane uncommitted in local Weave session state. |

## QF1: `weave-architect` skips the local architecture lane commit

Status: verified

Severity: medium

Source: user report and session observation

Related Task: T2

### Observed Behavior

Invoking `weave-architect` does not reliably update the current local artifact lane to architecture. Downstream capture may still see the previously selected lane or artifact context.

In this change's architecture discussion, the prior Plan Mode architect agent stated:

```text
I'm keeping this pass read-only, so I'm not changing local artifact context.
```

That directly contradicts the skill's intended behavior: `weave artifact current set architecture --json` is allowed because it writes local Weave session state only, not repo-tracked artifacts.

### Expected Behavior

After resolving an active change, `weave-architect` should always commit the architecture lane to local Weave session state with:

```bash
weave artifact current set architecture --json
```

It should do this during initial discovery in Plan Mode, before broad context loading or architecture discussion.

### Reproduction

1. Invoke `weave-architect` for an active change in Plan Mode.
2. Observe that the agent treats read-only mode as a reason to skip local artifact context mutation.
3. Invoke `weave-capture` and see that the stored artifact context may still reflect the previous lane.

### Artifact Impact

The issue does not corrupt repo-tracked artifacts, but it causes lane routing friction: capture may ask for defensive lane confirmation or target the wrong stored lane unless corrected by the user.

### Root Cause

`templates/skills/weave-architect/SKILL.md` separates the lane-commit command from the first discovery commands and places it after a stop branch with the wording `After the active change is resolved, run:`. Combined with heavy read-only framing at the top of the skill, Plan Mode agents can rationalize the command as an optional write to skip.

### Resolution

`templates/skills/weave-architect/SKILL.md` now inlines `weave artifact current set architecture --json` into the initial discovery code block with `weave workspace --json`, `weave change current --json`, and `weave change status --json`. It also explicitly states that setting local artifact context is allowed in Plan Mode because it writes local session state, not repo-tracked artifacts.

The checked-in installed copies match the template, and `tests/agent-skills.test.ts` verifies the inlined sequence, clarifying sentence, and removal of the old separated-block prose.

## Refactors

Refactor Status Legend:

- `proposed`: identified but not yet accepted
- `accepted`: agreed to do as part of this change
- `deferred`: logged for later; no `T#` yet
- `done`: completed and verified behavior-preserving
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Invalid Tasks

None.

## Verification

- `npm run typecheck` passed.
- `npm test` passed: 15 test files, 185 tests.
- `npm run build` passed.
- `npm test -- tests/agent-skills.test.ts` passed during targeted packaging verification.
