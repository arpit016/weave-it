# Add Clarify Skill Architecture

## Summary

This change adds `weave-clarify` as a new bundled Agent Skill for interactive clarification of existing Weave change artifacts. The skill is not a new runtime command. It is static skill content distributed through the existing Weave agent skill installation system.

The affected systems are the default skill templates, OpenCode command wrappers, installed agent skill surfaces tracked in this repo, README documentation, and tests that assert bundled skill behavior. The implementation should add the new skill as another discovered template under `templates/skills`, with a matching OpenCode wrapper under `templates/opencode/commands`.

The main constraint is preserving existing distribution behavior: `weave agent install|update|reset|diff` already discovers skill template directories dynamically and protects modified installed files through `.weave/agents.yml` hashes. The change should use that mechanism instead of adding a separate registry or CLI command.

## PRD Context

PRD path: `wiki/changes/260526-md6j-add-clarify-skill/prd.md`

This architecture supports the PRD goals to:

- add a `weave-clarify` skill for interactive refinement of existing Weave change artifacts
- support clarification of `exploration.md`, `prd.md`, and `architecture.md`
- update one selected artifact at a time
- preserve still-valid content and explicitly record superseded, removed, or narrowed scope
- report follow-up artifacts without editing them automatically
- keep v1 user-invoked and interactive only

Product non-goals that shape the design:

- no internal autonomous clarification mode
- no cascade-write behavior
- no replacement for `weave-explore`, `weave-prd`, or `weave-architect`
- no task generation
- no new source-code runtime capability inside the skill itself

The technically relevant product assumption is that `weave-clarify` is a skill, not a CLI command. That keeps the change in the static template/distribution layer.

## Current System

Weave is a TypeScript CLI package. Its runtime CLI entrypoint is `src/cli.ts`, with command modules under `src/commands`.

Agent skills are managed by `src/lib/agent-skills.ts`:

- `listDefaultSkills()` reads directories from `templates/skills`.
- `readDefaultSkill(name)` reads `templates/skills/<name>/SKILL.md`, validates frontmatter, and computes a content hash.
- `installAgentSkills()`, `updateAgentSkills()`, `resetAgentSkills()`, and `diffAgentSkills()` install or compare discovered default artifacts.
- Codex and Cursor install skills to `.agents/skills/<skill>/SKILL.md`.
- Claude installs skills to `.claude/skills/<skill>/SKILL.md`.
- OpenCode installs skills to `.agents/skills/<skill>/SKILL.md` and slash-command wrappers to `.opencode/commands/<skill>.md`.
- OpenCode command wrappers are discovered from `templates/opencode/commands/*.md`.
- Installed artifact metadata is tracked in `.weave/agents.yml` with source and installed hashes.

There is no hard-coded skill registry. Adding a new directory under `templates/skills` makes it available to `skills list`, `skill show`, and agent install/update flows.

The repo currently tracks generated agent-facing artifacts alongside templates:

- `.agents/skills/<skill>/SKILL.md`
- `.claude/skills/<skill>/SKILL.md`
- `.opencode/commands/<skill>.md`

Tests cover default skill discovery, individual skill metadata, install/update/reset/diff behavior, OpenCode wrapper installation, and CLI skill listing/showing.

## Proposed Architecture

Add `weave-clarify` through the existing static skill distribution path.

The canonical skill source should be `templates/skills/weave-clarify/SKILL.md`. Its frontmatter should use:

```yaml
name: weave-clarify
description: Clarify and revise one existing Weave change artifact without advancing the workflow.
```

The skill body should define:

- purpose and operating principles
- context resolution using `weave workspace --json`, `weave change current --json`, and `weave change status --json`
- supported target artifacts: `exploration`, `prd`, and `architecture`
- required read order for the selected target and supporting artifacts
- target selection behavior when the user does not provide a target
- artifact-specific clarification rules
- one-artifact write limit
- follow-up artifact reporting
- completion response shape

The OpenCode wrapper should be added at `templates/opencode/commands/weave-clarify.md` using the established wrapper pattern:

```md
---
description: Clarify an existing Weave change artifact
---

Load and follow the `weave-clarify` skill.

Context: $ARGUMENTS
```

The tracked installed surfaces should be added so the repo remains internally consistent:

- `.agents/skills/weave-clarify/SKILL.md`
- `.claude/skills/weave-clarify/SKILL.md`
- `.opencode/commands/weave-clarify.md`

No changes are needed to `src/lib/agent-skills.ts`, command parsing, change metadata, session state, persistence, or package configuration.

## Data Flow

### Distribution flow

1. Developer adds `templates/skills/weave-clarify/SKILL.md`.
2. `listDefaultSkills()` discovers the new skill directory.
3. `readDefaultSkill("weave-clarify")` reads frontmatter and content, validates the name, and computes the hash.
4. `weave skills list` includes `weave-clarify`.
5. `weave skill show weave-clarify` prints the skill content.
6. `weave agent install <agent>` installs the skill to the agent-specific destination.
7. For OpenCode, the command wrapper is also installed from `templates/opencode/commands/weave-clarify.md`.
8. `.weave/agents.yml` records the installed source hash and installed hash.

### Runtime skill flow

1. User invokes `weave-clarify` through an agent or supported command wrapper.
2. Agent follows the skill instructions and resolves the active Weave workspace and change.
3. Agent resolves or asks for a single target artifact.
4. Agent reads the selected artifact first and uses supporting artifacts for context.
5. Agent asks clarification questions when the requested change is ambiguous or material.
6. Agent writes only the selected artifact.
7. Agent reports applied clarifications, open questions, and likely follow-up artifacts.

## Architecture Decisions

### Ship as static Agent Skill content

Decision: Implement `weave-clarify` as a bundled skill template, not as a TypeScript CLI command.

Rationale: The PRD defines an agent-guided clarification workflow. Existing Weave skills already handle artifact generation and revision through static instructions, and the current distribution system can ship a new skill without runtime changes.

Consequences: The behavior depends on agents following the skill instructions. There is no deterministic CLI enforcement of target parsing or one-artifact writes.

### Use dynamic template discovery

Decision: Rely on existing directory and file discovery for default skills and OpenCode wrappers.

Rationale: `agent-skills.ts` already discovers `templates/skills/*/SKILL.md` and `templates/opencode/commands/*.md`.

Consequences: No registry update is required. Tests should assert the new skill appears in discovered lists and install results.

### Keep clarification scoped to one artifact per invocation

Decision: Skill instructions should hard-require writing only the selected artifact.

Rationale: The PRD explicitly rejects cascade updates. Separate invocations keep user intent clear and reduce accidental downstream rewrites.

Consequences: Artifacts may remain stale until the user runs follow-up clarification. The skill must report follow-up targets clearly.

### Mirror installed surfaces in the repo

Decision: Add tracked `.agents`, `.claude`, and `.opencode` artifacts for `weave-clarify` alongside templates.

Rationale: The current repo already tracks installed copies of bundled skills for supported agents.

Consequences: Template and installed copies can drift if edited manually. Tests and review should compare these files for consistency.

## Rejected Alternatives

### Add a `weave clarify` CLI command

Rejected because the PRD asks for a skill and v1 behavior is conversational and agent-driven. A CLI command would require new argument parsing, artifact mutation logic, prompts, and deterministic editing behavior that is outside the current scope.

It could become viable if Weave later needs deterministic non-agent clarification flows.

### Modify existing `weave-prd` and `weave-architect` only

Rejected because the PRD identifies a cross-artifact clarification need that also includes `exploration.md`. Extending only artifact-generation skills would not provide one consistent clarification workflow.

It could become viable for small refinements to those skills after `weave-clarify` exists.

### Cascade update all affected artifacts

Rejected because it violates the one-artifact-at-a-time product decision and increases the risk of broad unintended rewrites.

It could become viable only if a future PRD adds explicit multi-artifact orchestration.

### Store clarification history in a separate file

Rejected for v1 because the PRD says to use the selected artifact's existing revision-history, open-question, assumption, or audit-trail pattern where available.

It could become viable if multiple artifacts need a shared change-level clarification log.

## Constraints and Tradeoffs

- The skill must work within the current agent skill model, where instructions guide an agent rather than runtime code enforcing behavior.
- No source-code runtime state should be added for clarification sessions.
- Installed user-modified skills must continue to be protected by existing manifest hash checks.
- OpenCode support requires both the shared skill file and a command wrapper.
- The one-artifact limit improves safety but requires explicit follow-up work for downstream artifacts.
- There is no migration or compatibility issue for existing users because adding a default skill is additive.

## Integration Points

- `templates/skills/weave-clarify/SKILL.md` integrates with `listDefaultSkills()` and `readDefaultSkill()`.
- `templates/opencode/commands/weave-clarify.md` integrates with OpenCode command wrapper discovery.
- `.agents/skills`, `.claude/skills`, and `.opencode/commands` provide checked-in agent surfaces for this repo.
- `README.md` documents the skill in the existing "Using Weave Skills" list and examples.
- Tests under `tests/agent-skills.test.ts` and `tests/cli-skills.test.ts` verify discovery, installation, manifest output, and command show/list behavior.

There are no external services, queues, schedulers, import/export formats, or API contracts.

## Rollout and Migration

Rollout is additive:

1. Add the new template and wrappers.
2. Update docs and tests.
3. Build and release the package.
4. Users run `weave agent install <agent>` or `weave agent update <agent>` to install the new skill where appropriate.

No data migration, backfill, feature flag, or rollback mechanism is required.

Rollback is removal of the template, wrapper, installed repo copies, docs, and tests before release. After release, users with an installed copy may keep it until they reset or update their agent skills.

## Observability and Operations

There is no runtime service observability to add.

Operational visibility comes from existing CLI outputs:

- `weave skills list` shows the bundled skill.
- `weave skill show weave-clarify` prints its content.
- `weave agent install|update|reset|diff` reports per-artifact statuses.
- `.weave/agents.yml` records installed hashes.

Expected failure modes:

- Missing or invalid skill frontmatter causes `readDefaultSkill("weave-clarify")` to fail.
- Missing OpenCode wrapper means OpenCode installs the skill but not the slash command.
- Existing user-modified installed copies are skipped by install/update, as designed.

Recovery uses existing commands: `weave agent diff`, `weave agent update`, or explicit `weave agent reset`.

## Testing Strategy

Unit and integration-style tests should cover:

- `readDefaultSkill("weave-clarify")` returns the expected name, description, source path, content markers, and hash.
- `listDefaultSkills()` includes `weave-clarify`.
- Installing Codex, Cursor, Claude, OpenCode, and all targets includes the new skill in results and manifests.
- OpenCode installation includes `.opencode/commands/weave-clarify.md`.
- `skills list` and `skill show weave-clarify` include the new skill and key content.
- Existing modified-file protection still applies because the new skill uses the same artifact install path.

Manual verification:

- Inspect the skill text for the PRD constraints: interactive-only, supported targets, one selected artifact, no cascade writes, follow-up artifact reporting, and no autonomous mode.
- Run `npm run typecheck`, `npm test`, and `npm run build`.

## Security and Data Integrity

This change does not introduce new runtime permissions or data stores.

The skill should instruct agents to resolve the active Weave change and write only the selected artifact. This limits accidental modification of unrelated files. The main data-integrity risk is instruction ambiguity causing an agent to update multiple artifacts or erase prior requirements. The skill text should counter that by explicitly requiring preservation of still-valid content, explicit superseded-scope recording, and one-artifact writes.

User-modified installed skills remain protected by existing manifest hash checks.

## Implementation Risks

- Risk: The skill instructions are too vague and agents cascade-update multiple artifacts.
  Impact: Planning artifacts may change more broadly than the user intended.
  Mitigation: Make the one-artifact write rule prominent and repeat it in output rules.

- Risk: Template and installed checked-in copies drift.
  Impact: Users of different agent surfaces get inconsistent behavior.
  Mitigation: Copy the canonical content exactly into tracked installed skill paths and review diffs together.

- Risk: Tests miss OpenCode command installation.
  Impact: OpenCode users cannot invoke `/weave-clarify` even though the skill exists.
  Mitigation: Extend existing OpenCode install tests to assert the command wrapper and manifest entry.

- Risk: The skill becomes a duplicate of `weave-prd` or `weave-architect`.
  Impact: Users may be confused about which skill to use.
  Mitigation: README and skill descriptions should position `weave-clarify` as refinement of existing artifacts, not initial generation.

## Assumptions

- `weave-clarify` remains a bundled Agent Skill and does not require a new CLI command.
- Current dynamic template discovery is the intended extension point for new skills.
- The repo intentionally tracks installed agent-surface copies under `.agents`, `.claude`, and `.opencode`.
- No new runtime telemetry, migration, or feature flag is needed for a static skill addition.
- The PRD does not need revision before implementation.

## Open Technical Questions

None.

## Product Questions Raised by Technical Design

None.

## Revision History

- 2026-05-26: Initial architecture generated from `prd.md` and codebase review.
