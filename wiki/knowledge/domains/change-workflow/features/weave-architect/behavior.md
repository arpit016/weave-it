# weave-architect

## Purpose

`weave-architect` is the read-only architecture thinking partner for an active Weave change. It gathers context, interviews the user, stress-tests technical tradeoffs, and returns an architecture dissection in chat.

## Current Behavior

`weave-architect` must run in Plan Mode and carries the byte-identical Plan Mode Guard shared with `weave-explore`.

During initial discovery, it resolves the workspace and active change, checks change status, and commits local artifact context in one inlined sequence:

```bash
weave workspace --json
weave change current --json
weave change status --json
weave artifact current set architecture --json
weave artifact current --json
```

The artifact-context set command writes local session state only. It does not write repo-tracked artifacts, and it is part of the required initial discovery sequence rather than a conditional follow-up. `weave-architect` then verifies the stored lane with `weave artifact current --json`.

Successful lane entry is silent. If verification fails or the stored lane is still not `architecture`, the skill continues the architecture discussion and warns:

```text
I could not update the stored artifact lane to `architecture`, so `weave-capture` may ask you to confirm the capture target later.
```

The skill reads product context, existing architecture context, architecture session notes, code, tests, docs, ADRs, knowledge specs, and `.weave/architecture-considerations.md` as needed. It supports broad architecture review and focused deep dives on topics such as schema design, API contracts, frontend/backend integration, rollout, observability, or a named existing facet file.

`.weave/architecture-considerations.md` is user-owned team architecture guidance. When present, `weave-architect` reads it before making architecture recommendations, applies relevant guidance silently while reasoning, and surfaces only constraints, conflicts, or risks that materially affect the design. The skill never edits the file and does not treat examples in it as mandatory unless the file says they are.

## Behavioral Rules

- `weave-architect` never creates, edits, renames, deletes, or progresses repo-tracked artifacts.
- It may update local Weave session state only to record that the active artifact lane is `architecture`; this local lane commit is not a repo-tracked artifact write.
- It does not call `weave change progress architecture`.
- It does not read architecture template resources; templates are writer inputs for `weave-capture` and restructuring inputs for `weave-clarify`.
- It supports both legacy `architecture.md` and folder-mode `architecture/index.md` plus direct child facet files.
- If both `architecture.md` and `architecture/` exist, it reports the shape conflict and does not treat either as sole canonical truth.
- It reads `.weave/architecture-considerations.md` when present and treats it as advisory, user-owned team guidance.
- If `.weave/architecture-considerations.md` conflicts with PRD context, ADRs, existing architecture, code reality, or explicit user instructions, it calls out the conflict and asks which source should be authoritative.
- It asks focused architecture questions one at a time, explains why each blocking question matters, provides a likely/default recommendation, and offers to explain with an example before deciding.
- Its output is a structured architecture dissection intended for later persistence by `weave-capture`.

## Source Anchors

- Canonical skill: `templates/skills/weave-architect/SKILL.md`
- Installed copies: `.agents/skills/weave-architect/SKILL.md`, `.claude/skills/weave-architect/SKILL.md`
- Team architecture guidance: `.weave/architecture-considerations.md`
- Plan Mode Guard: `wiki/knowledge/domains/change-workflow/domain-wide/plan-mode-guard.md`
- Architecture artifact shape: `wiki/knowledge/domains/change-workflow/domain-wide/architecture-artifacts.md`
- Tests: `tests/agent-skills.test.ts`

## Change History

- 2026-06-06 (change `260606-k0l6-architecture-folder`): `weave-architect` became strictly read-only; architecture writes moved to `weave-capture`, structural changes moved to `weave-clarify`, and architecture context loading became folder-shape-aware.
- 2026-06-07 (change `260607-bbam-task-execution-workflow`): inlined `weave artifact current set architecture --json` into the initial discovery command block and clarified that it is Plan-Mode-safe local session state, preventing agents from skipping the lane commit because the skill is otherwise read-only.
- 2026-06-07 (change `260607-1mo4-fixes-around-existing-commands`): clarified the top-level read-only contract to explicitly allow the local architecture lane commit, added non-blocking lane verification with `weave artifact current --json`, and kept successful lane entry silent.
- 2026-06-07 (change `260607-vuwa-architecture-skill-update`): bundled `weave-architect` now reads `.weave/architecture-considerations.md` as user-owned advisory team architecture guidance. Installed skill copies are not automatically updated; drift is surfaced through status/doctor and resolved through explicit agent update/reset commands.

## Open Questions

- None at this time.
