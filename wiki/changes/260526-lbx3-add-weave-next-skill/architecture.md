---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-05-28
updated_at: 2026-05-28
reviewed_at: null
approved_at: null
approved_by: null
source: prd.md
---

# Add Weave Next Skill Architecture

## Summary

Add `weave-next` as a bundled Agent Skill, not as a new compiled CLI command. The existing agent skill system already discovers bundled skills from `templates/skills/<name>/SKILL.md` and installs them for Codex, Cursor, Claude, and opencode, with opencode also receiving slash-command wrappers from `templates/opencode/commands`.

`weave-next` should be read-only and advisory. It inspects the active change, live artifacts, valid artifact context, and recent session notes, then recommends the next command. It must not write artifacts, set artifact context, invoke other skills, advance lifecycle state, or require Plan Mode.

The implementation is mainly template, installed-copy, documentation, and test work. No new runtime state or deterministic parser is required for v1.

## PRD Context

Source PRD: `wiki/changes/260526-lbx3-add-weave-next-skill/prd.md`

The PRD asks for a friendly orientation skill that answers "what should I do next?" for an active Weave change. It should preserve Weave's artifact-lane model while reducing confusion around resume versus forward progress.

The v1 pipeline guidance is:

```text
exploration -> prd -> architecture -> issues -> implementation handoff ready
```

`weave-next` should report both resume-oriented guidance and forward pipeline guidance when they differ. It should stop at implementation handoff readiness after issue breakdown exists.

## Current System

Weave already has bundled skills for lane work:

- `weave-new` starts a change.
- `weave-explore` enters or resumes exploration.
- `weave-prd` creates or resumes PRD work.
- `weave-architect` creates or resumes architecture work.
- `weave-issues` breaks planning artifacts into implementation issues.
- `weave-capture` checkpoints discussion into structured session notes and live artifacts.
- `weave-clarify` revises one existing artifact.

The agent skill install path is template-driven. Adding a new directory under `templates/skills` is enough for the bundled skill list and install/update flows to include it, provided tests and installed copies are updated. opencode command wrappers are handled separately through `templates/opencode/commands`.

There is no current skill that reads artifact state, artifact context, and session resume notes together to recommend the next command.

## Proposed Architecture

### Skill Template

Add:

```text
templates/skills/weave-next/SKILL.md
```

The skill should instruct the agent to inspect the active Weave context using existing CLI commands:

```bash
weave workspace --json
weave change current all --json
weave change status --json
weave artifact current --json
```

If `weave artifact current --json` is unavailable in an installed build, the skill should still provide a recommendation from active change and artifact state, then note that no valid current artifact context was available.

The skill should scope analysis to workspace targets where the current change matches the active change. It should avoid recommendations from unrelated repos in the same Weave session.

### Read Order

For each active-change target, `weave-next` should read live artifacts first:

```text
wiki/changes/<change-id>/exploration.md
wiki/changes/<change-id>/prd.md
wiki/changes/<change-id>/architecture.md
wiki/changes/<change-id>/tasks.md
```

Live artifacts are canonical current truth. Session notes are resume and rationale context.

When relevant, read recent session notes newest-first:

```text
wiki/changes/<change-id>/sessions/*-exploration.md
wiki/changes/<change-id>/sessions/*-prd.md
wiki/changes/<change-id>/sessions/*-architecture.md
```

Use the latest relevant `## Next Resume Point` to decide whether the current lane should be resumed before recommending forward progress.

### Output Contract

Use fixed headings so the result is easy to scan:

```text
Current Change
Artifact State
Resume Context
Recommended Next Step
Alternate Pipeline Step
Reason
Optional Checkpoint
```

Omit empty sections when they are not useful, but keep the labels stable when the corresponding content exists.

### Recommendation Rules

The pipeline recommendation should be conservative:

- missing, scaffold-only, or not-ready `exploration.md` -> `weave-explore`
- ready `exploration.md` plus missing `prd.md` -> `weave-prd`
- usable `prd.md` plus missing `architecture.md` -> `weave-architect`
- usable `architecture.md` plus no issue evidence -> `weave-issues`
- populated `tasks.md` or obvious issue references -> implementation handoff ready

If current artifact context has a valid latest resume point, the resume command should be primary. If forward progress differs from resume context, show it as `Alternate Pipeline Step`.

`weave-capture` should appear only as an optional checkpoint when there is useful discussion context to preserve.

### Issue Evidence Heuristics

Issue detection should stay simple in v1:

- populated `tasks.md`
- obvious issue URLs in artifacts
- `#123`-style issue references in artifacts

Empty or scaffold-only `tasks.md` should not count as implementation handoff readiness.

### opencode Wrapper

Add:

```text
templates/opencode/commands/weave-next.md
```

The wrapper should describe the command as answering what to do next for the active Weave change and should delegate to the portable `weave-next` skill.

### Installed Copies

Sync the new skill into:

```text
.agents/skills/weave-next/SKILL.md
.claude/skills/weave-next/SKILL.md
```

These copies should match the template exactly, following the existing repo pattern for bundled skill development.

## Architecture Decisions

### Use A Skill, Not A CLI Command

`weave-next` depends on qualitative readiness judgments from artifacts and sessions. That logic fits the agent skill layer better than a deterministic CLI command in v1.

### Keep `weave-next` Read-Only

Users should be able to ask for orientation without side effects. The skill must not create, revise, capture, approve, or advance artifacts.

### Resume Beats Pipeline Advancement

When a valid artifact context and latest resume point exist, the primary recommendation should continue that lane. The next pipeline step can still be shown as an alternate when useful.

### Live Artifacts Are Canonical

Session notes can contain newer rationale and resume hints, but `weave-next` should treat live artifacts as the durable current truth unless a latest session records an explicit newer user decision.

### No Formal Arguments In V1

Do not document a `weave-next prd` or similar argument contract. Natural-language context may help the agent, but the skill's public behavior is active-change orientation.

## Rejected Alternatives

### `weave-continue` Or `weave-resume`

Rejected for this change because those names blur lane resumption and pipeline advancement. `weave-next` is clearer as advisory orientation.

### Delegating To Other Skills

Rejected because automatic delegation would make `weave-next` a workflow runner. Users should explicitly invoke the recommended lane skill.

### Mutating Artifact Context

Rejected because `weave-next` should be safe to run at any time. Setting artifact context would make an advisory command affect later capture behavior.

### Deep Issue Tracker Integration

Rejected for v1. Conservative artifact heuristics are enough to decide whether issue breakdown appears to exist.

## Constraints And Tradeoffs

The readiness checks are intentionally qualitative and agent-authored. This keeps v1 flexible but means output may vary slightly by agent. Fixed headings and explicit recommendation rules reduce that variability.

Because there is no new CLI command, shell users will continue to invoke `weave-next` through agent skill syntax rather than `weave next`.

Because issue detection is heuristic, `weave-next` should avoid overclaiming implementation readiness when evidence is weak.

## Integration Points

- `templates/skills/weave-next/SKILL.md`: new canonical skill instructions.
- `templates/opencode/commands/weave-next.md`: new opencode slash-command wrapper.
- `.agents/skills/weave-next/SKILL.md`: installed Codex/Cursor/opencode copy for this repo.
- `.claude/skills/weave-next/SKILL.md`: installed Claude copy for this repo.
- `README.md`: skill list, examples, and install docs.
- `tests/agent-skills.test.ts`: default skill metadata, install coverage, installed-copy alignment, opencode wrapper coverage.
- `tests/cli-skills.test.ts`: skill list/show and opencode install coverage.

No changes are expected in `src/lib/agent-skills.ts` unless tests show auto-discovery excludes the new skill.

## Testing Strategy

Add or update tests to assert:

- `weave-next` is bundled with read-only advisory language.
- `weave-next` has no Plan Mode guard.
- The skill scopes analysis to active-change targets.
- The skill reads live artifacts before session notes.
- The skill uses `## Next Resume Point` from sessions.
- The fixed output headings are present.
- Default skill list assertions include `weave-next`.
- Codex, Cursor, Claude, and opencode installs include `weave-next`.
- opencode installs `/weave-next`.
- CLI skill list/show tests include `weave-next`.

Run:

```bash
npm test
npm run typecheck
```

## Rollout And Compatibility

This is additive. Existing skills and workflows continue to work unchanged.

Users who do not invoke `weave-next` see no behavior change. Users who do invoke it get read-only orientation and must still explicitly run the recommended skill.

## Open Technical Questions

- None blocking for v1.

## Assumptions

- Existing auto-discovery in `src/lib/agent-skills.ts` is sufficient once the template and wrapper are added.
- Artifact readiness can be judged from substantive content, explicit readiness markers, unresolved questions, and session resume points.
- External issue detection remains conservative and heuristic in v1.

## Revision History

- 2026-05-28: Initial architecture captured from the `weave-next` architecture discussion and PRD context.
