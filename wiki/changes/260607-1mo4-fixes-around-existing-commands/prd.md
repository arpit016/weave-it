---
artifact: prd
status: draft
owner: product
created_at: 2026-06-07T12:20:00.000Z
updated_at: 2026-06-07T12:29:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Fixes Around Existing Commands PRD

## Problem Statement

Weave is adding more workspace-aware workflows and more skill-driven command usage. Two parts of the experience are currently too noisy or unclear for users and agents.

First, workspace mode lets `.weave/workspace.yml` register multiple repos while the actual repo folders are gitignored by the outer workspace repo. This is intentional: the workspace repo can be shared without committing nested repos. But when a new engineer clones only the workspace repo, `weave workspace` can list registered repos that are not present locally. Today that distinction is not visible enough, so agents and users can over-assume that every registered repo is available for inspection.

Second, Weave skills run many CLI commands only to resolve context or update local lifecycle state. Commands such as `weave workspace --json`, `weave change current --json`, `weave change status --json`, `weave artifact current set <lane> --json`, and `weave change progress ... --json` are internal steps. Showing their raw output, JSON payloads, or notices makes skill responses noisy and distracts from the actual work.

This matters because Weave should feel like a quiet workflow assistant. Users should see useful outcomes and blockers, not the plumbing required to derive them.

## Goals

- Make `weave workspace` communicate whether registered workspace repos are present locally or missing.
- Help agents understand when a registered repo is unavailable as local context.
- Preserve the current rule that workspace discovery does not automatically clone, pull, or hydrate repos.
- Make Weave skill responses quieter by treating CLI command output as internal by default.
- Replace verbatim Tier 1 notice surfacing with user-relevance filtering and plain-language summaries.
- Keep user-facing blockers and outcomes clear, especially missing repo blockers and task/branch preparation results.

## Non-Goals

- Do not implement automatic cloning or pulling of every repo listed in `.weave/workspace.yml`.
- Do not treat `.gitignore` as the source of truth for workspace repos.
- Do not design or implement a full `weave hydrate` command in this change.
- Do not add availability signals to repo-mode `session.folders` in this change.
- Do not remove CLI JSON output; skills and automation still need structured command results.
- Do not hide real failures, blockers, or user-actionable setup problems.

## Actors

- New engineers cloning an existing Weave workspace.
- Existing Weave users working in workspace mode.
- Agents using Weave skills such as `weave-explore`, `weave-architect`, `weave-prd`, `weave-prepare`, and `weave-execute`.
- Maintainers of Weave skill templates.
- Automation or scripts consuming `--json` command output.

## Current Behavior

Workspace mode stores registered repos in `.weave/workspace.yml`. The outer workspace repo commits that file, but gitignored sub-repo folders are not committed. `weave add <git-url>` can explicitly clone and register a repo, and `weave add <path>` can register an existing local folder.

`weave workspace` currently reads workspace metadata and lists registered repos. In workspace mode it is read-only and does not clone, move, or modify files. Its current repo listing does not clearly tell the user or an agent whether each registered repo path exists locally.

Task preparation already blocks when selected workspace task metadata references a registered repo path that does not exist locally. That behavior is correct because the selected task actually needs the repo.

Weave skill files currently include repeated `# Surface Weave Notices` guidance that tells agents to surface Tier 1 notices verbatim near the start of responses. Several skills also instruct agents to run CLI command blocks for context loading or lifecycle updates. The desired behavior is for those command results to guide the skill internally, not to become visible response content.

## Proposed Product Behavior

`weave workspace` should continue to be a lightweight read-only context command. In workspace mode, each registered repo should include a local availability signal so users and agents can distinguish present repos from missing repos. The JSON field should be `availability`, with initial values `present` and `missing`.

Human-readable `weave workspace` output should include availability as a dedicated repo column. Missing repos should be visible without requiring the user to infer state from errors later.

When a repo is registered but missing locally, Weave should not automatically clone it. The missing state should be informational unless the user runs a command whose selected work requires that repo. If the repo has a recorded remote, Weave or the consuming skill may tell the user that they can clone the repo if they need that context. A future hydrate command may exist, but this PRD only requires explicit missing-repo visibility and guidance.

Skill instructions should establish a general rule: Weave CLI commands are silent internal operations unless their result changes what the user needs to know. Skills should not paste raw command output, JSON payloads, command echoes, internal session-state writes, lifecycle progress payloads, or verbatim notice text.

Skills should synthesize command results into short user-facing summaries. They should surface blockers, failures, missing repo facts, branch/task outcomes, lifecycle outcomes, and required user actions. Routine notices or non-actionable diagnostics should be suppressed.

## User Workflows

### Workflow: New Engineer Inspects A Fresh Workspace Clone

1. A new engineer clones the outer workspace repo.
2. The checkout includes `.weave/workspace.yml` and `.gitignore`.
3. Registered sub-repo folders may be absent because they are gitignored.
4. The engineer runs `weave workspace`.
5. The system lists registered repos with a dedicated availability value for each repo.
6. The system does not clone missing repos automatically.
7. If the engineer needs a missing repo, they can clone it manually or use the appropriate explicit add/hydration flow if one exists later.

### Workflow: Agent Explores A Workspace

1. A skill runs `weave workspace --json` to resolve context.
2. The skill sees registered repos and their local availability.
3. The skill lightly inventories relevant present repos.
4. The skill treats missing repos as unavailable context.
5. The skill mentions a missing repo only when it affects the user's request, the active change, or confidence in the answer.

### Workflow: Agent Runs Internal Context Commands

1. A skill runs Weave commands to resolve workspace, active change, status, or artifact lane.
2. The skill uses the command results internally.
3. The user does not see command echoes, raw stdout, or JSON.
4. The skill responds with a concise synthesized result, such as the artifact updated, tasks prepared, blocker encountered, or next question.

### Workflow: Command Returns Notices

1. A Tier 1 command returns a `notices` array.
2. The skill classifies whether each notice is relevant to the current work.
3. Non-actionable notices are suppressed.
4. User-actionable notices are summarized in normal language.
5. The skill does not paste notice text verbatim.

## User Stories

1. As a new engineer, I want `weave workspace` to show which registered repos are missing locally, so that I understand why some context may be unavailable.
2. As a workspace user, I want Weave to avoid cloning repos automatically, so that it does not unexpectedly pull private, large, or irrelevant code.
3. As a user asking an agent for exploration or architecture help, I want the agent to explain when a relevant repo is missing, so that I can decide whether to clone it.
4. As a user invoking a Weave skill, I want the response to summarize outcomes instead of dumping command output, so that I can focus on the decision or artifact.
5. As a maintainer, I want consistent skill guidance across templates and installed copies, so that different skills do not behave differently.
6. As an automation consumer, I want `--json` output to remain available, so that scripts and skills can still make structured decisions.

## Functional Requirements

- The system should keep `.weave/workspace.yml` as the committed source of truth for workspace repo registrations.
- The system should not infer registered repos from `.gitignore`.
- `weave workspace --json` should include `availability` for each workspace-mode repo entry.
- `availability` should initially support `present` and `missing`.
- Human-readable `weave workspace` output should include a dedicated availability column for workspace-mode repo entries.
- `weave workspace` should continue to work for fresh workspace clones without requiring `weave init`.
- `weave workspace` should remain read-only and should not clone, move, create, delete, or modify repo folders.
- Missing registered repos should not cause `weave workspace` to fail.
- Commands that need a selected missing repo should continue to block with a clear missing repo message.
- Repo-mode `session.folders` output should remain unchanged for this PRD.
- Skills should treat Weave CLI command output as internal unless it carries a user-relevant result.
- Skills should not show raw stdout, JSON payloads, command echoes, internal state-write confirmations, or verbatim notices.
- Skills should summarize user-actionable notices in plain language only when they affect the current request or require user action.
- Skill guidance should be updated consistently across `templates/skills`, `.agents/skills`, and `.claude/skills`.
- The product should preserve explicit completion summaries for artifact creation, artifact revision, lifecycle progress failures, task preparation outcomes, and execution outcomes.

## Permissions and Access Control

This change does not introduce new permissions or access-control behavior.

Repo availability is local filesystem state. A missing repo signal should not imply that the user has permission to clone that repo. If a remote is present, Weave may display or summarize it as existing metadata, but successful cloning remains subject to the user's existing git credentials and access.

## States and Lifecycle

Workspace repo availability has at least two user-facing states:

- `present`: the registered repo path exists locally.
- `missing`: the registered repo path does not exist locally.

These states should be represented in JSON as:

```json
{
  "availability": "present"
}
```

Future states may be useful, but are not required for the first version:

- `invalid`: the path exists but is not a directory.
- `unknown`: availability could not be checked.

Skill command output has three response states:

- `silent`: command result is used internally and not mentioned.
- `summarized`: command result produces a concise user-facing outcome.
- `blocked`: command result prevents progress and must be explained.

## Notifications and Visibility

`weave workspace` should make repo availability visible in both human-readable and JSON output. Human-readable output should include availability as a column alongside repo id, path, kind, and remote when present.

Skills should make missing repos visible only when relevant. For example, if a backend repo is registered but missing and the user asks a frontend-only question, the skill can ignore the missing backend repo. If the user asks for cross-repo architecture and the backend repo is missing, the skill should state that the backend repo was unavailable and may need to be cloned for full context.

Tier 1 notices should no longer be visible by default. They should appear only when they require user attention, and even then as a plain-language summary rather than raw notice text. User-actionable notices are determined by current-task impact, not by a fixed category list. A notice is user-actionable when it blocks the requested work, changes the recommended next step, warns that the skill behavior being used is stale, or asks the user to perform an explicit maintenance action before continuing confidently.

## Edge Cases

- A workspace has registered repos but none are present locally: `weave workspace` should still succeed and show all repos as missing.
- A registered repo has no remote: the system can say it is missing, but should not suggest a clone command that cannot be derived.
- A registered repo path exists but points to a non-directory: the first version can treat this as not present or report a distinct invalid state if available.
- A skill sees many missing repos: it should summarize only relevant missing repos and avoid overwhelming the user.
- A command returns notices unrelated to the current request: the skill should suppress them.
- A command returns a notice that affects the requested operation: the skill should summarize it and explain the user action.
- A selected task references a missing repo: prepare/execution should block for that repo and explain the missing path.
- A user explicitly asks to see command output: the skill may show or summarize command output according to the user's request.

## Acceptance Criteria

- [ ] `weave workspace` in workspace mode identifies registered repos that are present locally.
- [ ] `weave workspace` in workspace mode identifies registered repos that are missing locally.
- [ ] `weave workspace --json` exposes repo availability in a stable `availability` field.
- [ ] Human-readable `weave workspace` output uses a dedicated availability column for workspace-mode repos.
- [ ] `weave workspace` remains read-only and does not clone or modify missing repos.
- [ ] Fresh workspace clones can run `weave workspace` and see registered repos without running `weave init`.
- [ ] Skills no longer instruct agents to surface Tier 1 notices verbatim.
- [ ] Skills instruct agents to run Weave CLI commands silently by default.
- [ ] Skills still surface blockers, failures, missing relevant repos, task/branch outcomes, and lifecycle progress failures.
- [ ] Skill guidance is consistent across templates and installed skill copies.
- [ ] Existing task preparation missing-repo blockers remain clear and user-actionable.

## Rollout Considerations

This change is low risk for users because it makes existing commands more informative and existing skills quieter. It should not remove any command or workflow.

The main rollout consideration is compatibility for JSON consumers. The new `availability` field should be additive on `repos[]`, with existing fields kept unchanged. Human-readable output can add an availability column because it improves scanability without changing command behavior.

Skill template changes should be propagated to installed skill copies so users get consistent behavior immediately in this repo. A later package release can distribute the updated templates more broadly.

## Analytics and Success Metrics

- Fewer user complaints or corrections about noisy skill responses.
- Fewer cases where agents assume a registered but missing repo is available.
- Fewer repeated explanations needed around fresh workspace clone behavior.
- Successful skill responses that summarize outcomes without exposing internal command output.
- Maintainers can verify by searching skills for removed verbatim notice guidance.

## Revision History

- 2026-06-07: Initial PRD generated from `exploration.md`, exploration session context, and CLI command knowledge.
- 2026-06-07: Answered open product questions by choosing `availability`, a dedicated human-readable availability column, workspace-mode-only repo presence for v1, no hydrate command in this scope, and impact-based notice surfacing.

## Assumptions

- Existing `--json` consumers can tolerate additive fields in repo objects.
- A future hydrate command, if added, should be explicit and user-invoked rather than automatic workspace discovery behavior.

## Open Questions

- None at this time.

## Answered Questions

- Repo availability should be represented in JSON as `availability`, not `available`, `present`, or generic `status`.
- Human-readable `weave workspace` output should include a dedicated availability column.
- Repo presence should be computed only for workspace-mode registered repos in this change. Repo-mode `session.folders` availability can be considered separately later.
- `weave hydrate` remains out of scope. If added later, it should be explicit and user-invoked, likely accepting selected repo ids first and an explicit all-missing option only if there is a clear user need.
- User-actionable notices should be impact-based, not category-based. A notice should surface only when it blocks the requested work, changes the next step, warns that the skill behavior in use is stale, or asks for explicit maintenance before continuing confidently.

## Out of Scope

- Automatic cloning, pulling, or hydration of missing repos.
- Authentication or authorization handling for repo remotes.
- Changing how `weave add` registers repos.
- Adding repo availability to repo-mode session folder output.
- Changing task selection semantics.
- Removing JSON output from commands.
- Replacing the lifecycle/staleness model.

## Further Notes

The product direction is to keep Weave quiet by default while still making important context visible. Workspace repo availability should help agents make better context decisions, and silent skill command output should make the chat experience feel focused on product outcomes rather than internal mechanics.
