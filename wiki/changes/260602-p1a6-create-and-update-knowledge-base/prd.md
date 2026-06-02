---
artifact: prd
status: draft
owner: product
created_at: 2026-06-02T12:07:20.000Z
updated_at: 2026-06-02T12:23:18.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Create And Update Knowledge Base PRD

## Problem Statement

Weave users and agents need a reliable way to understand how a product or system area behaves today after months of feature additions, bug fixes, removals, and revisions.

Today, Weave already keeps historical change artifacts under `wiki/changes/**`, but the product knowledge area is only a minimal placeholder. Returning users and agents would have to reconstruct current behavior from old explorations, PRDs, architectures, tasks, sessions, source code, and tests. That creates product archaeology instead of durable product memory.

Complex domains such as performance reviews make this especially painful. The behavior can depend on many dimensions, including self reviews, goals, peer reviews, upward reviews, manager reviews, calibration, visibility, approvals, notifications, and permissions. A useful knowledge base must describe the current behavioral model without turning into an unreadable list of every historical permutation.

## Goals

- Make `wiki/knowledge/**` the current-state behavioral spec layer for the repo.
- Keep `wiki/changes/**` as historical provenance.
- Provide a scalable folder structure for small repos, large domains, feature-level specs, domain-wide behavior, and shared behavior.
- Make the recommended knowledge structure self-explanatory for users and agents.
- Add a manual knowledge workflow that updates both change-local knowledge deltas and current-state knowledge specs.
- Track knowledge freshness in change lifecycle state so users can see whether knowledge is pending, stale, updated, or intentionally not applicable.
- Keep knowledge lifecycle state CLI-owned instead of requiring skills to hand-edit `status.yml`.

## Non-Goals

- Do not make knowledge updates run automatically when implementation tasks complete.
- Do not replace change artifacts with knowledge pages.
- Do not force existing repos to migrate or reorganize nonstandard knowledge folders.
- Do not treat knowledge as just another artifact progress lane.
- Do not use `tasks.md` as the authoritative knowledge lifecycle source.
- Do not create noisy fake example domains during `weave init`.
- Do not add CLI validation for knowledge folder structure in v1.

## Actors

- Weave user: starts or resumes changes and manually invokes the knowledge workflow.
- Product-oriented agent: uses knowledge to understand current behavior and updates behavioral specs when durable product truth changes.
- Engineering-oriented agent: uses source anchors and change context to keep knowledge grounded in code and tests.
- Returning user or agent: reads current knowledge before modifying a domain months later.
- Maintainer: wants scaffolded conventions, lifecycle visibility, and tests that keep shipped skills and docs aligned.

## Current Behavior

`weave init` currently creates a minimal scaffold:

```text
wiki/
  knowledge/
    index.md
  changes/

.weave/
  sync.yml
```

`wiki/knowledge/index.md` currently describes the knowledge folder as a place for product knowledge, but it does not define behavioral specs, domains, shared behavior, source anchors, or scalable folder rules.

Weave-managed artifact skills call `weave change progress <lane> --source ... --json` after successful live artifact writes. Lifecycle state is stored in `status.yml`, and skills are instructed not to hand-edit it.

Current lifecycle lanes are `exploration`, `prd`, `architecture`, and `issues`. There is no knowledge status today.

## Proposed Product Behavior

Weave should treat `wiki/knowledge/**` as a current-state behavioral spec layer. Knowledge pages should describe what is true today, while change folders explain how that truth evolved.

The recommended knowledge structure should be:

```text
wiki/knowledge/
  index.md
  README.md
  domains/
    README.md
    <domain>/
      index.md
      overview.md
      glossary.md
      source-map.md
      features/
        <feature>/
          behavior.md
          decision-tables.md
          lifecycle.md
          permissions.md
          source-map.md
      domain-wide/
        lifecycle.md
        permissions.md
        visibility.md
        notifications.md
        approvals.md
        edge-cases.md
  shared/
    README.md
    <shared-behavior>/
      behavior.md
      source-map.md
```

The structure should be progressive. Small domains do not need every optional file. Heavy domains can split into feature-level and domain-wide specs as behavior grows.

`domains/` should contain product or system areas that users and engineers naturally name. `features/` should contain independently understandable behavior areas within a domain. `domain-wide/` should contain behavior that coordinates multiple features inside one domain. `shared/` should contain behavior reused across multiple domains, such as approvals, permissions, notifications, audit logs, privacy, retention, integrations, and imports.

Weave should guide and validate this structure. It should scaffold standard files and warn or orient when structure is unusual, but it should not block existing repos or silently move user-authored knowledge.

A new `weave-knowledge` skill should manually update knowledge. It should create or update `wiki/changes/<change-id>/knowledge-delta.md` and update current-state specs under `wiki/knowledge/**`. If no durable knowledge impact exists, it should record a no-impact outcome with a reason.

Knowledge freshness should be tracked in `status.yml` using statuses:

```text
pending
stale
updated
none
```

Knowledge lifecycle state should be updated through a CLI-owned command shaped as:

```text
weave change knowledge <status>
```

The command should support lightweight routing and provenance flags:

```text
--domain <domain>
--shared <shared-behavior>
--file <knowledge-file>
--delta <knowledge-delta-file>
--reason <reason>
--invalidated-by <lane-or-source>
```

These flags should let Weave record which current-state knowledge areas were affected, which files were touched or are authoritative, which change-local delta explains the update, why a status was chosen, and what invalidated previously resolved knowledge.

`status.yml.knowledge` should store the corresponding lifecycle metadata:

```yaml
knowledge:
  status: updated
  updated_at: "2026-06-02T12:30:00.000Z"
  domains:
    - performance-reviews
  shared:
    - approvals
  files:
    - wiki/knowledge/domains/performance-reviews/domain-wide/approvals.md
    - wiki/knowledge/shared/approvals/behavior.md
  delta: wiki/changes/<change-id>/knowledge-delta.md
  reason: Updated performance review approval behavior and shared approval references.
```

When knowledge is stale, the metadata should preserve the stale cause:

```yaml
knowledge:
  status: stale
  updated_at: "2026-06-02T12:40:00.000Z"
  invalidated_by: prd
  reason: PRD changed after knowledge was marked updated.
```

`weave-next` should remain read-only. It should report knowledge as effectively stale when stored knowledge status is `stale`, or when upstream artifact lanes are stale after knowledge was resolved. It should not write stale state itself.

Knowledge authoring templates should be structured enough to guide agents, but not so rigid that every page becomes ceremony. The templates should use guided optional sections. Agents may omit irrelevant sections when a domain, feature, or shared behavior does not need them.

`behavior.md` should be the core current-state spec:

```md
# <Feature Or Shared Behavior>

## Purpose
## Current Behavior
## Domain Model
## Configuration Dimensions
## Behavioral Rules
## Decision Tables
## Lifecycle
## Permissions And Visibility
## Integrations And Side Effects
## Edge Cases
## Invariants
## Source Anchors
## Change History
## Open Questions
```

Not every section must be populated. `Purpose`, `Current Behavior`, `Source Anchors`, and `Change History` should be strongly recommended for behavioral specs.

`decision-tables.md` should be optional and focused on permutations:

```md
# <Feature> Decision Tables

## Table: <Scenario>

| Dimension | Value | Outcome |
| --- | --- | --- |

## Notes

## Source Anchors
```

`source-map.md` should connect behavior to reality:

```md
# <Domain Or Feature> Source Map

## Core Product Surfaces
## Source Anchors
## Tests
## Config And Flags
## Jobs And Side Effects
## External Integrations
## Ownership Notes
```

`knowledge-delta.md` should be the per-change bridge:

```md
# Knowledge Delta

## Durable Behavior Changes
## Affected Knowledge Areas
## Knowledge Files Updated
## No-Impact Rationale
## Source Evidence
## Follow-Up Knowledge Work
```

V1 should not include full CLI validation for knowledge structure. Full validation would create another product surface and force edge-case policy before the workflow has proven itself. V1 should rely on scaffolded docs, `weave-knowledge` skill guidance, and skill contract tests that ensure the scaffold and skill instructions mention the standard structure and templates. A validation command can be added later once real repositories reveal what warnings are useful.

## User Workflows

### Workflow: User Initializes A Repo

1. User runs `weave init`.
2. Weave creates the normal wiki and metadata scaffold.
3. Weave creates standard knowledge folders and README files that explain how knowledge should be organized.
4. User sees `wiki/knowledge/index.md` as the live catalog and `wiki/knowledge/README.md` as the structure guide.

### Workflow: User Returns To A Complex Domain

1. User asks an agent to modify performance review behavior after several months of changes.
2. Agent reads `wiki/knowledge/index.md`.
3. Agent opens `wiki/knowledge/domains/performance-reviews/index.md`.
4. Agent reads the relevant feature and domain-wide behavioral specs.
5. Agent uses source maps to inspect enforcing code and tests only after understanding current product behavior.
6. Agent uses historical change artifacts only when provenance or rationale is needed.

### Workflow: Agent Updates Knowledge After A Change

1. User manually invokes `weave-knowledge`.
2. Skill resolves the active change and reads existing knowledge, change artifacts, sessions, tasks when present, and relevant source anchors.
3. Skill creates or updates `knowledge-delta.md` for the active change.
4. Skill creates or updates current-state knowledge specs under standard paths.
5. Skill calls `weave change knowledge updated` with the relevant domains, shared behaviors, files, and delta path.

### Workflow: No Durable Knowledge Impact

1. User invokes `weave-knowledge`.
2. Skill determines the change has no durable product or system behavior impact.
3. Skill records a rationale.
4. Skill calls `weave change knowledge none`.
5. `weave-next` and status output show that knowledge was considered and no update was needed.

### Workflow: Knowledge Becomes Stale

1. `weave-knowledge` marks knowledge `updated`.
2. Later, exploration, PRD, architecture, or task context changes or becomes stale.
3. Weave marks or reports knowledge as `stale`.
4. `weave-next` recommends resolving stale upstream context and then running `weave-knowledge`.

### Workflow: Ambiguous Knowledge Target

1. User invokes `weave-knowledge` on an active change.
2. Skill finds multiple plausible targets, such as a domain feature, a domain-wide notification page, and a shared notifications page.
3. Skill summarizes the candidate targets.
4. User selects the authoritative update target.
5. Skill proceeds with the selected target.

### Workflow: No Active Change

1. User invokes `weave-knowledge` without an active change.
2. Skill explains that knowledge updates normally need change provenance.
3. Skill asks whether the user wants to start or switch a change, or perform an explicit standalone knowledge update.
4. Skill does not silently write context-free knowledge updates.

## User Stories

1. As a returning user, I want to read current behavioral specs before changing a domain, so that I do not reconstruct current behavior from old change history.
2. As a product agent, I want a predictable folder structure for knowledge, so that I can find the right behavioral spec quickly.
3. As a maintainer, I want `weave init` to scaffold knowledge guidance, so that new repos start with the right conventions.
4. As a user, I want agents to create missing standard knowledge files when needed, so that knowledge can grow naturally.
5. As a user, I want agents not to reorganize existing knowledge without approval, so that user-authored structure is protected.
6. As an agent, I want to record a change-local knowledge delta, so that current knowledge updates have provenance.
7. As a user, I want `status.yml` to show knowledge freshness, so that pending or stale knowledge is visible.
8. As a user, I want `weave-next` to recommend knowledge follow-up when needed, so that knowledge updates do not silently drift.
9. As a user, I want a no-impact knowledge status with rationale, so that implementation-only changes can be closed without fake documentation.
10. As a maintainer, I want knowledge lifecycle state updated through CLI commands, so that `status.yml` remains owned by tested lifecycle logic.

## Functional Requirements

- The system should scaffold `wiki/knowledge/README.md`, `wiki/knowledge/domains/README.md`, and `wiki/knowledge/shared/README.md`.
- The system should keep `wiki/knowledge/index.md` as a live catalog of actual domains and shared behavior areas.
- The knowledge README should explain `domains/`, `features/`, `domain-wide/`, and `shared/` with a sample folder tree.
- The knowledge README should include the guided optional template shapes for `behavior.md`, `decision-tables.md`, `source-map.md`, and `knowledge-delta.md`, or link to the skill guidance that defines them.
- The system should recommend `domains/<domain>/index.md`, `overview.md`, `glossary.md`, and `source-map.md` for domain-level knowledge.
- The system should recommend `features/<feature>/behavior.md` for feature-level behavioral specs.
- The system should recommend optional feature files such as `decision-tables.md`, `lifecycle.md`, `permissions.md`, and `source-map.md` when behavior is complex enough.
- The system should recommend `domain-wide/*.md` for behavior coordinating multiple features inside one domain.
- The system should recommend `shared/<shared-behavior>/behavior.md` for behavior reused across multiple domains.
- The system should guide and validate the recommended structure without blocking nonstandard existing knowledge.
- The system should allow agents to create missing standard folders/files for the active knowledge update.
- The system should prevent agents from silently moving or reorganizing existing user-authored knowledge.
- The system should provide a `weave-knowledge` skill.
- `weave-knowledge` should create or update `wiki/changes/<change-id>/knowledge-delta.md`.
- `weave-knowledge` should create or update current-state specs under `wiki/knowledge/**`.
- `weave-knowledge` should use guided optional-section templates, not strict required-section schemas.
- `weave-knowledge` should strongly recommend `Purpose`, `Current Behavior`, `Source Anchors`, and `Change History` when creating or revising behavioral specs.
- `weave-knowledge` should use `decision-tables.md` only when behavior has meaningful permutations or interaction rules.
- `weave-knowledge` should use `source-map.md` to connect behavior to source anchors, tests, configs, jobs, integrations, and ownership notes.
- `weave-knowledge` should record no-impact rationale when knowledge status is `none`.
- `weave-knowledge` should orient and ask when no active change exists.
- `weave-knowledge` should inspect and ask when target knowledge areas are ambiguous.
- The system should track knowledge freshness in `status.yml`.
- The system should support knowledge statuses `pending`, `stale`, `updated`, and `none`.
- The system should update knowledge lifecycle state through `weave change knowledge <status>`.
- `weave change knowledge <status>` should support repeatable `--domain`, `--shared`, and `--file` flags.
- `weave change knowledge <status>` should support `--delta`, `--reason`, and `--invalidated-by` flags.
- `status.yml.knowledge` should record status, timestamps, affected domains, affected shared behavior areas, touched or authoritative files, delta path, reason, and stale cause when applicable.
- The system should not require skills to hand-edit `status.yml`.
- `weave-next` should surface stored knowledge status and effective knowledge staleness, while remaining read-only.
- `weave-next` should recommend `weave-knowledge` when knowledge is pending or effectively stale.
- V1 should not include a CLI knowledge-structure validation command.
- V1 should include scaffold/docs guidance and skill contract tests for the standard structure and templates.

## Permissions and Access Control

No role-based product permissions are required.

The behavior should respect existing file ownership expectations:

- Agents may create missing standard knowledge files for an active update.
- Agents must not move, rename, or reorganize existing user-authored knowledge files without explicit approval.
- Skills should not hand-edit lifecycle state in `status.yml`.

## States and Lifecycle

Knowledge lifecycle status is change-level state.

Supported statuses:

- `pending`: knowledge impact has not been resolved for the active change.
- `stale`: knowledge was previously resolved, but upstream change context changed or became stale afterward.
- `updated`: current-state knowledge has been updated for this change.
- `none`: knowledge was considered and no durable knowledge impact exists.

Missing knowledge metadata in older changes can be treated as unknown by readers and workflow skills, but `unknown` is not a v1 status.

Knowledge should not move the change `stage` like an artifact lane. It is a freshness and closure signal associated with the active change.

Knowledge metadata should be lightweight and change-scoped. It should capture:

- status
- update timestamp
- affected domains
- affected shared behavior areas
- touched or authoritative knowledge files
- change-local knowledge delta path
- reason for the current status
- stale cause when status is `stale`

When artifact lanes become stale after knowledge was resolved, readers such as `weave-next` should report knowledge as effectively stale. Read-only helpers should not mutate `status.yml` while doing so.

## Notifications and Visibility

No external notifications are required.

Visibility should be file- and command-output based:

- `status.yml` shows current knowledge lifecycle state.
- `weave change status` should expose knowledge state when present.
- `weave-next` should show knowledge follow-up when status is `pending`, stored status is `stale`, or knowledge is effectively stale because upstream artifact context is stale.
- `weave-knowledge` should report the delta file, knowledge files touched, and final knowledge status.

## Edge Cases

- Existing repos with only `wiki/knowledge/index.md`: scaffold missing standard README files without overwriting existing content.
- Existing repos with nonstandard knowledge folders: read and use them when relevant; warn or recommend standardization without moving files.
- Existing repos with nonstandard knowledge folders: do not fail validation in v1 because no CLI validator exists.
- Small domains: allow compact knowledge without requiring feature folders.
- Large domains: split into feature-level and domain-wide specs when a single page becomes hard to scan.
- Shared behavior used by one domain only: keep it in the domain until multiple domains depend on it.
- Domain-specific use of shared behavior: document the shared model under `shared/` and the domain-specific integration under the domain.
- No active change: orient and ask instead of silently writing standalone knowledge.
- Ambiguous target: inspect first, present candidate targets, and ask the user to choose.
- No durable knowledge impact: record `none` with rationale.
- Upstream artifact stale after knowledge update: knowledge should become or be reported as stale.
- Read-only stale detection: `weave-next` should report effective knowledge staleness without writing `status.yml`.

## Acceptance Criteria

- [ ] `weave init` creates standard knowledge README files and folders without overwriting user files.
- [ ] `wiki/knowledge/README.md` explains the folder structure and includes a sample tree.
- [ ] The recommended folder names are `domains`, `features`, `domain-wide`, and `shared`.
- [ ] The knowledge docs or skill guidance define guided optional templates for `behavior.md`, `decision-tables.md`, `source-map.md`, and `knowledge-delta.md`.
- [ ] `behavior.md` guidance strongly recommends `Purpose`, `Current Behavior`, `Source Anchors`, and `Change History`.
- [ ] `weave-knowledge` creates or updates `knowledge-delta.md`.
- [ ] `weave-knowledge` creates or updates current-state specs under `wiki/knowledge/**`.
- [ ] `weave-knowledge` follows guided optional-section templates and can omit irrelevant sections for small domains or simple features.
- [ ] `weave-knowledge` can record `none` with a no-impact rationale.
- [ ] `weave-knowledge` orients and asks when no active change exists.
- [ ] `weave-knowledge` asks when target knowledge areas are ambiguous.
- [ ] Agents can create missing standard folders/files for active updates.
- [ ] Agents do not silently reorganize existing knowledge files.
- [ ] `status.yml` supports knowledge statuses `pending`, `stale`, `updated`, and `none`.
- [ ] `weave change knowledge <status>` updates knowledge lifecycle state.
- [ ] `weave change knowledge <status>` records affected domains, shared behavior areas, files, delta path, reason, and invalidation cause.
- [ ] Skills do not hand-edit `status.yml`.
- [ ] Knowledge is reported stale when upstream change context becomes stale after knowledge resolution.
- [ ] `weave-next` surfaces pending, stored stale, or effectively stale knowledge follow-up without mutating lifecycle state.
- [ ] V1 does not add a CLI validation command for knowledge structure.
- [ ] Tests cover scaffold/docs and skill contract guidance for knowledge structure and templates.

## Rollout Considerations

Existing repos should remain usable. The new scaffold should create missing files only and should not overwrite existing knowledge content.

Existing changes without knowledge metadata should continue to work. Readers can treat missing knowledge state as unknown.

The terminology change from earlier brainstorming should be reflected consistently: use `shared/`, not `cross-cutting/`; use `domain-wide/`, not `cross-feature/`.

Knowledge structure validation should be deferred. V1 should make the intended structure visible through scaffolded README files, skill instructions, and tests. A later validation command can be considered after real repository usage reveals which warnings would be accurate and helpful.

## Analytics and Success Metrics

Success can be evaluated qualitatively in v1:

- New repos have a clear knowledge structure after init.
- Future agents can locate current domain behavior before reading old change history.
- Changes can show whether knowledge is pending, stale, updated, or not applicable.
- Knowledge updates include both current-state specs and change-local provenance.

## Revision History

- 2026-06-02: Initial PRD generated from `exploration.md`.
- 2026-06-02: Clarified knowledge lifecycle metadata, `weave change knowledge <status>` flags, and read-only effective staleness reporting.
- 2026-06-02: Clarified guided optional knowledge templates and deferred CLI knowledge-structure validation from v1.

## Assumptions

- A CLI-owned `weave change knowledge <status>` command is the right lifecycle surface for knowledge status.
- `weave-knowledge` will be a skill in v1, not a compiled deterministic knowledge updater.
- The standard structure should be recommended and scaffolded, but not strictly required for all repos.
- README files are the right way to keep scaffolded `domains/` and `shared/` folders Git-trackable without fake domains.
- Missing knowledge metadata in older changes can imply unknown without adding an explicit `unknown` status.
- Knowledge lifecycle metadata should stay lightweight and change-scoped rather than becoming a per-file state machine.
- `weave-next` should remain read-only even when it can detect that stored knowledge freshness is no longer valid.
- Knowledge templates should guide agents toward useful behavioral specs without forcing irrelevant sections into small domains.
- Skill contract tests are sufficient v1 coverage for template and structure guidance; CLI validation can wait.

## Open Questions

None.

## Out of Scope

- Automatic knowledge updates at task completion.
- Forced migration of existing knowledge folders.
- Knowledge approval or review workflows.
- External notification integrations.
- Deterministic parsing of every possible knowledge page structure.
- CLI validation for knowledge folder structure in v1.

## Further Notes

The intended mental model is:

```text
wiki/changes/** = historical provenance
wiki/knowledge/** = current-state behavioral specs
code/tests = executable enforcement and source anchors
```

For complex domains, knowledge should describe behavior through dimensions and rules rather than enumerating every historical permutation as prose.
