---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-06T18:05:30.000Z
updated_at: 2026-06-06T18:05:30.000Z
source: architecture
---

# Tasks: Folder-Based Architecture Artifact And Template Kit

## Source Context

- PRD: `wiki/changes/260606-k0l6-architecture-folder/prd.md`
- Architecture: `wiki/changes/260606-k0l6-architecture-folder/architecture.md`
- Sessions: `wiki/changes/260606-k0l6-architecture-folder/sessions/20260606-233140-a7k2-architecture.md`
- Codebase: `src/lib/agent-skills.ts`, `src/lib/changes.ts`, `templates/skills/*.md`, `tests/agent-skills.test.ts`, change progress tests
- External references: None
- Local references: None

## Coverage Review

PRD coverage:

- Covered: read-only `weave-architect`, folder-mode architecture shape, direct child template resources, capture writer behavior, clarify structural behavior, reader compatibility, optional-source `weave-issues` coverage gate, session `facets` metadata.
- Known cleanup: PRD still contains one stale workflow phrase saying custom templates are added under `weave-architect/templates/`; T8 cleans this up.

Architecture coverage:

- Covered: shared architecture artifact resolver, `src/lib/changes.ts` lifecycle integration, direct resource installer tests, skill template rewrites, reader skill updates, `weave-issues` coverage/sync gate, verification commands.

PRD/Architecture sync:

- In sync: no new CLI flags, direct child architect resources, index-or-facet substance, lane-atomic lifecycle, optional PRD/architecture sources for `weave-issues`.
- Known mismatch: stale PRD workflow phrase noted above; accepted as cleanup task T8.

## Local Tracking Status

External issue publishing status: not used. This change tracks implementation locally in this file.

## Status Legend

- `todo`: ready to pick up when blockers are done
- `in_progress`: currently being implemented
- `blocked`: cannot proceed without the listed blocker or decision
- `done`: implemented and verified
- `not_tested`: implementation appears complete, but automated verification could not be completed
- `invalid`: no longer applies after source context changed

## Active Task Index

| ID | Status | Type | Title | Blocked by |
| --- | --- | --- | --- | --- |
| T1 | todo | AFK | Add shared architecture artifact resolver | None |
| T2 | todo | AFK | Wire folder-mode architecture into lifecycle heuristics | T1 |
| T3 | todo | AFK | Add direct child architect template resources | None |
| T4 | todo | AFK | Rewrite `weave-architect` as read-only | T1 |
| T5 | todo | AFK | Teach `weave-capture` folder-mode architecture writes | T1, T3 |
| T6 | todo | AFK | Teach `weave-clarify` architecture restructuring | T1 |
| T7 | todo | AFK | Update reader skills and `weave-issues` coverage gate | T1 |
| T8 | todo | AFK | Align docs, knowledge, and bundled installed skill copies | T3, T4, T5, T6, T7 |
| T9 | todo | AFK | Run full verification and reconcile failures | T1, T2, T3, T4, T5, T6, T7, T8 |

## T1: Add shared architecture artifact resolver

Status: todo

Type: AFK

Blocked by: None - can start immediately

User stories covered: 10, 12

Origin: none

Related finding: none

### What to build

Add a shared resolver, suggested as `src/lib/architecture-artifact.ts`, that detects architecture artifact shape for a change folder.

The resolver should identify:

- missing architecture
- legacy file mode (`architecture.md`)
- folder mode (`architecture/`)
- shape conflict when both exist
- substantive index content
- substantive facet files
- partial folder architecture when facets are substantive but the index is missing or thin

Reuse or extract the existing markdown-substance heuristic from `src/lib/changes.ts` so file and folder modes use one definition of substantive content.

### Acceptance Criteria

- [ ] Resolver returns `missing` when neither `architecture.md` nor substantive folder-mode architecture exists.
- [ ] Resolver returns `file` for legacy `architecture.md` and reports whether it is substantive.
- [ ] Resolver returns `folder` for `architecture/` and reports index path, facet paths, substantive facet paths, `substantive`, and `partial`.
- [ ] Resolver returns `conflict` when both `architecture.md` and `architecture/` exist.
- [ ] Folder mode is substantive when `architecture/index.md` or any direct child facet `.md` file is substantive.
- [ ] `index.md` is not treated as a facet.

### Verification

- Automated tests: add focused unit tests for all resolver states; run `npm run test`.
- Manual/smoke check: inspect resolver return values in failing test output if any state is ambiguous.

## T2: Wire folder-mode architecture into lifecycle heuristics

Status: todo

Type: AFK

Blocked by: T1

User stories covered: 10, 12

Origin: none

Related finding: none

### What to build

Update `src/lib/changes.ts` to use the architecture artifact resolver instead of hardcoding `architecture.md` where architecture existence or evidence matters.

Specifically:

- `resolveProgressSources` should infer `architecture` as the source for `issues` progress when legacy file mode or folder mode is substantive.
- `hasIssueEvidence` should scan folder-mode architecture files for issue URLs or `#123` references, not only `architecture.md`.
- Non-substantive folder-mode architecture should not infer `architecture` as a source.

### Acceptance Criteria

- [ ] `change progress issues` infers `architecture` from a substantive legacy `architecture.md`.
- [ ] `change progress issues` infers `architecture` from substantive `architecture/index.md`.
- [ ] `change progress issues` infers `architecture` from a substantive facet-only folder.
- [ ] Non-substantive folder-mode architecture does not infer `architecture`.
- [ ] Issue evidence scanning includes `architecture/index.md` and facet files in folder mode.

### Verification

- Automated tests: update `tests/changes.test.ts`, `tests/cli-change-progress.test.ts`, or related change progress tests; run `npm run test`.
- Manual/smoke check: use temp change fixtures to confirm `status.yml.artifacts.issues.sources` includes `architecture` when expected.

## T3: Add direct child architect template resources

Status: todo

Type: AFK

Blocked by: None - can start immediately

User stories covered: 4

Origin: none

Related finding: none

### What to build

Add direct child template resources beside `templates/skills/weave-architect/SKILL.md`:

- `index-template.md`
- `schema-template.md`
- `api-contract-template.md`
- `frontend-backend-template.md`

Each should include frontmatter with `facet` and `description`, followed by a useful default structure for capture/clarify to use when writing architecture files.

Extend `tests/agent-skills.test.ts` to assert these resources install, update, reset, diff, and preserve user modifications like existing PRD and knowledge resources.

### Acceptance Criteria

- [ ] All four architect templates exist as direct child `.md` files.
- [ ] Each template has `facet` and `description` frontmatter.
- [ ] Install writes the templates for supported agents.
- [ ] Update preserves user-modified architect templates.
- [ ] Reset restores bundled architect templates.
- [ ] Opencode install includes architect template resources.

### Verification

- Automated tests: extend `tests/agent-skills.test.ts`; run `npm run test`.
- Manual/smoke check: inspect generated `.agents/skills/weave-architect/*-template.md` in temp install fixtures.

## T4: Rewrite `weave-architect` as read-only

Status: todo

Type: AFK

Blocked by: T1

User stories covered: 1, 2, 3

Origin: none

Related finding: none

### What to build

Rewrite `templates/skills/weave-architect/SKILL.md` so it is a Plan Mode, read-only architecture thinking skill.

Remove instructions that make the skill a writer:

- create/revise `architecture.md`
- output path
- lifecycle progress
- embedded architecture template
- lifecycle staleness verification block

Add instructions for:

- resolving current change context
- reading PRD, status, sessions, legacy architecture, folder-mode architecture, relevant facets, knowledge, docs, and code
- handling shape conflicts
- treating the invocation argument as free-form interview focus
- producing a structured dissection for later capture
- never reading `*-template.md` files

### Acceptance Criteria

- [ ] `weave-architect` no longer instructs agents to write architecture artifacts.
- [ ] `weave-architect` no longer embeds the architecture template.
- [ ] `weave-architect` no longer runs lifecycle progress.
- [ ] `weave-architect` reads architecture file/folder shape as context.
- [ ] `weave-architect <topic>` is documented as free-form focus, not template validation.
- [ ] Tests no longer expect `weave-architect` to be a progress-calling skill.

### Verification

- Automated tests: update skill assertions in `tests/agent-skills.test.ts`; run `npm run test`.
- Manual/smoke check: read the rendered skill and confirm it is unambiguously read-only.

## T5: Teach `weave-capture` folder-mode architecture writes

Status: todo

Type: AFK

Blocked by: T1, T3

User stories covered: 5, 6, 7, 11

Origin: none

Related finding: none

### What to build

Update `templates/skills/weave-capture/SKILL.md` so architecture capture writes folder-mode architecture for new architecture artifacts and understands legacy file mode.

Document:

- architecture artifact shape resolution
- one lane-level session note per capture
- `facets: [...]` frontmatter for architecture session notes
- direct child template discovery by `<facet>-template.md`
- routing to index/facet/existing file/no-template explicit facet
- index updates after facet changes
- contradiction surfacing in index Open Questions
- lane-atomic lifecycle progress

### Acceptance Criteria

- [ ] Capture creates `architecture/index.md` for new architecture when enough architecture content exists.
- [ ] Capture uses direct child templates for matching facets.
- [ ] Capture can create a no-template facet only when explicitly requested.
- [ ] Capture writes `facets: [...]` in architecture session notes when relevant.
- [ ] Capture handles legacy `architecture.md` without automatic migration.
- [ ] Capture reports shape conflicts instead of choosing silently.

### Verification

- Automated tests: add or update skill text assertions; run `npm run test`.
- Manual/smoke check: inspect `weave-capture` instructions for the routing decision tree and session frontmatter.

## T6: Teach `weave-clarify` architecture restructuring

Status: todo

Type: AFK

Blocked by: T1

User stories covered: 8, 9, 10

Origin: none

Related finding: none

### What to build

Update `templates/skills/weave-clarify/SKILL.md` so architecture clarification can operate on legacy file mode and folder mode.

Document structural primitives:

- create facet
- split content
- merge facets
- rename facet
- delete facet
- move content
- update index
- explicit migration from `architecture.md` to `architecture/`

Clarify should still update only the selected artifact lane and report follow-up artifacts instead of cascading.

### Acceptance Criteria

- [ ] Clarify can read legacy file mode and folder mode.
- [ ] Clarify can migrate `architecture.md` to folder mode only when explicitly requested.
- [ ] Clarify documents split/merge/rename/delete/move/update-index behavior.
- [ ] Clarify reports shape conflicts and asks for user-directed cleanup.
- [ ] Clarify can be invoked for architecture even when the prior ambient lane is different.

### Verification

- Automated tests: add or update skill text assertions; run `npm run test`.
- Manual/smoke check: inspect `weave-clarify` instructions for structural primitives and non-cascading behavior.

## T7: Update reader skills and `weave-issues` coverage gate

Status: todo

Type: AFK

Blocked by: T1

User stories covered: 12, 13

Origin: none

Related finding: none

### What to build

Update reader skill templates:

- `weave-issues`
- `weave-next`
- `weave-knowledge`
- any reader sections in `weave-capture` and `weave-clarify`

Reader skills should consume legacy file mode and folder mode, prefer substantive `architecture/index.md`, use substantive facets when needed, report partial architecture, and stop on shape conflicts.

Update `weave-issues` so PRD and architecture are optional sources, but verification runs for whichever exists:

- PRD-to-tasks coverage when PRD exists
- architecture-to-tasks coverage when architecture exists
- PRD-to-architecture consistency when both exist
- user approval before writing when coverage gaps or mismatches are found

### Acceptance Criteria

- [ ] Reader skills no longer assume only `architecture.md`.
- [ ] Reader skills describe folder-mode and partial architecture behavior.
- [ ] `weave-next` recommendations account for folder-mode architecture.
- [ ] `weave-knowledge` reads folder-mode architecture as supporting context when relevant.
- [ ] `weave-issues` does not require PRD or architecture to exist.
- [ ] `weave-issues` previews coverage/sync checks for existing sources before writing tasks.

### Verification

- Automated tests: add or update skill text assertions; run `npm run test`.
- Manual/smoke check: inspect `weave-issues` flow to confirm it still asks for task approval before writing.

## T8: Align docs, knowledge, and bundled installed skill copies

Status: todo

Type: AFK

Blocked by: T3, T4, T5, T6, T7

User stories covered: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13

Origin: none

Related finding: none

### What to build

Update documentation and checked-in installed skill copies so the repo is internally consistent.

Scope:

- README and knowledge references that describe `architecture.md` as the only architecture artifact
- repo-installed skill copies under `.agents` and `.claude` if they are tracked and expected to match templates
- stale PRD workflow wording that says user templates are added under `weave-architect/templates/`
- any release or command reference notes affected by direct child architect templates and folder-mode architecture

### Acceptance Criteria

- [ ] User-facing docs describe file/folder architecture shape accurately.
- [ ] Current-state knowledge reflects the new behavior when applicable.
- [ ] Checked-in installed skill copies match updated bundled templates where the repo expects byte alignment.
- [ ] PRD wording no longer contradicts the direct child template resource decision.

### Verification

- Automated tests: run `npm run test`.
- Manual/smoke check: search for stale `architecture.md`-only claims and `weave-architect/templates/` claims.

## T9: Run full verification and reconcile failures

Status: todo

Type: AFK

Blocked by: T1, T2, T3, T4, T5, T6, T7, T8

User stories covered: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13

Origin: none

Related finding: none

### What to build

Run the full verification suite and reconcile expected failures from changed skill behavior, resource expectations, and architecture artifact resolver behavior.

### Acceptance Criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] Any changed skill boilerplate assertions reflect the new read-only `weave-architect` behavior.
- [ ] No stale hardcoded assumptions remain in tests for architecture source inference or issue evidence scanning.

### Verification

- Automated tests: `npm run typecheck`; `npm run test`.
- Manual/smoke check: review failing snapshots/assertions if any and ensure changes reflect product decisions rather than weakening coverage.

## QA Findings

Finding Status Legend:

- `new`: reported but not yet triaged
- `accepted`: triaged and accepted as a real defect
- `fixed`: implementation believed to address the defect
- `verified`: fix confirmed by re-test
- `duplicate`: already covered by another finding
- `not_reproducible`: could not be reproduced
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Severity | Source | Related Task | Summary |
| --- | --- | --- | --- | --- | --- |

None.

## Refactors

Refactor Status Legend:

- `proposed`: identified but not yet accepted
- `accepted`: agreed to do as part of this change
- `deferred`: logged for later; no `T#` yet
- `done`: completed and verified behavior-preserving
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- |

None.

## Invalid Tasks

None.

## Verification

Not run yet.
