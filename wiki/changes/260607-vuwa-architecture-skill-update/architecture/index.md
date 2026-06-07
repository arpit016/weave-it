---
artifact: architecture
status: draft
owner: engineering
created_at: 2026-06-07T15:16:00.000Z
updated_at: 2026-06-07T15:30:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Architecture Skill Update Architecture

## Decision Summary

- Add `.weave/architecture-considerations.md` as a team-owned architecture guidance file.
- Scaffold the file during Weave initialization and any scaffold repair path that calls `ensureWeaveScaffold`.
- Create the file only when missing; never overwrite user-authored content.
- Update `weave-architect` to read `.weave/architecture-considerations.md` when present and apply it as advisory team guidance during architecture recommendations.
- Update only the bundled `templates/skills/weave-architect/SKILL.md` copy for this change.
- Do not update installed skill copies under `.agents/`, `.claude/`, or `.opencode/`; leave them intentionally out of sync so package-installed skill drift behavior can be observed.
- Keep the guidance external to the skill so different teams can express their own design preferences, pitfalls, and architectural constraints.
- Scaffold a small starter template instead of a blank file.
- Add `weave doctor` in this change as the explicit health-check and safe scaffold repair path for existing Weave projects.
- Keep `weave doctor` read-only by default; only `weave doctor --fix` may create missing safe scaffold files, and it must never overwrite user-authored files.

## System Context

- Scaffold creation lives in `src/lib/weave-scaffold.ts`.
- Repo and workspace initialization call `ensureWeaveScaffold` through `src/lib/init-workspace.ts`.
- Change creation and folder addition also call `ensureWeaveScaffold`, so the new file can be repaired or introduced for existing Weave contexts without overwriting local edits.
- Architecture-skill behavior is defined by `templates/skills/weave-architect/SKILL.md`.
- Installed skill copies under `.agents/`, `.claude/`, and `.opencode/` should remain untouched in this change so local drift detection can be exercised against the installed package behavior.
- Any test that assumes installed copies always match bundled templates should be adjusted for this intentional drift scenario rather than resolved by syncing installed files.
- Init scaffold behavior is covered by `tests/init.test.ts`.
- CLI command registration lives in `src/cli.ts`; `weave doctor` should follow the existing command module pattern under `src/commands/`.
- `weave status` already reports package and skill state. `weave doctor` should be complementary: a project health report plus safe scaffold repair, not a replacement for skill update flows.

## Architecture Overview

The change adds a user-owned guidance document at the Weave metadata layer:

```text
.weave/
  architecture-considerations.md
```

This file is not an artifact lane and is not lifecycle-managed like `wiki/changes/**`. It is durable team configuration/documentation that architecture agents read before recommending technical design.

`weave-architect` should treat it like local architecture context:

- read it when present;
- never edit it;
- apply relevant guidance while reasoning;
- surface only design-relevant constraints, conflicts, risks, or tradeoffs;
- avoid dumping the file contents into every architecture response.

## Scaffold Design

`ensureWeaveScaffold` should define an `architectureConsiderationsTemplate()` and write it using `writeFileIfMissing`.

The starter content should clearly state that the file is user-owned and should include optional sections such as:

- Design Principles
- Patterns To Prefer
- Patterns To Avoid
- Data Access And Scaling
- Caching And Consistency
- Async Boundaries And Events
- Observability And Operations
- Notes For Agents

The examples should be phrased as placeholders, not mandatory Weave opinions. Teams can delete, rewrite, or expand the file after init.

## Doctor Command

Add a top-level command:

```bash
weave doctor
weave doctor --fix
weave doctor --json
weave doctor --fix --json
```

`weave doctor` is read-only. It should inspect the current Weave context and report:

- whether Weave metadata is present and readable;
- whether safe scaffold files are missing, including `.weave/architecture-considerations.md`;
- whether the knowledge scaffold directories and standard README files are present;
- whether installed skills differ from bundled templates, when an agents manifest is present;
- whether an active change exists and whether the current branch matches its expected branch when that information is available;
- a summary status of `ok`, `warning`, or `error`.

`weave doctor --fix` should only perform safe, additive scaffold repair:

- create missing scaffold directories;
- create missing scaffold files through the same `writeFileIfMissing` behavior used by `ensureWeaveScaffold`;
- create `.weave/architecture-considerations.md` when missing;
- report which files were created.

It must not:

- overwrite existing files;
- update installed skills;
- change branches;
- edit `status.yml`;
- mutate live change artifacts;
- run package upgrades or migrations.

The human output should clearly end with whether files changed. The JSON output should include machine-readable check rows and a `changed` list.

Status semantics:

- `ok`: no relevant issues found.
- `warning`: project is usable but has repairable missing scaffold files, skill drift, package drift, branch mismatch, or similar non-blocking issues.
- `error`: Weave context is missing or invalid enough that normal commands may fail, such as unreadable metadata or invalid YAML.

## Skill Behavior

`weave-architect` should include `.weave/architecture-considerations.md` in architecture context loading and sub-repo architecture discovery where appropriate.

The skill should not turn this file into a universal checklist response. It should evaluate team considerations in the background and mention them only when they materially affect the current design discussion.

If the file conflicts with PRD context, ADRs, existing architecture, code reality, or user instructions, the skill should call out the conflict and ask which source should be authoritative.

Implementation should modify the bundled template only:

```text
templates/skills/weave-architect/SKILL.md
```

Do not mirror the skill text into installed copies:

```text
.agents/skills/weave-architect/SKILL.md
.claude/skills/weave-architect/SKILL.md
.opencode/commands/weave-architect.md
```

## Tradeoffs

- `.weave/architecture-considerations.md` keeps team-specific design guidance close to Weave-owned metadata without mixing it into change artifacts or long-lived product knowledge.
- `wiki/knowledge/**` remains better for current product/domain behavior; `.weave/architecture-considerations.md` is better for general engineering-design preferences and pitfalls.
- A starter template improves discoverability, but must stay lightweight so teams do not inherit irrelevant rules.
- Reading the file in `weave-architect` improves architecture quality before code review, but the skill must avoid noisy boilerplate.
- `weave doctor` gives existing projects an explicit non-session-mutating way to discover and repair missing safe scaffold files after package upgrades.
- Keeping `weave doctor --fix` narrow avoids surprising users with broad mutation under a friendly command name.

## Risks And Mitigations

- Risk: agents may over-quote or over-apply the file.
  Mitigation: skill guidance should say to apply relevant guidance silently and surface only material constraints or conflicts.
- Risk: teams may treat examples as default Weave policy.
  Mitigation: template examples should be clearly editable placeholders.
- Risk: scaffold repair could overwrite custom team guidance.
  Mitigation: use `writeFileIfMissing` and add tests proving preservation.
- Risk: installed skill copies drift from templates.
  Mitigation: accept this drift intentionally for this change and rely on Weave's status/diff/update behavior to surface it; do not hide the drift by syncing installed copies.
- Risk: the existing template-alignment test may fail because installed skill copies are intentionally stale.
  Mitigation: update the test expectation to distinguish intentional local installed-skill drift from package template regressions.
- Risk: `weave doctor --fix` grows into an unsafe "fix everything" command.
  Mitigation: constrain v1 to additive scaffold repair only and route stronger actions to existing explicit commands such as `weave agent update`.
- Risk: `weave doctor` duplicates `weave status`.
  Mitigation: keep `weave status` focused on current status and notices, while `weave doctor` provides a check list with repairability and optional safe scaffold creation.

## Revision History

- 2026-06-07: Clarified that implementation should update only bundled templates and intentionally leave installed `.agents`, `.claude`, and `.opencode` copies untouched so drift behavior remains observable.
- 2026-06-07: Expanded scope to include `weave doctor` as a read-only project health report and `weave doctor --fix` as the safe missing-scaffold repair path for existing projects.
