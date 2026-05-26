# Add Clarify Skill Tasks

## Source

This task breakdown is derived from the add clarify skill exploration, PRD, and architecture. The tasks are written as tracer-bullet slices: each one should deliver user-visible or agent-visible behavior across bundled skill content, agent distribution surfaces, documentation, and tests.

## Tracking

Use the task metadata below as the durable source of truth for implementation progress inside this change.

Status values:

```text
todo
in_progress
blocked
done
```

Rules:

- Set exactly one task to `in_progress` per agent at a time.
- Set `Owner` when a task is picked up.
- Set `Started` when implementation begins.
- Set `Completed` only after the task is done and verified.
- Fill `Verification` with the commands or checks that proved the task is complete.
- Use `Notes` for blockers, partial progress, or handoff context.

## Task Breakdown

### 1. Ship `weave-clarify` as a Discoverable Bundled Skill

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build; node dist/cli.js skill show weave-clarify

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** None - can start immediately

**User stories covered:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10

**What to build**

Add the canonical `weave-clarify` skill template so Weave can discover, show, and install it through the existing bundled skill system. The skill should guide an agent through clarifying one selected active-change artifact at a time, with explicit behavior for target selection, artifact read order, clarification questions, one-artifact writes, superseded-scope handling, and follow-up artifact reporting.

**Acceptance criteria**

- [x] `templates/skills/weave-clarify/SKILL.md` exists with valid frontmatter.
- [x] The skill name is `weave-clarify`.
- [x] The description positions the skill as clarification or revision of one existing Weave change artifact.
- [x] The skill resolves Weave workspace and active change context before reading or writing artifacts.
- [x] The skill supports `exploration`, `prd`, and `architecture` targets.
- [x] The skill asks the user to choose a target when no target is provided and multiple artifacts may be affected.
- [x] The skill instructs agents to update only the selected artifact.
- [x] The skill explicitly rejects cascade writes, autonomous mode, stage advancement, and issue generation.
- [x] The skill preserves still-valid content and records superseded, removed, or narrowed scope explicitly.
- [x] The skill reports likely follow-up artifacts after completing a clarification.
- [x] Tests cover `readDefaultSkill("weave-clarify")` with expected metadata, content markers, source path, and hash.
- [x] Tests cover `listDefaultSkills()` including `weave-clarify`.
- [x] CLI tests cover `skills list` and `skill show weave-clarify`.

### 2. Distribute `weave-clarify` Across Supported Agent Surfaces

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build; node dist/cli.js agent install opencode --json in /private/tmp/weave-clarify-install.5EtdYK

**Notes:** Implemented in this change. Existing modified-file protection tests cover the shared install/update path used by this skill.

**Type:** AFK

**Blocked by:** Task 1

**User stories covered:** 7, 8, 9

**What to build**

Make `weave-clarify` available to every supported agent integration through the same install/update/reset/diff paths as existing skills. OpenCode should receive both the shared skill and a slash-command wrapper. The tracked installed surfaces in this repo should mirror the canonical template so local agent use stays consistent with bundled defaults.

**Acceptance criteria**

- [x] `templates/opencode/commands/weave-clarify.md` exists and loads the `weave-clarify` skill.
- [x] `.agents/skills/weave-clarify/SKILL.md` exists and matches the canonical skill content.
- [x] `.claude/skills/weave-clarify/SKILL.md` exists and matches the canonical skill content.
- [x] `.opencode/commands/weave-clarify.md` exists and matches the canonical OpenCode wrapper content.
- [x] Codex install results include the `weave-clarify` skill.
- [x] Cursor install results include the `weave-clarify` skill.
- [x] Claude install results include the `weave-clarify` skill.
- [x] OpenCode install results include the `weave-clarify` skill and command wrapper.
- [x] `all` install results and manifest assertions include `weave-clarify` for supported agents.
- [x] Re-running install remains idempotent for `weave-clarify`.
- [x] Modified-file protection continues to work for installed skill and OpenCode command artifacts.

### 3. Document `weave-clarify` in the Weave Skill Workflow

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Task 1

**User stories covered:** 1, 2, 3, 8, 9

**What to build**

Update user-facing documentation so users understand when to use `weave-clarify` and how it differs from generation-oriented skills. Documentation should describe it as the refinement workflow for existing active-change artifacts, not as a new change creator, PRD generator, architecture generator, or multi-artifact rewrite command.

**Acceptance criteria**

- [x] README skill list includes `weave-clarify`.
- [x] README examples include invoking `weave-clarify`.
- [x] Documentation explains that `weave-clarify` refines an existing artifact.
- [x] Documentation distinguishes `weave-clarify` from `weave-explore`, `weave-prd`, and `weave-architect`.
- [x] Documentation states or implies that follow-up artifacts should be clarified separately.
- [x] CLI documentation/tests that assert skill list content are updated for the new skill.

### 4. Verify End-to-End Package Readiness

**Status:** done

**Owner:** codex

**Started:** 2026-05-26

**Completed:** 2026-05-26

**Verification:** npm run typecheck; npm test; npm run build; node dist/cli.js skill show weave-clarify; node dist/cli.js agent install opencode --json in /private/tmp/weave-clarify-install.5EtdYK

**Notes:** Implemented in this change.

**Type:** AFK

**Blocked by:** Tasks 1, 2, and 3

**User stories covered:** 9, 10

**What to build**

Validate that the new skill is fully integrated into the package and agent distribution workflow. This slice should fix any test, typecheck, build, or documentation fallout from the preceding tasks and manually inspect the final skill text against the PRD constraints.

**Acceptance criteria**

- [x] `npm run typecheck` passes.
- [x] `npm test` passes.
- [x] `npm run build` passes.
- [x] `weave skill show weave-clarify` works through the built or source CLI.
- [x] `weave agent install opencode` installs both the `weave-clarify` skill and OpenCode command in a temporary workspace.
- [x] Manual review confirms the skill is interactive-only.
- [x] Manual review confirms the skill supports `exploration`, `prd`, and `architecture`.
- [x] Manual review confirms the skill writes only one selected artifact.
- [x] Manual review confirms the skill reports follow-up artifacts instead of cascade-writing them.
- [x] Manual review confirms there is no autonomous mode behavior in v1.

## Review Questions

- Does this granularity feel right, or should any task be split further?
- Are the dependency relationships correct?
- Should any task be marked HITL, or are all of these safe as AFK implementation slices?
