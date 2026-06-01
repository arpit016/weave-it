---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-06-01T20:03:15.000Z
updated_at: 2026-06-01T20:03:15.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md
---

# Local Tasks Workflow For `weave-issues` Architecture

## Summary

The change revises `weave-issues` from an external issue-tracker publishing skill into a local `tasks.md` generation and reconciliation skill. The implementation should stay text-driven: update the canonical skill template, installed copies, opencode wrapper wording, README guidance, and skill contract tests.

No compiled `weave issues` command or deterministic task parser is introduced. The existing lifecycle runtime already supports the required `issues` lane, detects substantive `tasks.md` as issue evidence, and records explicit progress sources for stale invalidation.

The main technical risk is keeping all shipped and repo-installed skill surfaces aligned while removing tracker-publishing language and documenting a canonical local task-file contract.

## PRD Context

PRD: `wiki/changes/260602-943x-fix-issues-skill-with-creating-tasks/prd.md`

The architecture supports these PRD goals:

- create and reconcile local task breakdowns in `tasks.md`
- keep `tasks.md` as the durable local issue/task artifact
- use external issue references only as source context
- preserve vertical-slice task planning
- adapt verification guidance to repos with or without automated test infrastructure
- separate `weave-issues` generation responsibilities from implementer status updates

Important non-goals:

- no `issues.md`
- no external tracker mutation
- no day-to-day task status updater
- no strict TDD mandate
- no automatic test harness setup unless the source plan asks for it
- no implementation architecture for deterministic task parsing

## Current System

`weave-issues` is an Agent Skill, not a compiled CLI command. The canonical skill lives at `templates/skills/weave-issues/SKILL.md`. Repo-installed copies currently exist under `.agents/skills/weave-issues/SKILL.md` and `.claude/skills/weave-issues/SKILL.md`. The opencode wrapper lives at `templates/opencode/commands/weave-issues.md`.

Current skill behavior is tracker-oriented:

- read PRD, architecture, and status context
- draft tracer-bullet issues
- quiz the user on granularity and blockers
- publish approved slices to an external issue tracker
- record `weave change progress issues --source architecture --json`

Lifecycle runtime in `src/lib/changes.ts` already supports:

- stage `issues`
- `tasks.md` as issue evidence through `hasIssueEvidence`
- explicit progress sources using the existing source IDs `exploration`, `prd`, `architecture`, `discussion`, `sessions`, and `codebase`
- defaulting issue progress to `architecture` when no explicit source is provided and substantive `architecture.md` exists

Tests in `tests/agent-skills.test.ts` assert important skill text and installed-copy behavior. README currently describes `weave-issues` as breaking plans into implementation issues.

## Proposed Architecture

Implement this as a documentation and skill-contract update.

Update the canonical `weave-issues` skill to:

- gather context from PRD, architecture, sessions, discussion, codebase, local paths, and external issue references
- treat external issue references as read-only source context
- draft vertical-slice local tasks rather than external tracker issues
- preview first-run generation or existing-file reconciliation before writing
- write or reconcile `wiki/changes/<change-id>/tasks.md` only after explicit approval
- define a canonical `tasks.md` shape
- inspect test conventions before drafting verification guidance
- call lifecycle progress with existing source IDs that actually apply

Update installed copies and distribution surfaces together:

- `.agents/skills/weave-issues/SKILL.md`
- `.claude/skills/weave-issues/SKILL.md`
- `templates/opencode/commands/weave-issues.md`
- README skill list and examples

Do not change `src/lib/changes.ts` for this feature. Its current source graph and issue-evidence behavior are sufficient.

## Data Flow

1. User invokes `weave-issues`.
2. Agent reads active change context and source artifacts.
3. Agent optionally reads local path or external issue references as source context.
4. Agent inspects relevant repo conventions, including available test infrastructure.
5. Agent drafts a local task breakdown or reconciliation preview.
6. User approves or requests changes.
7. Agent writes `tasks.md`.
8. Agent runs `weave change progress issues` with existing lifecycle source IDs that actually informed the output.

External/local references that do not map to existing lifecycle source IDs are documented in `tasks.md` under source context, not added to `status.yml.artifacts`.

## Architecture Decisions

### Keep `weave-issues` text-driven

Decision: Implement the behavior in the Agent Skill and documentation, not as a compiled generator.

Rationale: The product behavior is agent-guidance driven today. Deterministic task generation and reconciliation would require a new parser, merge policy, and command contract that the PRD explicitly leaves out of scope.

Consequences: Agents continue to perform generation and reconciliation from instructions. Tests validate the skill contract rather than runtime task-generation behavior.

### Keep existing lifecycle source IDs

Decision: Do not add source IDs such as `external`, `reference`, or `local_path`.

Rationale: The existing lifecycle graph already covers stale invalidation for Weave lanes and broad context sources. External references and local paths do not have lifecycle semantics in Weave.

Consequences: `tasks.md` must list concrete references used, while `status.yml.artifacts.issues.sources` uses only existing IDs.

### Canonicalize `tasks.md` shape

Decision: Define a fixed generated shape for local task files.

Rationale: Consistent structure makes local tracking easier for agents and humans and gives reconciliation instructions stable anchors.

Consequences: Skill text must be specific enough to guide agents but should avoid promising deterministic parsing.

### Keep `not_tested` implementer-applied

Decision: Define `not_tested` in the status legend but never assign it during initial generation.

Rationale: `weave-issues` cannot know execution-time verification results before implementation.

Consequences: New tasks default to `todo` unless a real blocker is known. Implementers update `not_tested` later if implementation appears complete but automated verification could not be completed.

## Rejected Alternatives

### Add a compiled task generator

Rejected because it would turn an agent skill into a runtime feature and require deterministic parsing, reconciliation, conflict handling, and tests beyond the current scope.

It may become viable if local task generation needs non-agent execution or strict machine-editable guarantees.

### Add lifecycle source IDs for external references

Rejected because external issues and local paths are not Weave artifact lanes and do not participate in stale invalidation.

It may become viable if Weave later models external references as first-class tracked dependencies.

### Keep external publishing as optional output

Rejected because the PRD makes local-only output the active workflow for this change.

It may become viable in a future change that adds explicit tracker integration contracts.

### Generate `issues.md`

Rejected because existing lifecycle behavior and prior decisions already use `tasks.md` as local issue evidence.

## Constraints and Tradeoffs

- Skill behavior is text-driven; correctness depends on clear instructions and contract tests.
- Installed skill copies must be updated with the canonical template to keep local behavior aligned.
- Existing historical `tasks.md` files remain valid and are not migrated.
- `weave-next` and lifecycle code already treat populated `tasks.md` as issue evidence, so introducing `issues.md` would create ambiguity.
- Keeping existing source IDs is less granular for external references but preserves stable lifecycle semantics.

## Integration Points

- Agent Skill template: `templates/skills/weave-issues/SKILL.md`
- Installed skill copies: `.agents/skills/weave-issues/SKILL.md`, `.claude/skills/weave-issues/SKILL.md`
- Opencode command wrapper: `templates/opencode/commands/weave-issues.md`
- README skill docs and command examples
- Lifecycle CLI: `weave change progress issues --source ... --json`
- Existing lifecycle state: `status.yml.artifacts.issues.sources`

No external service integration is added.

## Rollout and Migration

Rollout is a template/docs update. Existing users get the new behavior when installed agent skills are updated or reset.

No migration is required for existing `tasks.md` files. Existing external issue references in historical artifacts remain issue evidence for compatibility.

Rollback is reverting the skill template, installed copies, README changes, and tests.

## Observability and Operations

There is no runtime service observability to add.

Operational visibility comes from:

- generated `tasks.md`
- `status.yml.stage`
- `status.yml.artifacts.issues.sources`
- command output from `weave change progress issues`

If lifecycle progress fails after `tasks.md` is written, the skill should report the failure and not rewrite tasks just to recover.

## Testing Strategy

Update skill contract tests in `tests/agent-skills.test.ts` to assert:

- `weave-issues` writes/reconciles local `tasks.md`
- external references are source context only
- external tracker publishing language is removed
- canonical `tasks.md` sections are documented
- statuses include `todo`, `in_progress`, `blocked`, `done`, `not_tested`, and `invalid`
- `not_tested` is implementer-applied
- invalid tasks are separated from the active task index
- lifecycle progress guidance uses existing source IDs
- installed opencode skill includes the updated instructions

Update README-related assertions if any tests pin skill descriptions or command examples.

Run:

```bash
npm run test
npm run typecheck
npm run build
```

## Security and Data Integrity

The revised skill should explicitly forbid external issue tracker mutation. External issue URLs or issue numbers are read-only context when available.

Local data integrity concern is accidental loss of task progress during reconciliation. Mitigation is instruction-level: preserve statuses and checked acceptance criteria when task intent maps cleanly, mark obsolete tasks `invalid`, and require preview/approval before writing.

## Implementation Risks

- Risk: Agents still publish external issues because old wording remains somewhere.
  Impact: Behavior conflicts with the PRD.
  Mitigation: Remove tracker publishing language from canonical, installed, wrapper, and README surfaces; add tests for local-only wording.

- Risk: Installed copies diverge from canonical templates.
  Impact: Local agent behavior differs from shipped behavior.
  Mitigation: Update installed copies and keep installed-copy alignment tests passing.

- Risk: Source-aware progress guidance implies unsupported source IDs.
  Impact: Agents call `weave change progress` with invalid sources.
  Mitigation: Document that lifecycle progress uses only existing source IDs and concrete external/local references live in `tasks.md`.

- Risk: `not_tested` is assigned during generation.
  Impact: Unstarted tasks look implemented but unverified.
  Mitigation: State that new generated tasks start as `todo`; implementers apply `not_tested` only after execution.

## Assumptions

- This change is limited to skill/templates/docs/tests.
- `tasks.md` remains the canonical local issue/task artifact.
- Existing lifecycle source IDs are sufficient.
- Agents can inspect repo testing conventions well enough from skill instructions.
- Exact prose can be refined during implementation if the behavior remains intact.

## Open Technical Questions

None.

## Product Questions Raised by Technical Design

None.

## Revision History

- 2026-06-02: Initial architecture generated from `prd.md` and codebase review.
