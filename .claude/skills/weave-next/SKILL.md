---
name: weave-next
description: Answer what to do next for the active Weave change by inspecting artifact state, current artifact context, and resume notes without mutating files.
last_changed_in: 0.1.0
---

# Weave Next

Use this skill when the user wants to know what command to run next for an active Weave change.

`weave-next` is read-only advisory. It orients the user; it does not perform the recommended work.

# Behavior Rules

- Do not require Plan Mode.
- Do not write repo-tracked artifacts.
- Do not create, revise, capture, approve, or advance artifacts.
- Do not set or clear artifact context.
- Do not invoke or delegate to `weave-explore`, `weave-prd`, `weave-architect`, `weave-issues`, `weave-knowledge`, `weave-capture`, or `weave-clarify`.
- Do not document or rely on formal target arguments such as `weave-next prd` in v1.
- Use live artifacts as canonical current truth.
- Use session notes only for resume points, rationale, unresolved context, and newer explicit user decisions.
- Mention `weave-capture` only as an optional checkpoint when there is useful current discussion context to preserve.

# Resolve Context

Start by discovering the current Weave session:

```bash
weave workspace --json
```

Resolve the active change for the current cwd-dispatched workspace or repo context:

```bash
weave change current --json
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

Inspect only the resolved workspace or repo context whose current change matches the active change.

Do not summarize unrelated repos from the same Weave session. In workspace mode, treat registered sub-repos as implementation locations inside the single workspace change context, not as separate artifact targets.

If the current branch does not match the active change branch, include that branch mismatch before recommending the next command.

# Required Read Order

For the active change, read live artifacts first:

```text
wiki/changes/<change-id>/status.yml
wiki/changes/<change-id>/exploration.md
wiki/changes/<change-id>/prd.md
wiki/changes/<change-id>/architecture.md
wiki/changes/<change-id>/architecture/index.md
wiki/changes/<change-id>/architecture/*.md
wiki/changes/<change-id>/tasks.md
```

Architecture may be legacy file mode or folder mode. If `architecture/` exists, treat `architecture/index.md` as the entry point and direct child facet files as part of the architecture lane. If both `architecture.md` and `architecture/` exist, mention the conflict before recommending the next step.

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

Treat an artifact as missing when its file or folder shape does not exist.

Treat an artifact as not usable when it is blank, whitespace-only, scaffold-only with headings but no substantive content, or explicitly marked not ready for the next lane.

For `exploration.md`, use `PRD Readiness` when present:

- `Ready` means the exploration can support PRD work.
- `Not ready` means recommend exploration work before PRD work.

For `prd.md`, open product questions or unresolved PRD session context can make PRD resume work primary even when architecture exists.

For the architecture artifact, open technical questions, unresolved architecture session context, missing folder index, or substantive facet-only context can make architecture resume work primary before issues.

For issue evidence, use conservative v1 heuristics only:

- populated `tasks.md`
- obvious issue URLs in artifacts
- `#123`-style issue references in artifacts

Do not treat an empty or scaffold-only `tasks.md` as issue breakdown evidence.

# Recommendation Rules

Source-aware stale-first recommendation:

- If `status.yml.stale` contains one or more lanes, recommend refreshing stale lanes before forward progress.
- stale `prd` -> run `weave-prd`
- stale `architecture` -> run `weave-architect`
- stale `issues` -> run `weave-issues`
- Explain which upstream lane invalidated the recommendation when `invalidated_by` is present.
- Treat stale entries as source-aware dependency invalidation from `status.yml.artifacts`, not proof that every earlier pipeline lane was completed.

Knowledge freshness recommendation:

- If `status.yml.knowledge.status` is `pending`, recommend `weave-knowledge` after any stale artifact lanes are resolved.
- If `status.yml.knowledge.status` is `stale`, recommend `weave-knowledge` after the invalidating upstream context is resolved.
- If knowledge was previously `updated` or `none` and artifact stale lanes exist afterward, report knowledge as effectively stale without writing `status.yml`.
- Explain that `weave-next` is read-only and does not mutate knowledge status.

Type-aware forward recommendation:

- missing, scaffold-only, or not-ready `exploration.md` -> run `weave-explore`
- ready `exploration.md` plus missing `prd.md` -> run `weave-prd`
- usable `prd.md` plus missing `architecture.md` -> run `weave-architect`
- usable `architecture.md` plus no issue evidence -> run `weave-issues`
- populated `tasks.md` or obvious issue references -> implementation handoff ready
- For `fix`, `refactor`, `docs`, `test`, `ci`, and `chore`, prefer architecture or issues when product behavior is already clear; do not require PRD just to advance.
- For `feat`, prefer exploration or PRD when product behavior, scope, requirements, or acceptance remain unclear.

Resume recommendation:

- valid current artifact context `exploration` with unresolved resume work -> run `weave-explore`
- valid current artifact context `prd` with unresolved resume work -> run `weave-prd`
- valid current artifact context `architecture` with unresolved resume work -> run `weave-architect`

When resume and forward recommendations differ, make the resume command primary and show the forward recommendation as `Alternate Pipeline Step`.

When there is no valid resume context, make the type-aware recommendation primary.

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

In `Artifact State`, also summarize knowledge status when `status.yml.knowledge` is present.

In `Resume Context`, include current artifact context and the latest relevant `Next Resume Point` when present.

In `Recommended Next Step`, name exactly one primary command or say implementation handoff is ready.

In `Alternate Pipeline Step`, show the next forward command only when it differs from the resume recommendation.

In `Reason`, explain the decisive signals briefly.

In `Optional Checkpoint`, mention `weave-capture` only when there is useful discussion context to preserve.

---

# Surface Weave Notices

Every Weave skill discovery phase calls at least one Tier 1 command
(`weave workspace`, `weave change current`, `weave change status`,
`weave change new`, or `weave status`). Tier 1 commands return a stable
`notices` array in their `--json` output describing outdated packages,
modified skills, and skills that need updating.

When you run any Tier 1 command (with or without `--json`) and the result
contains a non-empty `notices` array, surface them to the user verbatim
near the start of your response. Do not edit notice text. Do not suppress
notices unless the user explicitly asks. Do not invent notices.

If notices recommend `weave status`, suggest the user run it. If notices
recommend `weave agent update`, suggest that. Do not run `npm i -g` or
any package manager command yourself; let the user run it.

If `WEAVE_NO_NOTICES=1` is set in the environment, the notices array will
be empty by design and you should not warn about it.
