---
facet: weave-architect-lane-commit
description: Restructure weave-architect's discovery sequence so the architecture lane commit runs reliably in Plan Mode.
created_at: 2026-06-07T11:14:00.000Z
updated_at: 2026-06-07T11:14:00.000Z
---

# Weave Architect Lane Commit Compliance

## Scope Note

This facet is in-scope for `260607-bbam-task-execution-workflow` even though the change's PRD currently focuses on `/weave-execute`. It was added as an explicit scope expansion after the bug surfaced while running `weave-architect` for this change. The fix is small, contained, and does not depend on `/weave-execute`. The PRD is reported as a follow-up artifact for whoever wants to record this scope expansion as a product behavior note.

## Problem

`weave-architect` runs in Plan Mode and is heavily framed as "read-only" at the top of the skill:

```9:11:templates/skills/weave-architect/SKILL.md
This skill is a read-only architecture thinking partner. It gathers context, interviews the user, stress-tests tradeoffs, and produces a clear technical dissection that `weave-capture` can persist later.

It never creates, edits, renames, deletes, or progresses repo-tracked artifacts.
```

The Plan Mode Guard authorizes a single local-session-state write — `weave artifact current set architecture --json` — but the operational instruction lives in a separate code block far from the other Tier 1 discovery commands:

```48:71:templates/skills/weave-architect/SKILL.md
Start by discovering the current Weave session:

```bash
weave workspace --json
```

Resolve the active change:

```bash
weave change current --json
weave change status --json
```

If no active change exists, stop and say:
... (stop branch) ...

After the active change is resolved, run:

```bash
weave artifact current set architecture --json
```
```

Plan Mode agents read the read-only framing first and rationalize the lane commit as a "write" they should skip. The lane-commit instruction is positionally separated from the rest of the discovery sequence, prefaced with "After the active change is resolved, run:", which reads as advisory rather than mandatory. As a result, Plan Mode `weave-architect` agents leave the architecture lane uncommitted in local Weave session state, and downstream skills like `weave-capture` see a stale stored lane.

Empirical evidence: in the architecture session for this very change, the prior `weave-architect` agent said *"I'm keeping this pass read-only, so I'm not changing local artifact context"* — exactly the rationalization the skill's structure invites.

`weave-explore` does not have this bug because it inlines the lane commit into the unconditional first-step discovery code block alongside `weave workspace --json` and `weave change current --json`. `weave-prd` and `weave-clarify` also separate the lane commit but run in Agent Mode without read-only framing, so the rationalization does not trigger there.

## Decision Summary

- Restructure `# Resolve Context` in `templates/skills/weave-architect/SKILL.md` so the architecture lane commit runs as part of the unconditional first-step discovery sequence, mirroring `weave-explore`.
- Inline `weave artifact current set architecture --json` in the same code block as `weave workspace --json`, `weave change current --json`, and `weave change status --json`.
- Add a one-sentence clarifier (modelled on `templates/skills/weave-prd/SKILL.md` line 280) that explicitly authorizes the lane commit in Plan Mode because it writes local session state, not repo-tracked artifacts.
- Move the "no active change" stop-branch after the inlined sequence.
- Keep all other read-only framing, the Plan Mode Guard text, and the skill contract intact.
- Sync the change to the byte-identical installed copies under `.agents/skills/weave-architect/SKILL.md` and `.claude/skills/weave-architect/SKILL.md`.
- Update `tests/agent-skills.test.ts` to assert the inlined sequence and the new clarifying sentence, and to assert the old separated-block prose is gone.
- Update `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md` Current Behavior to describe the inlined discovery sequence and add a 2026-06-07 Change History entry.

## System Context

- Canonical skill source: `templates/skills/weave-architect/SKILL.md`.
- Installed copies asserted byte-identical by `tests/agent-skills.test.ts` line 312: `.agents/skills/weave-architect/SKILL.md`, `.claude/skills/weave-architect/SKILL.md`.
- Plan Mode Guard boilerplate: `src/lib/skill-template-checks.ts` (`EXPECTED_PLAN_MODE_GUARD`).
- Reference shape for compliant Plan Mode discovery: `templates/skills/weave-explore/SKILL.md` lines 37-43.
- Reference shape for the clarifying sentence: `templates/skills/weave-prd/SKILL.md` line 280.
- Knowledge spec: `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md`.
- Cross-cutting knowledge spec: `wiki/knowledge/domains/change-workflow/domain-wide/architecture-artifacts.md` already documents that `weave artifact current set architecture` is local session state only.

## Proposed Resolve Context Shape

```md
# Resolve Context

Start by discovering the current Weave session and committing the architecture lane to local Weave session state:

```bash
weave workspace --json
weave change current --json
weave change status --json
weave artifact current set architecture --json
```

Setting local artifact context with `weave artifact current set architecture --json` is allowed in Plan Mode because it writes local session state, not repo-tracked change artifacts. Run it as part of this initial discovery sequence, not as a conditional follow-up.

If `weave change current --json` reports no active change, stop and say:

```text
No active Weave change found. Run `weave change new` or `weave change switch`, then run `weave-architect` again.
```

Surface any Tier 1 notices from the commands above.
```

This matches `weave-explore`'s structural pattern exactly: a single inlined block first, the stop-branch second.

## Files Affected

- `templates/skills/weave-architect/SKILL.md`: restructure `# Resolve Context`; inline lane commit; add clarifying sentence; move stop-branch.
- `.agents/skills/weave-architect/SKILL.md`: byte-identical sync.
- `.claude/skills/weave-architect/SKILL.md`: byte-identical sync.
- `tests/agent-skills.test.ts`: extend the `ships weave-architect as a canonical read-only architecture thinking skill` test to assert the inlined sequence and the clarifying sentence; assert the old separated-block prose is gone.
- `wiki/knowledge/domains/change-workflow/features/weave-architect/behavior.md`: update Current Behavior and add a Change History entry dated 2026-06-07.

## Tradeoffs

- Inlining the lane commit makes it harder to skip but slightly mixes a "write" command into a discovery block in a Plan Mode skill. The clarifying sentence and the existing Plan Mode Guard wording are sufficient to keep the contract clear.
- Editing only `weave-architect` (not also tightening read-only framing globally across skills) keeps the diff small and avoids collateral churn in compliant skills.
- Adding the clarifying sentence duplicates a small fragment that already lives in `weave-prd`. Acceptable: the fragment is short and the duplication is intentional for skill-local clarity.

## Risks And Mitigations

- Risk: Test assertions that hard-pin parts of the resolve section may break in unrelated ways.
  Mitigation: only extend assertions; do not loosen existing assertions; rerun the full `tests/agent-skills.test.ts` suite.
- Risk: Future skill updates may regress the inlined sequence back to a separated block.
  Mitigation: pinning the inlined block in tests gives a regression alarm.
- Risk: Plan Mode agents still rationalize skipping the lane commit despite the structural change.
  Mitigation: the explicit clarifying sentence ("Run it as part of this initial discovery sequence, not as a conditional follow-up") is the second-line defence; if it still fails in practice, escalate to a stronger skill-level instruction.

## Test Plan

- Unit-style content assertions in `tests/agent-skills.test.ts`:
  - `skill.content` contains the joined inlined block including all four discovery commands together.
  - `skill.content` contains the new clarifying sentence verbatim.
  - `skill.content` does not contain `"After the active change is resolved, run:"`.
- Existing byte-identity assertions for `.agents/` and `.claude/` copies must continue to pass.
- Manual smoke check: invoke `weave-architect` for an active change in Plan Mode and confirm that `weave artifact current --json` reports the architecture lane afterwards.

## Open Questions

- Whether the PRD for `260607-bbam-task-execution-workflow` should be amended to record this scope expansion as a product-level note, or whether this stays purely as an architecture-level scope creep on a developer-facing skill. Reported as a follow-up artifact per `weave-clarify` rules; not blocking the architecture write.

## Capture Guidance

This facet is captured at `architecture/weave-architect-lane-commit.md`. The next workflow step remains `weave-issues` to generate implementation tasks; the issues skill should produce one or more vertical slices for this fix in addition to the `/weave-execute` slices.
