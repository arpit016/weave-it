---
artifact: architecture
facet: skill-contracts
status: draft
owner: engineering
created_at: 2026-06-10T19:05:20.000Z
updated_at: 2026-06-10T19:05:20.000Z
source: prd.md, codebase, architecture discussion
---

# Skill Contracts

## Current Contracts To Replace

Current skill templates encode the old local artifact-lane model:

- `weave-explore`, `weave-prd`, and `weave-architect` enter a lane by calling `weave artifact current set <lane> --json`.
- `weave-architect` verifies the stored lane with `weave artifact current --json`.
- `weave-capture` uses stored artifact context when the user did not name a target.
- `weave-next` reads stored artifact context as an orientation signal.

These contracts conflict with the new explicit-target model and will also break once the `weave artifact` command is removed.

## Proposed Contracts

### `weave-explore`

- Keep Plan Mode guard if product discovery should remain read-only.
- Remove local lane commit language.
- Treat the skill as discussion/orientation only unless it explicitly writes its own artifact by design.
- Tell users to persist with `weave-capture exploration` when capture is needed.

### `weave-prd`

- Remove `weave artifact current set prd --json`.
- Keep PRD-generation and PRD-progress behavior.
- Do not require `current_artifact` for resume.
- Use `prd.md` plus PRD sessions as durable/current context.

### `weave-architect`

- Remove all lane-commit and lane-verification commands.
- Keep read-only architecture thinking behavior.
- End with capture guidance: `Run weave-capture architecture`.

### `weave-capture`

- Artifact capture target resolution:
  - explicit target wins;
  - if missing, ask `Which artifact should I capture this into: exploration, prd, findings, or architecture?` before writing.
- Session-only capture target resolution:
  - explicit lane wins;
  - if missing, ask `Which lane should I capture this session under: exploration, prd, findings, or architecture?`.
- Defensive lane verification still exists, but it compares explicit target against conversation substance rather than stored artifact context.
- Remove all `weave artifact current --json` references.

### `weave-next`

- Read active change, `status.yml`, live artifacts, stale flags, knowledge freshness, and relevant session notes.
- Do not read or mention stored artifact lane state.
- If no branch-derived active change exists, recommend `weave change new` or `weave change switch`.

## Knowledge Docs To Update

- `wiki/knowledge/domains/change-workflow/domain-wide/change-creation-and-stages.md`: remove local current artifact context language and document git requirement for `weave change new`.
- `wiki/knowledge/domains/change-workflow/features/weave-capture/behavior.md`: replace stored artifact context behavior with explicit target behavior.
- `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md`: remove lane-commit discovery commands.
- `wiki/knowledge/domains/change-workflow/domain-wide/workspace-aware-skill-context.md`: clarify workspace root branch authority.
- `wiki/knowledge/domains/cli-commands/features/core-command-reference/behavior.md`: remove or update any `weave artifact current` command documentation if present.

## Test Contract Updates

`tests/agent-skills.test.ts` should stop asserting old strings and should assert the new contract:

- no bundled skill contains `weave artifact current set`;
- no bundled skill uses `weave artifact current --json` for lane routing;
- `weave-capture` contains explicit target prompts;
- `weave-architect` stays read-only and recommends `weave-capture architecture` for persistence;
- `weave-next` orients from active change and artifacts, not stored artifact context.

If `src/lib/skill-template-checks.ts` contains byte-identical expected blocks that mention artifact current behavior, update those blocks in the same change.

## Installed Skill Copies

Installed local skill copies under `.agents/`, `.claude/`, `.cursor/`, and any other generated destinations may be modified locally. The implementation should update bundled templates first. Installed copy updates can happen through the existing agent-update flow unless the task explicitly includes updating generated copies.

## Risks

- Existing installed skills may continue calling removed commands until refreshed. This is acceptable for the product direction, but release notes or status notices should make skill update needs clear.
- Tests may encode exact text heavily. Update assertions to focus on behavior-critical strings rather than preserving outdated implementation prose.
