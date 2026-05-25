# Opencode Skills Implementation Plan

## Goal

Support command-driven Weave workflows inside opencode while keeping Weave's canonical workflow definition in Agent Skills.

The target user experience is:

```text
/weave-prd "Analytics of reviews"
```

Inside opencode this should load the Weave PRD workflow, discover the current Weave workspace, and guide the agent through product exploration and PRD creation or refinement.

## Core Model

Use three separate layers:

| Layer | Purpose | Example |
|---|---|---|
| Weave CLI | Deterministic implementation surface | `weave workspace --json` |
| Agent Skill | Canonical reusable workflow | `.agents/skills/weave-prd/SKILL.md` |
| Opencode Command | Slash-command shortcut | `.opencode/commands/weave-prd.md` |

The opencode command is only a thin wrapper. The skill remains the source of truth.

## Why Opencode Needs A Command Wrapper

opencode supports both skills and slash commands, but they are separate systems.

Skills are discovered from:

```text
.agents/skills/<name>/SKILL.md
.opencode/skills/<name>/SKILL.md
.claude/skills/<name>/SKILL.md
```

Slash commands are discovered from:

```text
.opencode/commands/<name>.md
```

Therefore this works with only a skill:

```text
Use the weave-prd skill for Analytics of reviews.
```

But this requires a command wrapper:

```text
/weave-prd Analytics of reviews
```

## Install Target

`weave agent install opencode` should create:

```text
.agents/
  skills/
    weave-prd/
      SKILL.md

.opencode/
  commands/
    weave-prd.md
```

Do not install to `.opencode/skills` by default. `.agents/skills` is the portable Agent Skills location and also works for Codex and Cursor.

## User Invocation

After install, opencode users can invoke Weave PRD workflow with:

```text
/weave-prd Analytics of reviews
```

They can also invoke the skill naturally:

```text
Use weave-prd for Analytics of reviews.
```

The slash command path is the preferred documented UX for opencode because it gives users a direct workflow entrypoint.

## Canonical Skill Source

Package-owned default skills should live in:

```text
templates/
  skills/
    weave-prd/
      SKILL.md
```

The installed opencode skill should be copied to:

```text
.agents/skills/weave-prd/SKILL.md
```

The current draft skill should be migrated from:

```text
skills/explore-product.md
```

to:

```text
templates/skills/weave-prd/SKILL.md
```

## Canonical Skill Name

Use:

```text
weave-prd
```

`weave-prd` is outcome-oriented and maps cleanly to the desired invocation:

```text
/weave-prd "Analytics of reviews"
```

## Skill Behavior Contract

`templates/skills/weave-prd/SKILL.md` should instruct the agent to:

- Start by running `weave workspace --json`.
- Treat returned folders as the current session boundary.
- Read relevant `wiki/knowledge/**` files before drafting requirements.
- Read relevant `wiki/changes/**` files when refining or continuing an existing change.
- Ask clarifying product questions when requirements are ambiguous.
- Avoid implementation details unless the user asks for them.
- Use code inspection only to verify current behavior and translate it into product language.
- Create or update a change PRD under `wiki/changes/<change-id>/prd.md` once there is enough clarity.

## Opencode Command Wrapper

The generated command should live at:

```text
.opencode/commands/weave-prd.md
```

Recommended content:

```md
---
description: Explore and draft a PRD using Weave context
---

Load and follow the `weave-prd` skill.

Topic: $ARGUMENTS
```

This wrapper should stay intentionally small. It should not duplicate the skill instructions.

## User Customization

Installed skills and command wrappers are normal repo files and may be edited by users.

Users may customize:

```text
.agents/skills/weave-prd/SKILL.md
.opencode/commands/weave-prd.md
```

Weave must not overwrite user-modified files unless explicitly requested.

Default policy:

- Install missing files.
- Update untouched Weave-managed files.
- Skip modified files.
- Overwrite only with explicit reset.

## Managed State

Track installed files and hashes in:

```text
.weave/agents.yml
```

Example:

```yaml
version: 1
installed:
  opencode:
    skills:
      weave-prd:
        path: .agents/skills/weave-prd/SKILL.md
        source_hash: sha256:abc123
        installed_hash: sha256:def456
        installed_at: "2026-05-19T00:00:00.000Z"
    commands:
      weave-prd:
        path: .opencode/commands/weave-prd.md
        source_hash: sha256:abc123
        installed_hash: sha256:def456
        installed_at: "2026-05-19T00:00:00.000Z"
```

Update safety check:

- If current file hash equals `installed_hash`, Weave can update the file.
- If current file hash differs from `installed_hash`, treat it as user-modified and skip it.
- `reset` replaces the file and refreshes hashes.

## CLI Commands

### `weave agent install opencode`

Installs missing opencode integration files.

Writes:

```text
.agents/skills/weave-prd/SKILL.md
.opencode/commands/weave-prd.md
```

Behavior:

- Create directories as needed.
- Copy default skill from `templates/skills/weave-prd/SKILL.md`.
- Generate command wrapper from a command template.
- Do not overwrite modified files.
- Update `.weave/agents.yml`.
- Print concise installed/skipped output.

### `weave agent update opencode`

Updates only untouched Weave-managed opencode files.

Behavior:

- Recompute current file hashes.
- Skip files modified by the user.
- Update files that still match the last installed hash.
- Refresh `.weave/agents.yml`.

### `weave agent diff opencode [name]`

Shows local changes compared with current Weave defaults.

For `weave-prd`, include both:

```text
.agents/skills/weave-prd/SKILL.md
.opencode/commands/weave-prd.md
```

### `weave agent reset opencode [name]`

Explicitly overwrites installed opencode files with current Weave defaults.

This is the only operation allowed to overwrite user modifications.

## Phase 1: Add Templates

Tasks:

- Create `templates/skills/weave-prd/SKILL.md`.
- Migrate useful content from `skills/explore-product.md`.
- Create `templates/opencode/commands/weave-prd.md`.
- Keep command wrapper minimal and delegate to the skill.

Exit criteria:

- `weave-prd` has a complete Agent Skills-compatible `SKILL.md`.
- Opencode command template invokes the skill and passes `$ARGUMENTS`.

## Phase 2: Add Opencode Target Resolver

Tasks:

- Add `opencode` to supported agent targets.
- Resolve skill target to `.agents/skills`.
- Resolve command target to `.opencode/commands`.
- Ensure `all` target behavior is explicit and documented.

Exit criteria:

- `weave agent install opencode` knows both file targets.
- No `.opencode/skills` files are generated by default.

## Phase 3: Install Logic

Tasks:

- Copy skill templates into `.agents/skills/<name>/SKILL.md`.
- Copy or render opencode command templates into `.opencode/commands/<name>.md`.
- Create parent directories as needed.
- Record source and installed hashes.
- Preserve modified files.

Exit criteria:

- Running `weave agent install opencode` creates both expected files.
- Re-running install is idempotent.
- Modified local files are skipped.

## Phase 4: Update, Diff, Reset

Tasks:

- Implement safe update behavior for opencode skill and command files.
- Implement diff output for both file types.
- Implement explicit reset behavior.

Exit criteria:

- `weave agent update opencode` updates untouched files only.
- `weave agent diff opencode weave-prd` shows skill and command differences.
- `weave agent reset opencode weave-prd` overwrites both files and updates hashes.

## Phase 5: Documentation

Tasks:

- Document opencode invocation in README.
- Show slash-command usage:
  ```text
  /weave-prd "Analytics of reviews"
  ```
- Explain that opencode also supports natural-language skill invocation.
- Explain that installed files are user-editable and protected from accidental overwrite.

Exit criteria:

- A new user can install opencode support and invoke `/weave-prd` without knowing the internal skill system.

## Phase 6: Tests

Add tests for:

- Installing opencode creates `.agents/skills/weave-prd/SKILL.md`.
- Installing opencode creates `.opencode/commands/weave-prd.md`.
- Re-running install is idempotent.
- Modified skill file is skipped.
- Modified command wrapper is skipped.
- Update refreshes untouched files.
- Reset overwrites modified files only when explicitly requested.
- Manifest records both skill and command entries.

## V1 Non-Goals

- Do not install to `.opencode/skills` by default.
- Do not create opencode-specific skill variants.
- Do not make `weave-prd` a terminal command.
- Do not duplicate skill instructions inside `.opencode/commands/weave-prd.md`.
- Do not overwrite user modifications during install or update.

## Future Enhancements

Potential later additions:

- `weave agent install opencode --native-skills` to write `.opencode/skills`.
- Global opencode install to `~/.config/opencode/skills` and `~/.config/opencode/commands`.
- Additional command wrappers for future skills like `/weave-plan`, `/weave-handoff`, and `/weave-review-prd`.
- User-selected command aliases.
- Locked/team-managed skills for organizations.
