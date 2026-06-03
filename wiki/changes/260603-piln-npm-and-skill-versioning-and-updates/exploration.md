---
artifact: exploration
status: ready
owner: product
created_at: 2026-06-03T10:03:45.819Z
updated_at: 2026-06-03T12:56:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Npm And Skill Versioning And Updates

## Topic

Notify users when a newer version of the published `weave-it` npm package is available, and when the bundled Weave skills in their repos drift from the version they installed. "Version" covers both the package version and a per-skill version.

## Current Understanding

`weave-it` will be published to the npm registry. After publication, users install the package globally and install agent skills per-repo. The package and the bundled skills evolve together but on independent cadences from any one user's perspective: a user can upgrade the global package without re-installing skills in any individual repo, and vice versa. Today neither the package nor the skills surface "your install is behind" anywhere - there is no version metadata on skills, no notice mechanism, no read-only status command, and the install/update flow is silent about upstream version movement.

Skills are part of the package tarball (`files: ["dist", "templates"]` in `package.json`), so a "skill version" reflects the package version in which the skill last meaningfully changed. The notification system needs to detect two independent staleness conditions - a newer package on npm, and stale per-repo skill installs - and reach both human users at the terminal and AI agents that invoke the CLI programmatically without corrupting machine-readable output.

## Open Questions

Resolved during exploration; none blocking PRD.

Deferred to architecture (`weave-architect`):

- Cache TTL and cache file location for the npm version check.
- Exact opt-out env var name (e.g., `WEAVE_NO_UPDATE_NOTIFIER` vs `WEAVE_OFFLINE` vs `NO_UPDATE_NOTIFIER`).
- npm version transport (CLI vs registry HTTP vs library such as `latest-version`).
- Cold-start performance budget for the footer check on `weave --help`.
- npm dist-tag handling (`latest` only or allow `next`/`beta` opt-in).
- How the release script discovers the previously published tag reliably (CI step vs `npm view`).

Deferred to PRD (`weave-prd`):

- Final wording per notice kind (`package_outdated`, `skills_outdated`, `skill_modified`, `skills_new`).
- Exact `weave status` output layout for human and `--json` modes.
- Skill `SKILL.md` boilerplate text and placement (relative to existing Plan Mode Guard section).

## Decisions

### Domain Language

- "Package version" = the published `weave-it` npm version (one number per release).
- "Skill version" = the package version in which that skill last meaningfully changed. Recorded as `last_changed_in: <package-version>` in each `SKILL.md`'s YAML frontmatter.
- "Skill drift" = a per-repo, per-skill condition where the installed copy does not match the currently bundled copy. Three sub-states:
  - `stale`: the bundled skill has moved since install (different `last_changed_in`); installed content otherwise unchanged from the bundle at install time.
  - `modified`: the user edited the installed copy (existing concept; detected via content hash in `.weave/agents.yml`).
  - `modified + stale`: both conditions hold at once.
- "Notice" = a single structured staleness/upgrade message with `kind`, `severity`, `message`, and structured `payload`. Notice kinds for v1: `package_outdated`, `skills_outdated`, `skill_modified`, `skills_new`.

### Skill Version Model

- Each `templates/skills/<name>/SKILL.md` gains a `last_changed_in: <package-version>` frontmatter field.
- A release script bumps `last_changed_in` by diffing `templates/skills/**` against the previously published git tag. Contributors do not manage the value by hand.
- Independent per-skill semver is explicitly rejected for v1 because skills do not have an independent distribution channel and the discipline cost does not earn user-visible value.
- Hash-only drift detection is retained for the local-edit case; the version field complements it, it does not replace it.

### Notification Surfaces (three layers)

- Passive stderr footer on every `weave` invocation.
- Enriched output from `weave agent install` and `weave agent update` that reports per-skill version gaps in addition to the existing per-file status.
- A new read-only top-level command `weave status` with the full picture.
- No magic top-level `weave update` command.

### Footer Scope (two checks)

- Check A: newer `weave-it` on npm. Cached HTTPS check, opt-out.
- Check B: stale skills in this repo, derived from `.weave/agents.yml` and bundled `templates/skills/**`. Local; no network.
- Inside a Weave repo, prefer surfacing local skill drift first; combine when both fire.
- Outside a Weave repo (no `.weave/`), only Check A fires.

### Audience And Delivery (dual, structured)

- The footer writes only to stderr.
- The footer is auto-suppressed when any of: `--json` is set on the invoked command, stdout is non-TTY, the `CI` env var is set, or the opt-out env var is set.
- Every command's `--json` output gains a stable top-level `notices` array of `{kind, severity, message, payload}`. The shape is additive and stable across releases.
- Each shipped `SKILL.md` gets boilerplate that reads notices from `weave workspace --json` (or equivalent) during its discovery phase and surfaces them to the human via the agent.

### Action Model (inform-only)

- The CLI never invokes `npm i -g` on the user's behalf. The cost of getting it wrong (sudo, package-manager detection across npm/yarn/pnpm/volta/nvm, broken global installs) outweighs the convenience.
- Notices state facts and always end with: `Run "weave status" for details and remediation commands.`
- `weave status` is the single locus for conditional remediation UX. It prints suggested commands per skill state:
  - stale only: suggest `weave agent update <agent>`.
  - modified only: suggest `weave agent diff <agent> <skill>` (review) or `weave agent reset <agent> <skill>` (discard edits).
  - modified + stale: suggest `weave agent reset <agent> <skill>` (discard edits, adopt new) or `weave agent diff <agent> <skill>` (review before manual merge).
- No three-way merge of modified-and-stale skill files; that is explicitly out of scope.

### Notice Content (terse)

- Notice format: `<skill>: bundled <X>, you installed <Y>[, locally modified]`.
- No diffs inline. No remediation commands inline.
- All remediation lives in `weave status`. The notice always ends with a pointer to it.

### Migration Baseline

- On the day the `last_changed_in` field ships, all existing bundled skills are pinned to the package version that introduces the field. No git-history backfill is attempted.

### New Skills

- A future release that adds a brand-new skill triggers a `skills_new` notice and adds a "New skills available" section to `weave status`.
- Users pick new skills up via the existing `weave agent install <agent>` flow. No auto-install. Mutating a repo without explicit user action is a behavior Weave has deliberately avoided.

## Scenarios

### Scenario: Global Package Upgrade Leaves Repo Skills Behind

Alice has `weave-it@0.1.0` installed globally and ran `weave agent install claude` in repo `foo` weeks ago. She runs `npm i -g weave-it@latest` (now `0.3.0`). On her next `weave change new "Something"` in repo `foo`, the stderr footer surfaces "N skills outdated" with version pairs and points to `weave status`. If she instead invokes a skill via Claude (`/weave-explore`), the same notice reaches her through the skill boilerplate that reads `--json` notices and surfaces them in chat.

### Scenario: Skill Was Locally Modified And Has A Newer Version

Alice hand-edited `.claude/skills/weave-prd/SKILL.md` to add a project-specific rule. The package later upgraded and `weave-prd` moved to `last_changed_in: 0.3.0`. A single notice surfaces the skill as `modified + stale` with bundled and installed versions. `weave status` shows the two remediation options: `weave agent diff claude weave-prd` to review upstream changes, or `weave agent reset claude weave-prd` to discard her edits and adopt the new bundled version. `weave agent update` continues to skip the modified file (status quo from `installArtifact` and `updateArtifact` in `src/lib/agent-skills.ts`).

### Scenario: Brand-New Skill In A Release

A future release adds `weave-foobar` to the bundled templates. Alice's installed skills do not include `weave-foobar`. `weave status` lists it under "New skills available (introduced in 0.4.0)"; a `skills_new` notice fires in the footer and in `--json` notices. Alice runs `weave agent install claude` to pick it up.

### Scenario: Offline Or npm Registry Unreachable

Check A (npm) fails silently or returns from a cached previous result if available. Check B (local skill drift) still fires from `.weave/agents.yml` and bundled templates. The CLI does not block, does not retry loudly, and does not produce error noise.

### Scenario: Agent Or CI Context (--json, non-TTY, CI=1)

The stderr footer is suppressed automatically. Notices still travel inside the `--json` `notices` array unchanged. AI-agent skills that call `weave workspace --json` get the same staleness signal a human would get from `weave status`, and surface it to the human via the agent UI.

### Scenario: Fresh User With No `.weave/`

Outside any Weave repo, `weave status` reports installed package version + latest known package version, plus "Not a Weave repo. Run `weave init` to set up Weave here." Check B does not fire because there is nothing to compare.

## Existing Behavior

- Package: `weave-it` at `0.1.0` in `package.json`. The published tarball includes `dist` and `templates`, so skills travel inside the package.
- Skill frontmatter today: only `name` + `description` (e.g., `templates/skills/weave-explore/SKILL.md` lines 1-4). No version field.
- Install manifest `.weave/agents.yml`: records per-skill `path`, `source_hash`, `installed_hash`, `installed_at` per agent. No version field.
- Drift detection: `installArtifact` and `updateArtifact` in `src/lib/agent-skills.ts` already detect local edits via hash mismatch and skip them with status `modified`. `weave agent diff` and `weave agent reset` already exist as the manual remediation commands.
- No npm-version check, no notice mechanism, no `weave status` command, and no `--json notices` field exists today.

## PRD Readiness

Ready
