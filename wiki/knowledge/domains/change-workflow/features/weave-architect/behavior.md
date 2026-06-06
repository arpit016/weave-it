# weave-architect

## Purpose

`weave-architect` is the read-only architecture thinking partner for an active Weave change. It gathers context, interviews the user, stress-tests technical tradeoffs, and returns an architecture dissection in chat.

## Current Behavior

`weave-architect` must run in Plan Mode and carries the byte-identical Plan Mode Guard shared with `weave-explore`.

After resolving the active change, it commits local artifact context with:

```bash
weave artifact current set architecture --json
```

This writes local session state only. It does not write repo-tracked artifacts.

The skill reads product context, existing architecture context, architecture session notes, code, tests, docs, ADRs, and knowledge specs as needed. It supports broad architecture review and focused deep dives on topics such as schema design, API contracts, frontend/backend integration, rollout, observability, or a named existing facet file.

## Behavioral Rules

- `weave-architect` never creates, edits, renames, deletes, or progresses repo-tracked artifacts.
- It does not call `weave change progress architecture`.
- It does not read architecture template resources; templates are writer inputs for `weave-capture` and restructuring inputs for `weave-clarify`.
- It supports both legacy `architecture.md` and folder-mode `architecture/index.md` plus direct child facet files.
- If both `architecture.md` and `architecture/` exist, it reports the shape conflict and does not treat either as sole canonical truth.
- It asks focused architecture questions one at a time, explains why each blocking question matters, provides a likely/default recommendation, and offers to explain with an example before deciding.
- Its output is a structured architecture dissection intended for later persistence by `weave-capture`.

## Source Anchors

- Canonical skill: `templates/skills/weave-architect/SKILL.md`
- Installed copies: `.agents/skills/weave-architect/SKILL.md`, `.claude/skills/weave-architect/SKILL.md`
- Plan Mode Guard: `wiki/knowledge/domains/change-workflow/domain-wide/plan-mode-guard.md`
- Architecture artifact shape: `wiki/knowledge/domains/change-workflow/domain-wide/architecture-artifacts.md`
- Tests: `tests/agent-skills.test.ts`

## Change History

- 2026-06-06 (change `260606-k0l6-architecture-folder`): `weave-architect` became strictly read-only; architecture writes moved to `weave-capture`, structural changes moved to `weave-clarify`, and architecture context loading became folder-shape-aware.

## Open Questions

- None at this time.
