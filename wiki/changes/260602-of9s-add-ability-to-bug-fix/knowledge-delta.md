# Knowledge Delta

## Durable Behavior Changes

`weave-issues` now generalizes the active-change task model so discovered work is recorded by category, with `T#` as the implementation backbone:

- Adds a classification step: a defect becomes a `QF#` (QA finding), structural cleanup with no observable behavior change becomes an `R#` (refactor), and everything else becomes a `T#` task (optionally tagged via `Origin`).
- Extends the canonical `tasks.md` shape with two flat sibling sections after the `T#` details and before `## Invalid Tasks`:
  - `## QA Findings`: finding status legend (`new`, `accepted`, `fixed`, `verified`, `duplicate`, `not_reproducible`, `out_of_scope`, `invalid`); index columns ID, Status, Severity, Source, Related Task, Summary; `QF#` fields Observed behavior, Expected behavior, Reproduction, Severity, Source, Artifact impact, Related tasks. Defaults to `None.`.
  - `## Refactors`: refactor status legend (`proposed`, `accepted`, `deferred`, `done`, `out_of_scope`, `invalid`); index columns ID, Status, Scope, Related Tasks, Summary; `R#` fields Motivation, Scope / affected modules, Behavior preservation, Risk / blast radius, Regression verification, Related tasks. Defaults to `None.`.
- Adds optional `Origin:` (`qa_finding`/`refactor`) and `Related finding:` (`QF#`/`R#`) fields on the `T#` detail shape so backbone tasks link back to their source observation.
- Extends append-first, preview-before-write, and stable-ID reconciliation rules to `QF#` and `R#`. `T#`, `QF#`, and `R#` use independent ID namespaces; invalidated IDs are never reused. A deferred `R#` may exist without a `T#`.
- Does not impose special refactor routing or escalation; the user decides whether to escalate or split a refactor into its own change.

Section selection in `tasks.md` is driven by the category of each work item, not by the change's declared `status.yml.type`. No new lifecycle lane and no new source IDs are introduced; the `issues` lane and the existing source IDs (`exploration`, `prd`, `architecture`, `discussion`, `sessions`, `codebase`) are reused unchanged.

## Affected Knowledge Areas

- Domain `change-workflow`, feature `weave-issues`.

## Knowledge Files Updated

- `wiki/knowledge/domains/change-workflow/index.md` (new): seeded the `change-workflow` domain with a feature link to `weave-issues`.
- `wiki/knowledge/domains/change-workflow/features/weave-issues/behavior.md` (new): full current-state spec for the `weave-issues` skill including classification, section shapes, status legends, integrations, edge cases, invariants, and source anchors.

## No-Impact Rationale

Not applicable. This change has durable behavior impact and the knowledge spec has been written.

## Source Evidence

- Canonical skill (post-change): `templates/skills/weave-issues/SKILL.md`
- Installed copies (byte-identical to template): `.agents/skills/weave-issues/SKILL.md`, `.claude/skills/weave-issues/SKILL.md`
- Propagation: `src/lib/agent-skills.ts`, `.weave/agents.yml`
- Tests (assert new sections, status legends, classification, byte alignment): `tests/agent-skills.test.ts`
- README description: `README.md` (`weave-issues` line)
- Verification: `npm run test` (63 tests passed), `npm run typecheck`, `npm run build`, `weave agent diff all weave-issues` reported no differences.

## Follow-Up Knowledge Work

- Optional: write `behavior.md` specs for the other Weave skills (`weave-explore`, `weave-prd`, `weave-architect`, `weave-capture`, `weave-clarify`, `weave-next`, `weave-knowledge`, `weave-new`, `weave-propagate`) under the same `change-workflow` domain so the knowledge base is symmetric across all skills.
- Optional: add a top-level `wiki/knowledge/domains/change-workflow/source-map.md` once more features are documented.
- Optional: capture cross-cutting concepts (change lifecycle stages, source-aware stale state) under `domain-wide/` when more features depend on them.
