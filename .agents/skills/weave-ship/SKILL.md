---
name: weave-ship
description: Stage, commit, push, and open or refresh a PR for the active Weave change. Use when the user wants to publish exploration, PRD, architecture, implementation, or review work to the team.
---

# Purpose

Hand the orchestration of Git + GitHub for the active Weave change off to the `weave ship` CLI, then summarise the result for the user.

`weave ship` is a pure orchestrator. It introduces no new persistent state. Everything it returns is derived from live `git`, `gh`, and existing Weave session state.

# When to use

Use `weave-ship` when the user wants to:

- publish a draft of the current artifact (exploration, PRD, architecture)
- open a ready PR for an implementation or review pass
- promote an existing draft PR to ready
- confirm a Weave change is in a clean publishable state

Do **not** use this skill to write new artifacts or change scope; route to `weave-explore`, `weave-prd`, `weave-architect`, `weave-capture`, or `weave-issues` first.

# Workflow

1. Discover session context:

```bash
weave workspace --json
weave change current --json
weave artifact current --json
```

If there is no active Weave change, stop and ask the user to run `weave change new` or `weave change switch` first.

2. Confirm the user's intent. Ship is irreversible from a local-state perspective (commits land, PRs open). Read back the active change id, branch, and current lane and ask:

```text
About to ship change <id> on branch change/<id> from lane <lane>. Continue?
```

If the user has already given an explicit ship instruction, skip the confirmation and proceed.

3. Run the CLI in JSON mode so you can parse the structured result:

```bash
weave ship --json
```

Pass through any user-supplied flags. Common ones:

- `--lane <name>` to override the auto-detected lane (one of `exploration`, `prd`, `architecture`, `implementation`, `review`).
- `--draft` to force a draft PR posture.
- `--ready` to force ready posture or promote an existing draft.
- `--stash` to allow ship to set aside unrelated dirty files for the duration of this commit.
- `--message-body "..."` to extend the commit body.
- `--pr-body-extra "..."` to extend the PR body.

4. Read the returned `ShipResult` JSON. It contains a `targets[]` array; each entry is one Weave-tracked target folder.

5. Summarise to the user. For each target, surface:

- `lane_used` and `lane_source`
- `precondition.ok` (and `reason` / `expected` / `actual` when not ok)
- `commit.sha` (or `commit.skipped` and `commit.reason`)
- `push.pushed` (or `push.error`)
- `pr.action` and `pr.url` when present
- any `guard.leaked_files`
- any `foreign_knowledge_files`
- any `stash.conflict` if `stash.used` is true and `stash.restored` is false

# Exit-code contract

`weave ship` follows this exit-code map (see `architecture.md`):

| Code | Meaning |
| --- | --- |
| 0 | All targets shipped or were already up to date |
| 1 | Unexpected internal error |
| 2 | Precondition failed (no active change, wrong branch, not a git repo, change corrupt) |
| 3 | Guard blocked, hook failed, or `gh` interaction failed |
| 4 | Push failed (network, auth, protected branch) |

When a non-zero exit appears, surface the target's precondition / guard / commit / push / pr fields verbatim and suggest the relevant remediation:

- `wrong_branch` -> `weave change switch <id>`
- `no_active_change` -> `weave change new` or `weave change switch`
- `not_git_repo` -> "this folder is not in a git repository"
- `change_corrupt` -> inspect `wiki/changes/<id>/status.yml`
- `guard_blocked` -> list `leaked_files`; suggest `--stash` or moving the leaked work to its own change
- `hook_failed` -> show the hook stderr; suggest fixing the hook or the staged content
- `push.error` -> show the underlying git error; common fixes are network, auth, or protected branches
- `pr.action: skipped_no_gh` -> "install GitHub CLI (gh) and re-run"
- `pr.action: skipped_unauth` -> "run `gh auth login` and re-run"
- `pr.action: skipped_non_github` -> "remote is not on github.com; PR creation is skipped by design"
- `pr.action: skipped_no_remote` -> "configure `origin` (e.g. `git remote add origin ...`)"

# Lane semantics

- The `--lane` flag is a one-shot override: it changes commit subject, scope partition, PR draft/ready default, auto-promotion eligibility, and review-pointer text for this single ship invocation. It does not persist.
- If the user wants to switch lanes for the rest of the session, run `weave artifact current set <lane>` instead. That mirrors the lane to `status.yml#stage` and influences future ship runs without an explicit flag.

# Behavior rules

- Do not run `git`, `gh`, or any other Git/GitHub command directly. The CLI owns the orchestration and side effects.
- Do not edit `prd.md`, `exploration.md`, `architecture.md`, or `tasks.md` from this skill. Use the appropriate lane skill first, then ship.
- Do not modify `status.yml#stage` from this skill. Lane mirroring is owned by `weave artifact current set`.
- Always use `--json` to read structured output, then translate it into a short human summary for the user.
- If the user has not committed but ship reports `commit.skipped` for `no_in_scope_changes`, do not synthesise a fake change. Tell the user the working tree is clean for this lane and ask whether they want to switch lanes or skip ship.

# Completion response

Report a concise summary like:

```text
Shipped change <id> on lane <lane>:
  Commit:  <sha-short>
  Push:    ok
  PR:      <action>  <url>
  Guard:   ok
  Stash:   not used
```

If anything was skipped, called out clearly which lane skill or follow-up step the user should run next.
