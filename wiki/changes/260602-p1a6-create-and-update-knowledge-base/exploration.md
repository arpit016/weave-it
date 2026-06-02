---
artifact: exploration
status: draft
owner: product
created_at: 2026-06-01T20:22:32.761Z
updated_at: 2026-06-02T12:20:08.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Create And Update Knowledge Base

## Topic

create-and-update-knowledge-base

## Current Understanding

Weave should support a durable knowledge base that remains useful when users and agents return to a product or system area months after multiple features, bug fixes, removals, and behavior changes.

`wiki/changes/**` should remain historical provenance: why a change happened, what was considered, what was built, and how implementation work was broken down.

`wiki/knowledge/**` should become the current-state behavioral spec layer: how product and system domains behave today. For complex domains, knowledge should describe the complete behavioral model through dimensions, rules, decision tables, lifecycle, permissions, visibility, edge cases, invariants, source anchors, and change history.

The knowledge structure should scale from small repositories to large codebases. Small domains can remain compact. Heavy domains should split into feature-level specs and domain-wide specs so a single file does not become unreadable.

## Open Questions

None.

## Decisions

- Knowledge pages are current-state behavioral specs, not chronological change logs.
- Change folders remain historical provenance.
- Standardize the recommended knowledge structure around:
  - `wiki/knowledge/domains/`
  - `wiki/knowledge/domains/<domain>/features/`
  - `wiki/knowledge/domains/<domain>/domain-wide/`
  - `wiki/knowledge/shared/`
- Use `domains/` for product or system areas that users and engineers naturally name, such as performance reviews, compensation, billing, onboarding, procurement, or goals.
- Use `features/` for independently understandable behavior areas inside a domain.
- Use `domain-wide/` for behavior coordinating multiple features inside one domain.
- Use `shared/` for behavior reused across multiple domains, such as approvals, permissions, notifications, audit logs, privacy, retention, integrations, and imports.
- Replace the earlier `cross-feature/` terminology with `domain-wide/`.
- Replace the earlier `cross-cutting/` terminology with `shared/`.
- Weave should guide and validate the recommended structure, but not block or forcibly migrate nonstandard existing structures.
- `weave init` should create standard knowledge folders plus README files explaining the structure.
- Agents may create missing standard knowledge folders/files for an active update, but must not reorganize or move existing user-authored knowledge without explicit approval.
- Add a `weave-knowledge` skill that creates or updates both:
  - `wiki/changes/<change-id>/knowledge-delta.md`
  - current-state specs under `wiki/knowledge/**`
- Track knowledge freshness in `status.yml`, not `tasks.md`.
- Knowledge lifecycle statuses should be `pending`, `stale`, `updated`, and `none`.
- Knowledge status should be updated through a CLI-owned lifecycle command shaped as `weave change knowledge <status>`.
- `status.yml.knowledge` should record lightweight change-scoped metadata: status, timestamps, affected domains, affected shared behavior areas, touched or authoritative files, knowledge delta path, reason, and stale cause when applicable.
- `weave change knowledge <status>` should support repeatable `--domain`, `--shared`, and `--file` flags, plus `--delta`, `--reason`, and `--invalidated-by`.
- `weave-next` should remain read-only and report effective knowledge staleness when stored knowledge status is stale or when upstream artifact lanes are stale after knowledge was resolved.
- `weave-knowledge` should orient and ask when invoked without an active change or when the target knowledge area is ambiguous.
- Users manually run `weave-knowledge`; it should not run automatically when tasks complete.
- If upstream pipeline context becomes stale after knowledge was resolved, knowledge should become stale too.
- Knowledge templates should use guided optional sections, not strict schemas.
- `behavior.md` should be the primary current-state behavioral spec template, with `Purpose`, `Current Behavior`, `Source Anchors`, and `Change History` strongly recommended.
- `decision-tables.md` should be optional and used for important permutations or interaction rules.
- `source-map.md` should connect behavior to source anchors, tests, configs, jobs, integrations, and ownership notes.
- `knowledge-delta.md` should be the per-change bridge from historical implementation work to current-state knowledge.
- V1 should not include CLI validation for knowledge structure.
- V1 structure guidance should live in scaffolded docs, `weave-knowledge` skill behavior, and skill contract tests.

## Scenarios

### Returning To A Complex Domain Months Later

A team returns to performance reviews after several changes affected self reviews, goals, peer reviews, upward reviews, calibration, visibility, and finalization. Instead of reconstructing current behavior from old PRDs, tasks, diffs, and bug fixes, the agent reads `wiki/knowledge/domains/performance-reviews/index.md`, then the relevant feature and domain-wide specs.

The knowledge base should explain current behavior through a behavioral model, not by listing every historical change.

### Centralized Approval Workflow

A centralized approval workflow is used by performance reviews, compensation, procurement, and access requests. The shared approval model belongs under `wiki/knowledge/shared/approvals/behavior.md`.

Performance-review-specific approval behavior belongs under a domain page such as `wiki/knowledge/domains/performance-reviews/domain-wide/approvals.md`, where it can describe how performance reviews use or override shared approvals.

### Missing Or Ambiguous Context

When `weave-knowledge` is invoked without an active change, it should explain that knowledge updates normally need change provenance and ask whether the user wants to start or switch a change, or perform an explicit standalone knowledge update.

When an active change exists but the target area is ambiguous, the skill should inspect context, present concrete candidate domains/features/shared areas, and ask the user to choose.

### Knowledge Becomes Stale

If `weave-knowledge` marks knowledge `updated`, then a later PRD, architecture, or task artifact changes or becomes stale, the change-level knowledge status should become `stale`. `weave-next` should surface this and recommend running `weave-knowledge` after stale upstream context is resolved.

### Guided Knowledge Templates

When a feature-level behavioral spec is needed, `weave-knowledge` should use a guided optional-section `behavior.md` template. The template should help agents capture purpose, current behavior, rules, lifecycle, permissions, visibility, edge cases, invariants, source anchors, and change history. Agents may omit irrelevant sections for small domains or simple features.

When behavior depends on important permutations, agents should add `decision-tables.md`. When readers need to connect product behavior to implementation reality, agents should add or update `source-map.md`. Every durable change should have `knowledge-delta.md` as the change-local provenance bridge unless the knowledge status is `none` with a rationale.

### No CLI Validation In V1

V1 should not add a CLI command or blocking validator for knowledge folder structure. Weave should scaffold the standard structure and document it clearly. Skills should follow and test the guidance. Validation can be revisited later after real repositories show which warnings are useful.

## Existing Behavior

Current `weave init` creates only:

```text
wiki/
  knowledge/
    index.md
  changes/

.weave/
  sync.yml
```

The current `wiki/knowledge/index.md` is a minimal placeholder and does not explain behavioral specs, domains, shared behavior, or scalable folder structure.

Current lifecycle state is CLI-owned. Weave-managed artifact skills call `weave change progress <lane> --source ... --json` after successful live artifact updates. Skills are instructed not to hand-edit `status.yml`.

Current lifecycle lanes are `exploration`, `prd`, `architecture`, and `issues`. There is no knowledge lane or knowledge freshness state today.

## PRD Readiness

Ready. Exploration open questions are resolved; the PRD should be clarified with the final template and validation decisions before architecture.
