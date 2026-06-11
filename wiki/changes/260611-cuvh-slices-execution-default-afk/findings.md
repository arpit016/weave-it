---
artifact: findings
status: draft
owner: engineering
created_at: 2026-06-11T18:24:00+05:30
updated_at: 2026-06-11T23:31:00+05:30
source: discussion
---

# Findings: Fix incorrect defaults and change-creation guidance in weave-slices and weave-fix skills

## Summary

Two Weave skill templates encode incorrect guidance:

1. `weave-slices` defaults every generated task's `Execution:` to `hitl`,
   promoting to `afk` only when fully spec'd and mechanical. This is the wrong
   bias — most generated tasks can run AFK, and HITL should be the explicit
   exception. The verification guidance inverts the manual-verification default
   the same way.
2. `weave-fix` step 2 tells the agent to run `weave new --type fix <slug>`. This
   is wrong on three counts: the command name is incorrect, it unconditionally
   creates a new change even when the agent is already on a `change/<change-id>`
   branch (re-invocation should continue the existing change), and it does not
   state the workspace-root authority for change creation.

Both affect anyone driving these workflows: `weave-slices` produces task plans
unnecessarily gated on human attention, and `weave-fix` either fails (unknown
command) or spawns a duplicate change on re-invocation.

## Repro

`weave-slices`:

1. Run `/weave-slices` on any change with upstream artifacts.
2. Observe generated tasks in `tasks.md` scaffolded with `Execution: hitl`, and
   manual verification tasks marked `hitl` unless fully mechanical.

`weave-fix`:

1. Follow the literal step 2: run `weave new --type fix <slug>`.
2. Observe `error: unknown command 'new'` (the command is `weave change new`).
3. Re-invoke `/weave-fix` while already on a `change/<change-id>` branch.
4. Observe that following step 2 verbatim would create a second, distinct
   change + branch instead of continuing the existing change.

## Scope & Impact

- Surfaces:
  - `weave-slices` SKILL.md — Generation Rules + Verification Tasks.
  - `weave-fix` SKILL.md — Single-Turn Flow step 2.
- Affected skill copies (kept in sync):
  - `templates/skills/weave-slices/SKILL.md`, `.agents/skills/weave-slices/SKILL.md`, `.claude/skills/weave-slices/SKILL.md`
  - `templates/skills/weave-fix/SKILL.md`, `.agents/skills/weave-fix/SKILL.md`, `.claude/skills/weave-fix/SKILL.md`
- Severity: low/medium for `weave-slices` (wrong default, HITL friction);
  medium for `weave-fix` (a literal command failure plus a duplicate-change
  hazard on re-invocation).
- Blast radius: every future sliced change and every fix-change entry point.

## Root cause

`weave-slices` — two lines encode an HITL-by-default policy:

- Generation Rules: `` `Execution:` defaults to `hitl`. Promote to `afk` only when fully spec'd in `contracts.md` and mechanical. ``
- Verification Tasks: `Mark it `Execution: hitl` unless the steps are fully mechanical.`

The desired policy is AFK-by-default, with HITL reserved for explicit user
request (general tasks) and for manual verification that genuinely needs a
human (browser-only check, product judgment, visual approval, credentials,
customer data, production access, or human acceptance).

`weave-fix` — step 2 reads `Run \`weave new --type fix <slug>\`.` The actual
behavior verified against the CLI (`src/lib/changes.ts`):

- The command is `weave change new <title> --type fix [--slug <slug>]`;
  `weave new` does not exist (`error: unknown command 'new'`).
- The active change is branch-derived: `currentContextForTarget` reads the
  current branch and treats `change/<change-id>` (with a matching
  `wiki/changes/<id>/status.yml`) as the active change. So when the agent is
  already on a `change/<change-id>` branch, the change already exists and step 2
  should continue that change (re-invocation: write/update `findings.md`).
- `createChange` always creates a brand-new change and switches the branch with
  no guard against an existing `change/<id>` branch — so blindly running it on an
  existing change spawns a duplicate. The skill must gate the call.
- `createChange` resolves its target via `resolveTarget(cwd, …)`, which resolves
  the **workspace root** in workspace mode. The workspace root owns the change
  store even when the command is invoked from a registered sub-repo, so the
  guidance must reflect workspace-root authority.

Desired step 2 behavior: check the current branch first (`weave change current
--json`); if it already follows the `change/<change-id>` structure (an existing
change), continue that change and write/update `findings.md` instead of creating
a new one. Otherwise run `weave change new "<title>" --type fix [--slug <slug>]`.
State that in workspace mode the change is created at and owned by the workspace
root even when invoked from a sub-repo.

## Decisions

- Duplicate-change prevention lives entirely in the `weave-fix` skill's
  structural `change/<change-id>` branch check, not in the CLI.
- A CLI dirty-worktree guard for `createChange` (mirroring `switchChange`'s
  `assertCleanGitTargets`) was explored and intentionally **dropped**: it does
  not prevent the duplicate-change case the skill now handles, and a strict
  variant would have broken the `weave init` -> first `weave change new` flow
  (untracked scaffold). See the invalid slice
  `task-slices/03-change-new-dirty-worktree-guard/` for the full rationale.

## Related

- `weave-slices` template: `templates/skills/weave-slices/SKILL.md`.
- `weave-fix` template: `templates/skills/weave-fix/SKILL.md` (step 2).
- Branch-derived active-change resolution: `src/lib/changes.ts`
  (`currentContextForTarget`, `createChange`, `resolveTarget`) and
  `wiki/changes/260610-l397-removing-local-cache/architecture/active-change-resolution.md`.
- `weave-new` skill already models the correct pattern (`weave workspace --json`
  + `weave change current`, then `weave change new "<title>"`).
