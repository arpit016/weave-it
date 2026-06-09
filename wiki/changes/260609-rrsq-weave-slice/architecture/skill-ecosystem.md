---
facet: skill-ecosystem
description: Skill updates, findings lane, bug-fix workflow, lifecycle frontmatter, dual-mode compatibility, and branch model.
---

# Skill Ecosystem

## Skill Inventory

| Skill | Disposition | Change |
|---|---|---|
| `weave-fix` | new | Chat-driven bug-fix entry point |
| `weave-slices` | rename + rewrite | Replaces `weave-issues`; generates `task-slices/` folders |
| `weave-execute` | update | Slice-aware selectors, absorbs branch prep, branches on `Execution:` |
| `weave-next` | update | Slice-aware recommendations, critical-path bias, `afk` filter |
| `weave-clarify` | update | Gains `findings` lane |
| `weave-capture` | update | Gains `findings` lane |
| `weave-architect` | update | Accepts `findings.md` as upstream source for fix-type changes |
| `weave-prepare` | deprecated | Functionality folds into `weave-execute`; banner added; removed after one release cycle |
| `weave-issues` | deleted | Replaced in-place by `weave-slices`; no deprecation banner |

## Bug-Fix Workflow (`weave-fix`)

`weave-fix` is a chat-driven skill. Single-turn flow:

1. Derive slug from chat description.
2. `weave new --type fix <slug>`.
3. Write `findings.md` (Summary required; Repro / Scope / Severity inferred when possible).
4. Scaffold `task-slices/01-<slug>/` with `tasks.md` + `status.yml`. Skip optional `slice.md` / `contracts.md`.
5. Report next step (`/weave-execute 01 T1` or `/weave-next afk`).

`findings.md` is required for every `--type fix` change, even trivial ones. Content shape: Summary (required), Repro (optional), Scope & Impact (optional), Root cause (filled in as diagnosed), Related (external issue links, related changes, logs / screenshots / traces).

No dedicated `weave-findings` skill. `weave-fix` creates and updates `findings.md`; `weave-clarify findings` handles ad-hoc edits.

### Scope Growth

When a trivial fix turns out to be cross-cutting:

1. Engineer updates `findings.md`.
2. Re-runs `weave-slices` (idempotent).
3. Skill inspects current state, proposes additive expansion into multiple slices, asks for confirmation, applies.
4. Rollup library auto-generates `dependency-graph.md` as part of scaffolding completion.

No `--expand` flag or separate "promote" mode. Never silently moves `in_progress` or `done` tasks.

## `weave-slices` Generation Rules

Inputs resolved per change type:

- `--type feat`: `prd.md` + `architecture/` (both required).
- `--type fix`: `findings.md` (required) + `architecture/` (used if present).
- `--type chore` / `--type refactor`: `exploration.md` (required) + `architecture/` (used if present).

Generation rules:

- All slice IDs allocated atomically in a single pass. No incremental ID drift.
- Every task has explicit `Repos:` (single or csv). No path-to-repo derivation.
- `Owner:` left blank; human/agent fills in conversationally.
- `Execution:` defaults to `hitl`. Promote to `afk` only when fully spec'd and mechanical.
- `depends_on` populated from architecture cues; ambiguities surfaced in completion response.
- Idempotent re-run: additive expansion only; destructive changes require explicit user confirm.
- For fix-type single-slice: skip `slice.md` and `contracts.md` when nothing meaningful to write.

Artifact lane rename: `issues` -> `slices` in `status.yml.artifacts` and CLI (`weave change progress slices`).

## Slice-Aware Skill Behavior

### `weave-execute`

- Slice mode: accepts `<slice-id> <task-id>` selector. Reads slice's `tasks.md`. Absorbs branch-prep from deprecated `weave-prepare`. Branches on `Execution:` field (`afk` runs autonomously; `hitl` pauses at checkpoints). Calls rollup library at episode boundaries.
- Flat mode: today's behavior unchanged (`all` / `T#` / scope selectors, change-root `tasks.md`).

### `weave-next`

- Slice mode: walks `task-slices/*/status.yml`, computes ready set, suggests next slice + task. Biases toward critical-path slices. Adds `/weave-next afk` filter.
- Flat mode: today's behavior unchanged.

No new CLI extensions for slice-awareness in v1. Today's `weave task prepare` works at change level unchanged.

## Lifecycle Frontmatter

Change-level `status.yml.artifacts` learns a `findings` lane:

```yaml
artifacts:
  findings:                  # --type fix only
    sources: [discussion, codebase]
    updated_at: <iso>
  architecture:              # optional for fix
    sources: [findings, codebase]
    updated_at: <iso>
  slices:                    # renamed from `issues`
    sources: [findings, architecture]
    updated_at: <iso>
```

CLI gains:

```bash
weave change progress findings --source <list> --json
weave change progress slices --source <list> --json
```

## Backwards Compatibility (Dual Mode)

Detection logic used by `weave-execute` and `weave-next`:

```text
if wiki/changes/<id>/task-slices/ exists:
    slice mode (new)
elif wiki/changes/<id>/tasks.md exists:
    flat mode (legacy)
else:
    no tasks yet
```

Legacy flat-mode changes (including the meta-change `260609-rrsq-weave-slice` that implements this work) continue working unchanged. No migration tool. No forced timeline for removing flat-mode dispatch.

Flat-mode skills do not auto-suggest migration. Removal happens in a future change when no legacy in-flight changes remain.

## Branch Model

Unchanged for v1: one branch per change across all repos. Created by `weave change new`. `weave-execute` ensures the change branch is checked out in repos referenced by the selected slice's tasks. No per-slice or per-task branches.
