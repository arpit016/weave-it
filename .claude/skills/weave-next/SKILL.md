---
name: weave-next
description: Answer what to do next for the active Weave change by inspecting artifact state, current artifact context, and resume notes without mutating files.
---

# Weave Next

Use this skill when the user wants to know what command to run next for an active Weave change.

`weave-next` is read-only advisory. It orients the user; it does not perform the recommended work.

# Behavior Rules

- Do not require Plan Mode.
- Do not write repo-tracked artifacts.
- Do not create, revise, capture, approve, or advance artifacts.
- Do not set or clear artifact context.
- Do not invoke or delegate to `weave-explore`, `weave-prd`, `weave-architect`, `weave-issues`, `weave-capture`, or `weave-clarify`.
- Do not document or rely on formal target arguments such as `weave-next prd` in v1.
- Use live artifacts as canonical current truth.
- Use session notes only for resume points, rationale, unresolved context, and newer explicit user decisions.
- Mention `weave-capture` only as an optional checkpoint when there is useful current discussion context to preserve.

# Resolve Context

Start by discovering the current Weave session:

```bash
weave workspace --json
```

Resolve active change targets:

```bash
weave change current all --json
weave change status --json
```

Inspect current artifact context when available:

```bash
weave artifact current --json
```

If `weave artifact current --json` is unavailable or fails, continue from active change and artifact state. In the output, say that no valid current artifact context was available.

If no active change exists, stop and say:

```text
No active Weave change found. Run `weave change new` or `weave change switch`, then run `weave-next` again.
```

# Scope

Inspect only workspace targets whose current change matches the active change.

Do not summarize unrelated repos from the same Weave session. If the active change applies to multiple targets, summarize each matching target clearly and combine the recommendation only when their artifact states agree.

If a target branch does not match the active change branch, include that branch mismatch before recommending the next command.

# Required Read Order

For each active-change target, read live artifacts first:

```text
wiki/changes/<change-id>/exploration.md
wiki/changes/<change-id>/prd.md
wiki/changes/<change-id>/architecture.md
wiki/changes/<change-id>/tasks.md
```

Then read relevant recent session notes newest-first:

```text
wiki/changes/<change-id>/sessions/*-exploration.md
wiki/changes/<change-id>/sessions/*-prd.md
wiki/changes/<change-id>/sessions/*-architecture.md
```

Prefer the latest relevant `## Next Resume Point` for resume guidance. Avoid a full history audit unless the latest notes are ambiguous or conflict with live artifacts.

If a session note conflicts with the live artifact, prefer the live artifact unless the latest session records an explicit newer user decision.

# Artifact State Signals

Classify each artifact conservatively.

Treat an artifact as missing when the file does not exist.

Treat an artifact as not usable when it is blank, whitespace-only, scaffold-only with headings but no substantive content, or explicitly marked not ready for the next lane.

For `exploration.md`, use `PRD Readiness` when present:

- `Ready` means the exploration can support PRD work.
- `Not ready` means recommend exploration work before PRD work.

For `prd.md`, open product questions or unresolved PRD session context can make PRD resume work primary even when architecture exists.

For `architecture.md`, open technical questions or unresolved architecture session context can make architecture resume work primary before issues.

For issue evidence, use conservative v1 heuristics only:

- populated `tasks.md`
- obvious issue URLs in artifacts
- `#123`-style issue references in artifacts

Do not treat an empty or scaffold-only `tasks.md` as issue breakdown evidence.

# Recommendation Rules

Forward pipeline recommendation:

- missing, scaffold-only, or not-ready `exploration.md` -> run `weave-explore`
- ready `exploration.md` plus missing `prd.md` -> run `weave-prd`
- usable `prd.md` plus missing `architecture.md` -> run `weave-architect`
- usable `architecture.md` plus no issue evidence -> run `weave-issues`
- populated `tasks.md` or obvious issue references -> implementation handoff ready

Resume recommendation:

- valid current artifact context `exploration` with unresolved resume work -> run `weave-explore`
- valid current artifact context `prd` with unresolved resume work -> run `weave-prd`
- valid current artifact context `architecture` with unresolved resume work -> run `weave-architect`

When resume and forward recommendations differ, make the resume command primary and show the forward recommendation as `Alternate Pipeline Step`.

When there is no valid resume context, make the forward pipeline recommendation primary.

# Output Format

Use these headings when relevant and keep them easy to scan:

```text
Current Change
Artifact State
Resume Context
Recommended Next Step
Alternate Pipeline Step
Reason
Optional Checkpoint
```

Omit empty sections when they would add noise.

In `Current Change`, include change id, title when available, target repo or repos, and branch health.

In `Artifact State`, summarize `exploration.md`, `prd.md`, `architecture.md`, and issue/task evidence.

In `Resume Context`, include current artifact context and the latest relevant `Next Resume Point` when present.

In `Recommended Next Step`, name exactly one primary command or say implementation handoff is ready.

In `Alternate Pipeline Step`, show the next forward command only when it differs from the resume recommendation.

In `Reason`, explain the decisive signals briefly.

In `Optional Checkpoint`, mention `weave-capture` only when there is useful discussion context to preserve.
