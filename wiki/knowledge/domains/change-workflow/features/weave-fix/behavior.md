# weave-fix

## Purpose

`weave-fix` is the chat-driven entry point for `--type fix` changes. It writes `findings.md`, scaffolds a single initial slice under `task-slices/01-<slug>/`, and progresses the `findings` lane.

## Current Behavior

Single-turn flow from a bug description in chat:

1. Derive slug (confirm if ambiguous).
2. `weave new --type fix <slug>`.
3. Write `findings.md` from `findings-template.md` (Summary required minimum).
4. Scaffold `task-slices/01-<slug>/` with `tasks.md` + `status.yml` (skip `slice.md` / `contracts.md` for trivial fixes).
5. `weave slice rollup --all`.
6. `weave change progress findings --source discussion`.
7. Report next step (`/weave-execute 01 T1` or `/weave-next afk`).

Re-invocation updates `findings.md` without re-scaffolding unless the slice folder is missing. Scope growth: update `findings.md`, re-run `/weave-slices`.

## Domain Model

`findings.md` sections: Summary (required), Repro, Scope & Impact, Root cause, Related.

Fix lane chain: `findings` → optional `architecture` → `slices`.

## Source Anchors

- Canonical skill: `templates/skills/weave-fix/SKILL.md`
- Template: `templates/skills/weave-fix/findings-template.md`
- Lane: `weave change progress findings`

## Change History

- 2026-06-09 (change `260609-rrsq-weave-slice`): introduced; `last_changed_in: 0.1.6`.

## Open Questions

- None at this time.
