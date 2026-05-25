# Change Workflow Scaffold

## Topic

Create a Weave workflow for starting a change folder with a stable change id, generated slug, status metadata, and an initial exploration artifact.

## Current Understanding

Weave should provide a deterministic command surface for creating change planning work under `wiki/changes/`. The agent-facing `weave-prd` skill should handle product discovery, but the CLI should own folder naming, uniqueness, and scaffold creation.

For Weave, the equivalent durable unit should be a change folder:

```text
wiki/changes/{YYMMDD}-{XXXX}-{slug}/
```

The full folder name is the change id. The human-readable suffix is the slug.

## Recommended Product Behavior

Add a CLI command:

```bash
weave change new "Analytics of reviews"
```

The command should create:

```text
wiki/changes/260522-f3q9-analytics-of-reviews/
  status.yml
  exploration.md
```

`prd.md` should not be created by default. A PRD should appear only after enough discovery has happened to avoid false precision.

## Why `exploration.md` First

The first artifact represents product discovery, not final requirements. It should preserve:

- the original topic
- current understanding
- open questions
- decisions made during discussion
- scenarios and edge cases
- existing behavior discovered from the codebase
- readiness to draft a PRD

Creating `prd.md` immediately would imply the requirements are ready. Creating nothing would make the discussion easy to lose and would not provide a stable change id.

## Proposed Status Metadata

```yaml
version: 1
id: 260522-f3q9-analytics-of-reviews
slug: analytics-of-reviews
title: Analytics of reviews
type: feat
stage: exploration
created_at: "2026-05-22"
updated_at: "2026-05-22"
```

## Proposed `exploration.md` Template

```md
# {Title}

## Topic

{Original topic}

## Current Understanding

## Open Questions

## Decisions

## Scenarios

## Existing Behavior

## PRD Readiness

Not ready
```

## Product Decisions So Far

| Decision | Status | Rationale |
|---|---|---|
| Use `wiki/changes/` for change artifacts | Decided | `wiki/` is the committed, user-facing knowledge surface. |
| Use `.weave/` for Weave metadata | Decided | Keeps tool metadata out of the human wiki. |
| Drop `local.yml` for V1 | Decided | No current workflow needs persistent repo identity outside session state. |
| Use `{YYMMDD}-{XXXX}-{slug}` change ids | Decided |
| Store change type in `status.yml` | Decided | Changes can represent bugs, refactors, docs, CI, chores, and new capabilities. |
| Start with `exploration.md` | Decided | Discovery should not masquerade as a final PRD. |
| Defer `prd.md` creation | Decided | Create it only when requirements are clear enough. |
| Create `change/{change-id}` branches | Decided | Keeps git work aligned with the durable change folder identity. |
| Support multi-repo targets explicitly | Decided | Agents should ask which session repos participate instead of assuming every repo is involved. |

## Open Questions

None for V1.

## Recommendation

`weave change new` should be the explicit commit point. `/weave-prd` should discuss first and call the command only after the user agrees to capture the change.

The V1 command should:

- generate a 2-6 word kebab-case slug from the title
- generate a 4-character lowercase alphanumeric id
- accept explicit change type: `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, or `chore`
- create `wiki/changes/{YYMMDD}-{XXXX}-{slug}/`
- create or check out `change/{change-id}`
- write `status.yml`
- write `exploration.md`
- skip `prd.md`
- fail on collision rather than overwrite
- report skipped branch creation for non-git targets

## Implemented Surface

```bash
weave change new "<title>" --target <target>...
weave change propagate <change-id> --from <target> --to <target>...
```

Agent-facing skills:

```text
weave-new
weave-capture
weave-propagate
```

## PRD Readiness

Ready for V1 implementation. `prd.md` generation and current-change activation remain intentionally out of scope.
