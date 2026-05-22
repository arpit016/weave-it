# Weave Skills Implementation Plan
## Goal
Add first-class support for installing Weave agent skills into Codex, Cursor, and Claude while keeping Weave CLI-first.
Skills are workflow instructions. Weave CLI commands are the implementation surface.
## Core Decisions
- Use the open Agent Skills format: `<skill-name>/SKILL.md`.
- Use `.agents/skills` for Codex and Cursor.
- Use `.claude/skills` for Claude Code.
- Do not generate `.cursor/skills` by default because Cursor already supports `.agents/skills`.
- Installed skills are normal repo files and may be edited by users.
- Weave must not overwrite user-modified skills unless explicitly requested.
## Install Targets
| Command | Target |
|---|---|
| `weave agent install codex` | `.agents/skills/<skill-name>/SKILL.md` |
| `weave agent install cursor` | `.agents/skills/<skill-name>/SKILL.md` |
| `weave agent install claude` | `.claude/skills/<skill-name>/SKILL.md` |
| `weave agent install all` | `.agents/skills/**` and `.claude/skills/**` |
## Source Layout
Package-owned default skills should live in:
```text
templates/
  skills/
    hammer-product/
      SKILL.md
Current skill draft to migrate:
skills/explore-product.md
Target canonical default:
templates/skills/explore-product/SKILL.md
Installed Layout
For Codex or Cursor:
.agents/
  skills/
    hammer-product/
      SKILL.md
For Claude:
.claude/
  skills/
    hammer-product/
      SKILL.md
User Customization Rule
Installed skills are user-editable.
If a user edits:
.agents/skills/hammer-product/SKILL.md
Weave should preserve that edit.
Default policy:
Install missing skills.
Update untouched skills.
Skip modified skills.
Overwrite only with explicit reset.
Commands
weave agent install <agent>
Installs missing skills for one agent.
Supported agents:
codex
cursor
claude
all
Behavior:
- 
Create target skill directory if missing.
- 
Copy default skills from templates/skills.
- 
Do not overwrite existing modified skills.
- 
Print installed/skipped status.
weave agent update <agent>
Updates installed skills when safe.
Behavior:
- 
Update skills that still match the previous Weave-managed version.
- 
Skip user-modified skills.
- 
Tell the user how to inspect or reset skipped skills.
weave agent diff <agent> [skill]
Shows difference between installed skill and current Weave default.
weave agent reset <agent> [skill]
Explicitly overwrites installed skill with current Weave default.
This is the only command that should overwrite user modifications.
weave skills list
Lists available default skills shipped with Weave.
weave skill show <name>
Prints the default skill content.
Tracking Managed State
Use a lightweight manifest to detect whether a skill has been modified.
Recommended location:
.weave/agents.yml
Example:
version: 1
installed:
  codex:
    hammer-product:
      path: .agents/skills/hammer-product/SKILL.md
      source_hash: sha256:abc123
      installed_hash: sha256:def456
      installed_at: "2026-05-19T00:00:00.000Z"
  claude:
    hammer-product:
      path: .claude/skills/hammer-product/SKILL.md
      source_hash: sha256:abc123
      installed_hash: sha256:def456
      installed_at: "2026-05-19T00:00:00.000Z"
Update safety check:
- 
If current installed file hash equals installed_hash, Weave can update it.
- 
If current installed file hash differs from installed_hash, treat it as user-modified and skip.
- 
reset replaces the file and updates hashes.
Skill Format
Each skill should be a full Agent Skills-compatible SKILL.md.
Minimum frontmatter:
---
name: hammer-product
description: Stress-test product requirements against the current system, workflows, and domain language. Use when refining PRDs, validating workflows, uncovering edge cases, clarifying ownership, or aligning new features with existing product behavior.
---
Avoid agent-specific frontmatter in V1.
Do not rely on Claude-only features, Cursor-only features, or Codex-only metadata for core behavior.
Common Weave Skill Contract
Every Weave skill should instruct agents to start with:
weave workspace --json
Skills should use returned folders as the current session boundary.
Skills should prefer:
wiki/knowledge/**
wiki/features/**
Skills should not assume unrelated folders are in scope.
Phase 1: Move To Canonical Skill Template
Tasks:
- 
Create templates/skills/hammer-product/SKILL.md.
- 
Move the current authored skill content into that file.
- 
Stop using wrapper-only skill files as the canonical source.
- 
Keep skills/explore-product.md only if still useful during transition.
Exit criteria:
- 
hammer-product exists as a complete SKILL.md.
- 
No agent has to follow a relative pointer to skills/explore-product.md.
Phase 2: Add Skill Discovery Helpers
Tasks:
- 
Add helper to list package default skills.
- 
Add helper to read a default skill by name.
- 
Add SHA-256 hashing for default and installed skill files.
- 
Reuse existing hash helper if practical.
Exit criteria:
- 
Code can enumerate templates/skills/*/SKILL.md.
- 
Code can return skill name, description, source path, and hash.
Phase 3: Implement Install Targets
Tasks:
- 
Add agent target resolver:
- 
codex -> .agents/skills
- 
cursor -> .agents/skills
- 
claude -> .claude/skills
- 
all -> both .agents/skills and .claude/skills
- 
Add directory creation.
- 
Add skill copy logic.
- 
Add manifest update logic.
Exit criteria:
- 
weave agent install codex writes .agents/skills/hammer-product/SKILL.md.
- 
weave agent install cursor writes .agents/skills/hammer-product/SKILL.md.
- 
weave agent install claude writes .claude/skills/hammer-product/SKILL.md.
- 
Existing modified skills are skipped.
Phase 4: Add Update, Diff, And Reset
Tasks:
- 
Add safe update behavior.
- 
Add modified-file detection.
- 
Add diff output.
- 
Add explicit reset behavior.
Exit criteria:
- 
weave agent update codex updates only untouched skills.
- 
Modified skills are skipped with a clear message.
- 
weave agent reset codex hammer-product overwrites only that skill.
- 
Manifest hashes are refreshed after update/reset.
Phase 5: Add CLI Commands
Tasks:
- 
Add src/commands/agent.ts.
- 
Add src/commands/skills.ts.
- 
Register commands in src/cli.ts.
- 
Keep output concise and script-friendly.
- 
Add --json where useful.
Commands:
weave agent install <agent>
weave agent update <agent>
weave agent diff <agent> [skill]
weave agent reset <agent> [skill]
weave skills list
weave skill show <name>
Exit criteria:
- 
Commands are discoverable through weave --help.
- 
Invalid agents and skill names produce clear errors.
Phase 6: Tests
Add tests for:
- 
Installing Codex skills.
- 
Installing Cursor skills.
- 
Installing Claude skills.
- 
Installing all.
- 
Re-running install idempotently.
- 
Skipping modified skills.
- 
Updating untouched skills.
- 
Resetting modified skills.
- 
Listing skills.
- 
Showing skill content.
V1 Non-Goals
- 
No .cursor/skills generation by default.
- 
No global installs to ~/.agents/skills or ~/.claude/skills.
- 
No plugin marketplace.
- 
No automatic skill generation from arbitrary prompts.
- 
No agent-specific skill variants unless a concrete compatibility issue appears.
Future Enhancements
Potential later additions:
- 
weave agent install --global.
- 
weave agent install cursor --native to write .cursor/skills.
- 
Agent-specific overlays for Claude/Codex/Cursor.
- 
Skill version metadata.
- 
Skill packs.
- 
Team policy for locked skills.
