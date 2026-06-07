---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-07T12:02:30.866Z
updated_at: 2026-06-07T12:11:40.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Fixes Around Existing Commands

## Topic

Make existing Weave commands and skill-driven command usage quieter and more context-aware, especially in workspace mode where registered repos may be absent from a local checkout.

## Current Understanding

Weave workspace mode commits `.weave/workspace.yml` to the outer workspace repo. That file can register multiple sub-repos with paths, kinds, and remotes. The sub-repo folders themselves are gitignored, so a new engineer can clone the workspace repo and receive the workspace metadata without receiving every registered repo folder.

Current behavior does not implement automatic repo hydration. `weave add <git-url>` can clone and register a repo explicitly, but workspace discovery does not clone missing repos. Commands that need a selected missing repo, such as task preparation, should block or explain the missing path rather than guessing or auto-pulling.

Many Weave skills run commands such as `weave workspace --json`, `weave change current --json`, `weave change status --json`, `weave artifact current --json`, `weave artifact current set <lane> --json`, and lifecycle progress commands as internal context-loading or state-management steps. These are not user-facing product events and should not be echoed or pasted into the response.

Tier 1 notices are also too noisy when surfaced verbatim. Notices should be treated as internal diagnostics first. A skill should mention them only when they require user awareness or action, and should summarize them in normal language instead of relaying raw notice text.

## Open Questions

- Should Weave eventually add an explicit `weave hydrate` command for cloning registered repos with remotes?
- What exact shape should `weave workspace` use to expose repo presence: `present` / `missing`, a boolean in JSON, or a richer availability object?
- Should missing repo hints be produced by the CLI itself, by the skills that consume `weave workspace --json`, or both?

## Decisions

- `.weave/workspace.yml` remains the committed source of truth for workspace repo registrations.
- `.gitignore` entries are not a repo source of truth and should not trigger automatic clone behavior.
- Weave should not automatically pull or clone every registered repo when a new engineer clones the workspace.
- `weave workspace` should lightly indicate when registered repos are missing locally so agents can understand context availability.
- Missing repos are acceptable until the selected work actually requires them.
- Skills should run Weave CLI commands silently by default.
- Skills should not show raw stdout, JSON payloads, command echoes, internal session-state writes, or verbatim notice text.
- Skills should surface only user-relevant outcomes: blockers, failures, missing repo facts, branch/task outcomes, lifecycle results, and concise synthesized context or completion summaries.
- Tier 1 notices should be classified for user relevance. Non-actionable notices should be suppressed; actionable notices should be summarized in plain language.

## Scenarios

### New Engineer Clones A Workspace

Given a committed workspace repo with `.weave/workspace.yml` listing several repos, when a new engineer clones only the outer workspace repo, then `weave workspace` should list the registered repos and indicate which registered repo folders are missing locally.

The command should not clone or pull those repos automatically. If a missing repo has a remote and later becomes necessary, Weave or the skill can tell the user that the repo may need to be cloned for full context.

### Skill Exploration With Missing Repos

Given a skill is exploring a workspace and `weave workspace --json` shows registered repos, when some registered repos are missing locally, then the skill should treat those repos as unavailable context.

The skill should not fail solely because an unrelated repo is missing. It should mention missing repos only when they are relevant to the user request, the active change, or a command blocker.

### Internal Skill Commands

Given a skill runs discovery or lifecycle commands, when those commands succeed, then the user should not see raw command output.

The skill should synthesize the useful result, such as the active change, selected artifact lane, prepared branches, missing repos, or updated artifact paths.

### User-Relevant Notices

Given a command returns a `notices` array, when the notices are routine or not relevant to the current work, then the skill should suppress them.

When a notice requires user action or materially affects the requested work, the skill should summarize the issue and action in normal language.

## Existing Behavior

- `weave add <git-url>` explicitly clones a repo into a workspace and registers it.
- `weave workspace` reads metadata and lists registered repos, but current output does not communicate local presence.
- `weave task prepare` blocks when a selected workspace task references a registered repo path that does not exist locally.
- Weave skills currently contain repeated `# Surface Weave Notices` instructions that tell agents to surface Tier 1 notices verbatim.
- Several skills instruct agents to run command blocks for context loading or lifecycle updates, but the desired behavior is for these commands to be silent implementation details.

## PRD Readiness

Not ready.

The direction is clear enough to update skill instructions and likely enough to design a small `weave workspace` presence enhancement, but the exact CLI output shape for repo presence still needs to be specified before PRD or implementation.
