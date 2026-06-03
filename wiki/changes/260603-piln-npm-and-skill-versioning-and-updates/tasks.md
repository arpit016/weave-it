---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-03T15:05:00.000Z
updated_at: 2026-06-03T15:05:00.000Z
source: architecture
---

# Tasks: Npm and skill versioning and updates

## Source Context

- PRD: `wiki/changes/260603-piln-npm-and-skill-versioning-and-updates/prd.md`
- Architecture: `wiki/changes/260603-piln-npm-and-skill-versioning-and-updates/architecture.md`
- Sessions: `wiki/changes/260603-piln-npm-and-skill-versioning-and-updates/sessions/*-architecture.md`
- Codebase: `src/lib/agent-skills.ts`, `src/lib/changes.ts`, `src/commands/change.ts`, `src/commands/workspace.ts`, `src/cli.ts`, `templates/skills/**`, `tests/agent-skills.test.ts`, `tests/changes.test.ts`

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
| T1 | todo | AFK | Skill version metadata + local-drift notice + `weave status` command | None |
| T2 | todo | AFK | Cached npm version check + `package_outdated` notice | T1 |
| T3 | todo | AFK | `withNotices` helper wired into the five Tier 1 commands | T2 |
| T4 | todo | AFK | `# Surface Weave Notices` boilerplate to 10 SKILL.md templates + byte-identity helper | T3 |
| T5 | todo | AFK | Release script `scripts/bump-skill-versions.mjs` + `npm run release:bump-skills` | T1 |
| T6 | todo | AFK | Plan Mode Protocol embedded in 4 design-discussion skills + byte-identity test | T4 |
| T7 | todo | AFK | `weave-capture` defensive lane-mismatch check | T6 |
| T8 | todo | AFK | `weave change progress --no-invalidate` / `--invalidate=<list>` flags | None |
| T9 | todo | AFK | `weave change clear-stale <lane>` + `stale_history` audit trail | T8 |
| T10 | todo | AFK | Lifecycle Staleness Verification Protocol embedded in 5 SKILLs | T4, T8, T9 |
| T11 | todo | AFK | README.md update covering full feature surface | T1, T2, T3, T4, T5, T6, T7, T8, T9, T10 |
| T12 | done | AFK | Strengthen Plan Mode Guard in 2 plan-mode-required skills; remove Plan Mode Protocol from all 4 | T6 |

## T1: Skill version metadata + local-drift notice + `weave status` command

Status: todo

Type: AFK

Blocked by: None - can start immediately

User stories covered: US1, US7, US11, US13

Origin: none

Related finding: none

### What to build

Establish the skill-version baseline and ship the first user-visible notice channel end-to-end. The slice covers: frontmatter schema, manifest schema, in-memory notice generation, and the `weave status` command. No npm check yet (deferred to T2), no command-wrapper wiring yet (deferred to T3).

Concretely:

- Add `last_changed_in: 0.1.0` to the frontmatter of every bundled template in `templates/skills/<name>/SKILL.md` (all 10 skills).
- Extend `parseSkillFrontmatter` in `src/lib/agent-skills.ts` to read `last_changed_in`. The field is required for bundled templates; throw a clear error naming the offending file when missing.
- Extend `DefaultSkill` with `last_changed_in: string` and `ManifestEntry` with `installed_from: string | null`.
- Extend `installArtifact`, `updateArtifact`, and `resetArtifact` to stamp `installed_from` from the bundled skill's `last_changed_in`. Extend `loadAgentsManifest` to tolerate legacy entries missing `installed_from` (defaults to `null`).
- Create `src/lib/notices.ts` exporting a stable `Notice` type and `gatherNotices(opts)` function. v1 emits only the two local-drift notices: `skills_modified` (manifest hash differs from disk) and `skills_outdated` (manifest `installed_from` differs from bundled `last_changed_in`). Reuse the existing hash-based diff logic from `agent-skills.ts`.
- Create `src/lib/status.ts` exposing a `buildStatus()` function that composes notices + manifest + bundled-template inventory into a structured result.
- Create `src/commands/status.ts` registering `weave status` with `--json`. Text mode prints sectioned output (per-agent skill table with version/state columns, notices section). JSON mode emits the stable schema.
- Register `statusCommand` in `src/cli.ts`.

### Acceptance Criteria

- [ ] All 10 `templates/skills/<name>/SKILL.md` files carry `last_changed_in: 0.1.0` in frontmatter
- [ ] `parseSkillFrontmatter` throws a descriptive error when a bundled template is missing `last_changed_in` (test covers this)
- [ ] `ManifestEntry` includes `installed_from: string | null`; legacy manifest entries load successfully with `installed_from: null`
- [ ] After `weave agent install <agent>` against a clean repo, every entry in `.weave/agents.yml` has `installed_from` set to the bundled `last_changed_in`
- [ ] `gatherNotices` returns a `skills_modified` notice when the user edits an installed `SKILL.md` (hash drift detected)
- [ ] `gatherNotices` returns a `skills_outdated` notice when manifest `installed_from` differs from bundled `last_changed_in`
- [ ] `gatherNotices` returns `[]` when manifest and bundled templates fully agree
- [ ] `weave status` text mode prints a readable summary including per-agent skill state and notices
- [ ] `weave status --json` returns `{ status: "ok", targets: [...], notices: [...] }`
- [ ] Existing `tests/agent-skills.test.ts` and `tests/cli-skills.test.ts` continue to pass with manifest schema extension

### Verification

- Automated tests: `npm test -- agent-skills cli-skills` plus new `tests/notices.test.ts` (table-driven over drift states) and `tests/cli-status.test.ts` (integration: temp repo with known manifest + templates; snapshot text and JSON output for in-repo / out-of-repo / no-skills variants)
- Typecheck: `npm run typecheck`
- Manual/smoke check: `npm run dev -- status` in this repo; edit a `.claude/skills/weave-new/SKILL.md`; rerun `npm run dev -- status` and confirm `skills_modified` notice appears

## T2: Cached npm version check + `package_outdated` notice

Status: todo

Type: AFK

Blocked by: T1

User stories covered: US2, US8, US11

Origin: none

Related finding: none

### What to build

Add the npm-side half of the notice system. Introduces a user-level cache and a third notice type. No CLI surface changes beyond what `weave status` already provides (the notice flows through the existing `gatherNotices` pipeline).

Concretely:

- Create `src/lib/user-paths.ts` exporting `getUserCacheDir()` returning `~/.weave/cache/` (creates the directory on first use; tolerates `EACCES`).
- Add `readJsonCache<T>(path)` and `writeJsonCache<T>(path, data)` helpers to `src/lib/files.ts`. Atomic write via existing `writeFileAtomic`. Tolerates missing or corrupted JSON (returns `null`).
- Create `src/lib/npm-version.ts` exporting `getNpmVersionInfo({ now, fetch, packageVersion })` returning `{ cachedLatest, isStale, ... }`. Uses Node 22 `fetch` + `AbortController` (3s timeout). Reads/writes `~/.weave/cache/npm-version.json` with 24h TTL. First-run is fire-and-forget background fetch returning `null` synchronously. Honours `NO_UPDATE_NOTIFIER` env var (skip both read and fetch).
- Extend `gatherNotices` to call `getNpmVersionInfo` and emit `package_outdated` when `cachedLatest > installedVersion`.
- Honour `WEAVE_NO_NOTICES=1` by short-circuiting `gatherNotices` to return `[]`.

### Acceptance Criteria

- [ ] `getNpmVersionInfo` returns `{ cachedLatest: "0.2.0" }` when the cache file has a recent fetch newer than the installed version
- [ ] `getNpmVersionInfo` triggers a background fetch on a cold cache and returns `{ cachedLatest: null }` synchronously
- [ ] `getNpmVersionInfo` returns `{ cachedLatest: null }` when `NO_UPDATE_NOTIFIER=1` is set
- [ ] `getNpmVersionInfo` aborts the fetch after 3 seconds and writes nothing to cache
- [ ] `getNpmVersionInfo` tolerates malformed JSON in the cache file (returns `null`, schedules a fresh fetch)
- [ ] `gatherNotices` returns a `package_outdated` notice when the cached latest is newer than the installed version
- [ ] `gatherNotices` returns `[]` when `WEAVE_NO_NOTICES=1` is set, regardless of drift state
- [ ] Cache directory is created on first use; `EACCES` on write is swallowed silently (no thrown error)
- [ ] `weave status --json` includes the `package_outdated` notice when the cached state warrants it

### Verification

- Automated tests: new `tests/npm-version.test.ts` (injectable `fetch` and clock; cases for cache hit, cache miss, timeout, malformed JSON, `NO_UPDATE_NOTIFIER`, write-permission failure). Extend `tests/notices.test.ts` for `package_outdated` and `WEAVE_NO_NOTICES`
- Typecheck: `npm run typecheck`
- Manual/smoke check: with the package version temporarily reduced in `package.json`, run `npm run dev -- status --json`, confirm the `package_outdated` notice after the second invocation (first populates cache)

## T3: `withNotices` helper wired into the five Tier 1 commands

Status: todo

Type: AFK

Blocked by: T2

User stories covered: US2, US3, US5, US6, US8, US9, US12, US14

Origin: none

Related finding: none

### What to build

The notice-plumbing core. Five command actions wrap with a single helper; the helper handles parallel notice gathering, JSON merging, stderr footer rendering, and suppression rules. No central renderer; non-Tier-1 commands stay untouched.

Concretely:

- Create `src/lib/with-notices.ts` exporting `withNotices(commandName, actionFn)`. Calls `actionFn` and `gatherNotices()` in parallel. On `--json` action results, merges `notices: Notice[]` into the result object at the top level. On non-JSON results, prints the action output as today and additionally writes a one-line stderr footer like `weave-it: <N> notice(s) - run 'weave status' for details` when notices exist.
- Suppression rules (applied to stderr footer only; JSON contract is unconditional unless `WEAVE_NO_NOTICES=1`): suppress when `process.stdout.isTTY === false`, when `process.env.CI` is truthy, when `process.env.WEAVE_NO_NOTICES === "1"`, or when the command's own `--json` flag was passed (notices already flow through JSON contract).
- Wrap action handlers in `src/commands/workspace.ts` (workspace), `src/commands/change.ts` (`current`, `status`, `new` subcommand actions), and `src/commands/status.ts` (status, added in T1). Five wrap sites total.
- Add `tests/with-notices.test.ts` with a fake `gatherNotices` to assert JSON merging, stderr footer formatting, and every suppression branch.
- Add `tests/cli-tier1-notices.test.ts` that enumerates the five Tier 1 commands and asserts each `--json` output includes a `notices` array; also asserts a representative non-Tier-1 command (e.g., `weave artifact current --json`) does NOT include `notices`.

### Acceptance Criteria

- [ ] All five Tier 1 commands return `notices: Notice[]` in their `--json` output (empty array when no notices)
- [ ] A representative non-Tier-1 command (e.g., `weave artifact current --json`) does NOT include `notices`
- [ ] Non-JSON Tier 1 commands emit a one-line stderr footer when notices exist
- [ ] Stderr footer is suppressed when stdout is not a TTY (piped output)
- [ ] Stderr footer is suppressed when `CI=true`
- [ ] Stderr footer is suppressed when `WEAVE_NO_NOTICES=1`
- [ ] Stderr footer is suppressed for `--json` invocations of Tier 1 commands
- [ ] Notice gathering runs in parallel with the wrapped action (cold-start measurement shows no measurable regression beyond a few ms)
- [ ] Failures inside `gatherNotices` do not bubble out; they degrade to "no notices" with the action output unaffected

### Verification

- Automated tests: `npm test -- with-notices cli-tier1-notices` plus updates to `tests/cli-skills.test.ts` snapshots for the five Tier 1 commands
- Typecheck: `npm run typecheck`
- Manual/smoke check: in this repo, run each Tier 1 command with and without `--json`; confirm JSON output carries `notices` and TTY output carries the footer; pipe to `cat` and confirm the footer disappears

## T4: `# Surface Weave Notices` boilerplate to 10 SKILL.md templates + byte-identity helper

Status: todo

Type: AFK

Blocked by: T3

User stories covered: US3, US5, US9

Origin: none

Related finding: none

### What to build

Make every bundled skill surface notices to the user through its agent host. Introduces the shared byte-identity-check infrastructure that T6 and T10 will reuse.

Concretely:

- Create `src/lib/skill-template-checks.ts` exporting `EXPECTED_NOTICE_BOILERPLATE` as a `const`. Pure constant; no logic.
- Append `EXPECTED_NOTICE_BOILERPLATE` verbatim to all 10 `templates/skills/<name>/SKILL.md` files after the first discovery block and before the skill-specific workflow (PRD-locked placement).
- Extend `tests/agent-skills.test.ts` with a `assertSkillBlockPresence(skillName, expectedBlock, requiredFor)` helper. Helper reads both the source template at `templates/skills/<name>/SKILL.md` AND every installed destination (`.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`, `.opencode/skills/<name>/SKILL.md`, `.codex/skills/<name>/SKILL.md` if present) and asserts the expected substring is byte-identical in each.
- Call `assertSkillBlockPresence` from the existing skill-template tests for all 10 skills against `EXPECTED_NOTICE_BOILERPLATE`.

### Acceptance Criteria

- [ ] `src/lib/skill-template-checks.ts` exists and exports `EXPECTED_NOTICE_BOILERPLATE`
- [ ] All 10 bundled `SKILL.md` templates contain `EXPECTED_NOTICE_BOILERPLATE` verbatim
- [ ] All installed destinations under `.claude/`, `.agents/`, and `.opencode/` contain `EXPECTED_NOTICE_BOILERPLATE` verbatim after `weave agent install --all` (the agent skills are re-installed as part of this task's setup)
- [ ] `assertSkillBlockPresence` helper is reusable (T6 and T10 will consume it without modification)
- [ ] CI fails (test fails) if any one template's copy of the boilerplate drifts from the canonical constant

### Verification

- Automated tests: `npm test -- agent-skills`
- Typecheck: `npm run typecheck`
- Manual/smoke check: temporarily mutate one character of the boilerplate in one installed `SKILL.md`; rerun the test; confirm a clear failure naming the offending file

## T5: Release script `scripts/bump-skill-versions.mjs` + `npm run release:bump-skills`

Status: todo

Type: AFK

Blocked by: T1

User stories covered: US1, US10, US11

Origin: none

Related finding: none

### What to build

Automate the maintainer-side step of bumping `last_changed_in` to the upcoming release version for every skill whose source changed since the previous tag.

Concretely:

- Create `scripts/bump-skill-versions.mjs` (ESM, zero new deps). Resolves the previous release tag via `git describe --tags --abbrev=0`. For each `templates/skills/<name>/SKILL.md`, runs `git diff <prev-tag>..HEAD -- <path>`; when the diff is non-empty, rewrites the file's frontmatter `last_changed_in` to the upcoming package version (read from `package.json`).
- When no reachable tag exists (first release), treat every skill as new and stamp every file.
- When a bundled skill is missing `last_changed_in` entirely, default with a warning printed to stderr and continue.
- Add `"release:bump-skills": "node scripts/bump-skill-versions.mjs"` to `package.json` scripts. The script writes only; the maintainer commits the diff as part of the release PR.
- Add `tests/scripts/bump-skill-versions.test.ts` (or extend `tests/agent-skills.test.ts`) that drives the script in a temp git repo with known tags and confirms only the changed-since-tag skills get their `last_changed_in` bumped.

### Acceptance Criteria

- [ ] `npm run release:bump-skills` exists and runs without error in a repo with at least one prior tag
- [ ] In a controlled temp git repo with one skill modified since the prior tag, the script updates only that skill's `last_changed_in`
- [ ] With no prior tag reachable, the script updates every bundled skill's `last_changed_in` to the upcoming version
- [ ] When a bundled skill lacks `last_changed_in`, the script defaults with a warning, does not throw, and continues
- [ ] The script never invokes `git commit`, `git tag`, or any write-side git command
- [ ] The script does not require network access

### Verification

- Automated tests: `npm test -- bump-skill-versions`
- Typecheck: not applicable (`.mjs`); shape-check via `node --check scripts/bump-skill-versions.mjs`
- Manual/smoke check: in a scratch clone, create a fake tag `v0.0.1`, modify one template, run `npm run release:bump-skills`, confirm only that template's `last_changed_in` updated

## T6: Plan Mode Protocol embedded in 4 design-discussion skills + byte-identity test

Status: todo

Type: AFK

Blocked by: T4

User stories covered: US15, US16

Origin: none

Related finding: none

### What to build

Realise the Plan Mode Protocol entirely through SKILL.md text and CI tests. Zero new runtime code. The four design-discussion skills get a byte-identical protocol block; the byte-identity helper from T4 enforces it across templates and installed copies.

Concretely:

- Add `EXPECTED_PLAN_MODE_PROTOCOL` to `src/lib/skill-template-checks.ts` (exact text per architecture decision #12).
- Embed the protocol verbatim in `templates/skills/weave-explore/SKILL.md` (lane: `exploration`), `templates/skills/weave-prd/SKILL.md` (lane: `prd`), `templates/skills/weave-architect/SKILL.md` (lane: `architecture`), and `templates/skills/weave-clarify/SKILL.md` (lane: `<target>` - dynamically derived from user argument).
- Extend the test in `tests/agent-skills.test.ts` to call `assertSkillBlockPresence` for each of the four design-discussion skills, with `<lane>` substitutions normalised before comparison.
- Assert the 5 non-design-discussion skills (`weave-new`, `weave-next`, `weave-issues`, `weave-knowledge`, `weave-propagate`, `weave-capture`) do NOT contain `# Plan Mode Protocol`.

### Acceptance Criteria

- [ ] `EXPECTED_PLAN_MODE_PROTOCOL` exported from `src/lib/skill-template-checks.ts`
- [ ] All 4 design-discussion skill templates contain the byte-identical block (with the documented lane substitution rule)
- [ ] All 4 installed destinations of each design-discussion skill contain the byte-identical block
- [ ] All 5 non-design-discussion skill templates and their installed copies do NOT contain `# Plan Mode Protocol`
- [ ] A test failure clearly identifies which skill/agent destination drifted

### Verification

- Automated tests: `npm test -- agent-skills`
- Typecheck: `npm run typecheck`
- Manual/smoke check: invoke one design-discussion skill from Cursor in Plan Mode; confirm the LLM declares `Lane: <lane>` and the post-acceptance directive, does NOT attempt the `weave artifact current set` call in plan mode, and DOES run it as the first action after plan acceptance. Repeat manual check once per agent (claude, cursor, codex, opencode) during release verification

## T7: `weave-capture` defensive lane-mismatch check

Status: todo

Type: AFK

Blocked by: T6

User stories covered: US17

Origin: none

Related finding: none

### What to build

Add the safety-net defensive check to `weave-capture`. SKILL.md-only edit; no CLI changes. Catches the case where the user invokes capture before the Plan Mode Protocol's deferred `weave artifact current set` directive has been honoured.

Concretely:

- Add a new section to `templates/skills/weave-capture/SKILL.md` instructing the LLM to:
  1. Inspect the just-completed conversation since the last capture (visible in the LLM's own context) AND the stored artifact context returned by `weave artifact current --json`.
  2. If the substance points clearly at a lane different from the stored context (heuristic: the most recently invoked design-discussion skill in the conversation does not match stored context's lane), surface the mismatch and ask the user which lane to use, presenting both options.
  3. If an explicit lane argument was passed (`weave-capture <lane>` or `weave-capture session <lane>`), skip the check.
- Re-install `weave-capture` to every agent destination via `weave agent update --all` (covered by T11 docs).
- Extend the existing `tests/agent-skills.test.ts` to assert `templates/skills/weave-capture/SKILL.md` contains a defensive-lane-mismatch section header (literal heading match - not full byte-identity since the section is unique to capture).

### Acceptance Criteria

- [ ] `templates/skills/weave-capture/SKILL.md` contains a clearly-headed defensive-lane-mismatch section
- [ ] All installed copies of `weave-capture` contain the same section after `weave agent update --all`
- [ ] A test asserts the section header is present (regression-locks against deletion)
- [ ] Explicit lane argument (`weave-capture <lane>`) is documented as the deterministic escape hatch in the same section

### Verification

- Automated tests: `npm test -- agent-skills`
- Typecheck: `npm run typecheck`
- Manual/smoke check: in a test change with a known stale stored artifact context (e.g., stored = `exploration`, just finished a `/weave-architect` conversation), invoke `/weave-capture` with no argument; confirm capture asks which lane to use. Repeat with `weave-capture architecture` and confirm no question is asked

## T8: `weave change progress --no-invalidate` / `--invalidate=<list>` flags

Status: todo

Type: AFK

Blocked by: None - can start immediately

User stories covered: US18, US19

Origin: none

Related finding: none

### What to build

Add the two opt-in flags that let the agent (or user) suppress or scope down the pessimistic staleness propagation in `weave change progress`. Default behavior is preserved bit-for-bit.

Concretely:

- Extend `ProgressChangeOptions` in `src/lib/changes.ts` with optional `noInvalidate?: boolean` and `invalidateOnly?: ChangeStage[]`.
- Modify the staleness-propagation block (currently the `transitiveDependents` loop that marks every dependent stale): when `noInvalidate === true`, skip the loop entirely; when `invalidateOnly` is non-empty, intersect `transitiveDependents(stage, artifacts)` with `invalidateOnly` and mark only that intersection.
- Validate `invalidateOnly` entries: every entry must be a valid `ChangeStage` AND must actually appear in the transitive-dependents set. On violation, throw `ChangeCommandError` with a message naming the offending entries and listing the actual dependents.
- Mutually-exclusive validation: if both `noInvalidate` and `invalidateOnly` are passed, throw `ChangeCommandError` before any write.
- Wire `--no-invalidate` (boolean) and `--invalidate <list>` (comma-separated string parsed to array) onto the existing `weave change progress` subcommand in `src/commands/change.ts`.

### Acceptance Criteria

- [ ] `weave change progress <lane> --source <list>` (no new flags) produces bit-for-bit identical staleness propagation to today's behavior
- [ ] `weave change progress <lane> --source <list> --no-invalidate` progresses without touching any entry in `stale`
- [ ] `weave change progress <lane> --source <list> --invalidate=<comma-list>` marks only the named lanes stale (intersected with actual dependents)
- [ ] `weave change progress <lane> --source <list> --invalidate=<non-dependent-lane>` errors clearly, naming the offending entry and the actual transitive dependents
- [ ] `weave change progress <lane> --source <list> --no-invalidate --invalidate=<list>` errors mutually-exclusive without touching state
- [ ] All error paths exit non-zero and emit a structured `--json` error when `--json` is passed
- [ ] All existing `tests/changes.test.ts` cases continue to pass unmodified

### Verification

- Automated tests: new `tests/cli-change-staleness.test.ts` cases 1-5 (default regression-lock, `--no-invalidate`, `--invalidate=<dependent>`, `--invalidate=<non-dependent>`, mutually-exclusive)
- Typecheck: `npm run typecheck`
- Manual/smoke check: in a scratch change with prd → architecture lanes set up, run each flag combination above and confirm `status.yml` matches expectations

## T9: `weave change clear-stale <lane>` + `stale_history` audit trail

Status: todo

Type: AFK

Blocked by: T8

User stories covered: US20

Origin: none

Related finding: none

### What to build

Add an explicit lever for clearing stale flags with an audit trail. Distinct from `weave change progress`; the clear operation never progresses the change, and the progress operation never auto-clears flags.

Concretely:

- Extend `ChangeStatusMetadata` and `StaleChangeLanes` types in `src/lib/changes.ts` with an optional `stale_history?: StaleHistoryEntry[]`; parsers tolerate its absence on legacy files.
- Define `StaleHistoryEntry = { lane: ChangeStage; cleared_at: string; cleared_by: "agent" | "user"; reason?: string }`.
- Add an exported function `clearChangeStaleness({ lane, reason, changePath }): ClearStaleResult`. Loads `status.yml`, removes `<lane>` from the `stale` map if present, appends a new entry to `stale_history`, writes atomically. If `<lane>` is not stale, returns `{ status: "noop", lane, message }` without mutating the file. The clearer identity is inferred from `process.env.WEAVE_INVOKED_BY_AGENT === "1"` first, otherwise from the `--json` flag (defaults: JSON → `agent`, TTY → `user`).
- Add a new subcommand `weave change clear-stale <lane> [--reason <text>] [--json]` in `src/commands/change.ts` wired to `clearChangeStaleness`.
- In non-JSON mode, emit a one-line stderr informational message describing the result (`stale flag cleared on <lane>` or `<lane> was not stale (no-op)`). In `--json` mode, return `{ status: "cleared" | "noop", lane, change, message }`.

### Acceptance Criteria

- [ ] `weave change clear-stale <lane>` removes `<lane>` from `stale` and appends an entry to `stale_history`
- [ ] `weave change clear-stale <lane>` on an already-clean lane is a successful no-op with no audit entry written and exit code 0
- [ ] `weave change clear-stale <lane> --reason "<text>"` persists the reason in the audit entry
- [ ] `weave change clear-stale <lane> --json` returns `{ status: "cleared" | "noop", ... }`
- [ ] Setting `WEAVE_INVOKED_BY_AGENT=1` causes the audit entry to record `cleared_by: "agent"`
- [ ] `stale_history` is read-tolerant: legacy `status.yml` files without the field load successfully
- [ ] Existing `weave change progress` and `weave change status` commands continue to work unchanged

### Verification

- Automated tests: `tests/cli-change-staleness.test.ts` cases 6-9 (clear, no-op, reason persistence, default-behavior preserved sequentially)
- Typecheck: `npm run typecheck`
- Manual/smoke check: progress a lane to create stale flags, run `weave change clear-stale <lane> --reason "verified"`, inspect `status.yml` for the `stale_history` entry

## T10: Lifecycle Staleness Verification Protocol embedded in 5 SKILLs

Status: todo

Type: AFK

Blocked by: T4, T8, T9

User stories covered: US15, US18, US19, US20, US21

Origin: none

Related finding: none

### What to build

Embed the verification protocol in every skill that calls `weave change progress`. Byte-identity-enforced like the Plan Mode Protocol. Closes the loop: the agent reads both artifacts, makes a content-sync judgement, and picks the appropriate lever (`--no-invalidate`, `--invalidate`, default, or `clear-stale`) from T8/T9.

Concretely:

- Add `EXPECTED_LIFECYCLE_SYNC_PROTOCOL` to `src/lib/skill-template-checks.ts` (exact text per architecture decision #13).
- Embed the protocol verbatim in `templates/skills/weave-explore/SKILL.md`, `templates/skills/weave-prd/SKILL.md`, `templates/skills/weave-architect/SKILL.md`, `templates/skills/weave-clarify/SKILL.md`, and `templates/skills/weave-capture/SKILL.md`. Placement: immediately before each skill's existing `Lifecycle Progress` section.
- Extend `tests/agent-skills.test.ts` to call `assertSkillBlockPresence` (the helper from T4) for each of the five skills against `EXPECTED_LIFECYCLE_SYNC_PROTOCOL`.
- Assert the four templates that never call `weave change progress` (`weave-new`, `weave-next`, `weave-issues`, `weave-knowledge`, `weave-propagate`) do NOT contain the block.

### Acceptance Criteria

- [ ] `EXPECTED_LIFECYCLE_SYNC_PROTOCOL` exported from `src/lib/skill-template-checks.ts`
- [ ] All 5 progress-calling skill templates contain the byte-identical block
- [ ] All installed destinations of each of those 5 skills contain the byte-identical block
- [ ] The 5 non-progress-calling templates and their installed copies do NOT contain the block
- [ ] The shared `assertSkillBlockPresence` helper from T4 is reused without modification (single source of truth for byte-identity)
- [ ] The placement in each skill is immediately before the existing `Lifecycle Progress` section (so the verification runs before the progress call)

### Verification

- Automated tests: `npm test -- agent-skills`
- Typecheck: `npm run typecheck`
- Manual/smoke check: in a test change, invoke `/weave-clarify <lane>` for a narrow clarification (e.g., fix a typo in the PRD) and confirm the LLM consults dependents and uses `--no-invalidate` or `clear-stale` rather than letting the default pessimistic propagation create a false-positive stale flag

## T11: README.md update covering full feature surface

Status: todo

Type: AFK

Blocked by: T1, T2, T3, T4, T5, T6, T7, T8, T9, T10

User stories covered: US1, US2, US3, US4, US5, US6, US7, US8, US9, US10, US11, US12, US13, US14, US15, US16, US17, US18, US19, US20, US21

Origin: none

Related finding: none

### What to build

Update `README.md` so a new operator can discover, understand, and configure the entire feature without reading source. Single docs slice landing after all surfaces are implemented (so docs cannot drift mid-implementation).

Concretely, add or expand:

- A `weave status` section explaining what it shows and when to run it.
- A `last_changed_in` frontmatter section in the skill-authoring docs explaining how the field is populated (by the release script) and what it means for users.
- A `notices` JSON contract section documenting the stable `Notice` shape, the enumerated `kind` values (`package_outdated`, `skills_outdated`, `skills_modified`), and the Tier 1 set of commands that include `notices` in `--json` output.
- A `weave change progress` levers section documenting `--no-invalidate`, `--invalidate=<list>`, and `weave change clear-stale <lane> [--reason]`, with an example of when an agent should use each.
- A `WEAVE_INVOKED_BY_AGENT` and `WEAVE_NO_NOTICES` environment variable section documenting both opt-out / context env vars; also call out the industry-standard `NO_UPDATE_NOTIFIER`.
- A skill-author expectations section: every new skill must (a) call at least one Tier 1 discovery command, (b) include the `# Surface Weave Notices` boilerplate, (c) if it is a design-discussion skill, include the Plan Mode Protocol block, (d) if it calls `weave change progress`, include the Lifecycle Staleness Verification block. Reference the three canonical constants in `src/lib/skill-template-checks.ts`.
- A release-flow section documenting `npm run release:bump-skills` and the expected sequence (run script → review diff → commit → publish).

### Acceptance Criteria

- [ ] `README.md` documents `weave status` with example output
- [ ] `README.md` documents the `notices` JSON contract and enumerates the Tier 1 command set
- [ ] `README.md` documents `NO_UPDATE_NOTIFIER`, `WEAVE_NO_NOTICES`, and `WEAVE_INVOKED_BY_AGENT`
- [ ] `README.md` documents the three new `weave change` lever surfaces (`--no-invalidate`, `--invalidate=<list>`, `clear-stale`)
- [ ] `README.md` documents the four skill-author expectations with pointers to the three canonical constants
- [ ] `README.md` documents `npm run release:bump-skills` in the maintainer release flow
- [ ] All command examples in the README are runnable as-is against the current build

### Verification

- Automated tests: none (docs only)
- Typecheck: not applicable
- Manual/smoke check: have a teammate (or fresh agent session) read the README and successfully (a) install the package, (b) run `weave status`, (c) interpret a notice, (d) opt out via env var, (e) understand when an agent should pass `--no-invalidate`

## T12: Strengthen Plan Mode Guard in 2 plan-mode-required skills; remove Plan Mode Protocol from all 4

Status: done

Type: AFK

Blocked by: T6 (whose design this supersedes)

User stories covered: US15, US16

Origin: qa_finding

Related finding: QF1

### What to build

Replace the two-phase `# Plan Mode Protocol` with a single canonical `# Plan Mode Guard` byte-identical across the four design-discussion skills. The guard refuses non-Plan-Mode entry and explicitly authorizes the `weave artifact current set <lane> --json` call as the lane-commit step in Plan Mode (because it writes local session state only, not a repo-tracked artifact).

Concretely:

- Replace `EXPECTED_PLAN_MODE_PROTOCOL` with `EXPECTED_PLAN_MODE_GUARD` in `src/lib/skill-template-checks.ts`. The guard text substitutes `<lane>` and `<skill-name>` per skill.
- In each of `templates/skills/weave-{explore,architect,prd,clarify}/SKILL.md`:
  - Replace the existing Plan Mode Guard (where present) with the canonical block; add the canonical block where missing.
  - Delete the `# Plan Mode Protocol` section appended in T6.
  - Delete the now-redundant "Setting local artifact context with `weave artifact current set <lane> --json` is allowed because ..." sentences in the body (the rationale is consolidated in the guard).
- For `weave-clarify`, add the missing body call `weave artifact current set <target> --json` to its `# Resolve Context` section after change resolution (currently absent — a pre-existing gap surfaced by this fix).
- Re-sync agent skills with `npm run dev -- agent reset all` so installed copies pick up the changes.
- Update `tests/agent-skills.test.ts`:
  - Remove `EXPECTED_PLAN_MODE_PROTOCOL` import and the byte-identity assertion that referenced it.
  - Remove the non-presence assertion for `# Plan Mode Protocol`.
  - Add a byte-identity assertion for `EXPECTED_PLAN_MODE_GUARD` across the four design-discussion skill templates and installed copies (with `<lane>` and `<skill-name>` substitutions normalised before comparison).
  - Add a non-presence assertion for `# Plan Mode Guard` in the six non-design-discussion skills (`weave-new`, `weave-next`, `weave-issues`, `weave-knowledge`, `weave-propagate`, `weave-capture`).
- Rename `wiki/knowledge/domains/change-workflow/domain-wide/plan-mode-protocol.md` → `plan-mode-guard.md` and rewrite to describe the corrected unified Plan Mode Guard. Update the cross-reference in `wiki/knowledge/domains/change-workflow/index.md` and the capture feature doc.
- Update `wiki/changes/<change-id>/knowledge-delta.md` Durable Behavior Changes section and re-run `weave change knowledge updated` with the renamed file.

### Acceptance Criteria

- [ ] `EXPECTED_PLAN_MODE_GUARD` exported from `src/lib/skill-template-checks.ts`; `EXPECTED_PLAN_MODE_PROTOCOL` removed.
- [ ] All 4 design-discussion skill templates contain the byte-identical Plan Mode Guard (with documented `<lane>`/`<skill-name>` substitution).
- [ ] All installed copies (`.claude/`, `.agents/`) of each design-discussion skill contain the byte-identical block.
- [ ] No `templates/skills/<name>/SKILL.md` contains `# Plan Mode Protocol`.
- [ ] `templates/skills/weave-{explore,architect,prd}/SKILL.md` no longer contain the redundant "Setting local artifact context ... is allowed" sentences in their bodies.
- [ ] `templates/skills/weave-clarify/SKILL.md` body Resolve Context section calls `weave artifact current set <target> --json` after change resolution.
- [ ] `tests/agent-skills.test.ts` byte-identity and non-presence assertions are aligned with the new constant.
- [ ] `npm run typecheck` passes; `npm test` passes.
- [ ] `wiki/knowledge/domains/change-workflow/domain-wide/plan-mode-guard.md` documents the corrected behavior; `plan-mode-protocol.md` is removed.
- [ ] `weave change knowledge updated` recorded with the renamed knowledge file.

### Verification

- Automated tests: `npm test -- agent-skills`
- Typecheck: `npm run typecheck`
- Manual/smoke check: invoke `/weave-prd` in Plan Mode; confirm the LLM commits the active lane via `weave artifact current set prd --json` after change resolution (no deferred-mutation directive). Invoke the same skill in Agent Mode; confirm it refuses with the guard's stop message.

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
| QF1 | fixed | high | user | T6, T12 | Plan Mode Guard and the newly-added Plan Mode Protocol collide in design-discussion skills |

## QF1: Plan Mode Guard and Plan Mode Protocol collide

Status: accepted

Severity: high

Source: user

Related Task: T6 (introduced the protocol), T12 (remediation)

### Observed behavior

Across the four design-discussion skills (`weave-explore`, `weave-architect`, `weave-prd`, `weave-clarify`):

- `weave-explore` and `weave-architect` already carry a `# Plan Mode Guard` section at the top that requires Plan Mode and rejects non-Plan-Mode entry. `weave-prd` and `weave-clarify` do not carry the guard at all.
- The skill bodies (where present) call `weave artifact current set <lane> --json` as part of the discovery step, with an accompanying rationale sentence stating "Setting local artifact context ... is allowed because it updates local session state, not repo-tracked change artifacts."
- T6 added a `# Plan Mode Protocol` section at the bottom of every design-discussion skill instructing the agent NOT to call `weave artifact current set <lane>` while in Plan Mode and instead defer it until Agent Mode (Phase 2).

The Protocol's "Do NOT attempt ... in plan mode" directive directly contradicts the body's "do this in discovery" instruction and the body's "allowed in plan mode" rationale. The Protocol's Phase 2 ("invoked directly in Agent Mode" branch) also contradicts the Guard's "stop immediately if not in Plan Mode" rule on `weave-explore` and `weave-architect`. The Guard is missing entirely from `weave-prd` and `weave-clarify`, undermining the cross-agent consistency promise.

### Expected behavior

Design-discussion skills MUST refuse non-Plan-Mode entry. When run in Plan Mode they MUST commit the active artifact lane to local Weave session state via `weave artifact current set <lane> --json`. Local session state writes are not repo-tracked artifact writes and are allowed in Plan Mode.

### Reproduction

Read `templates/skills/weave-explore/SKILL.md`: line 13 (Guard), line 36 (body set call), line 41 ("allowed" rationale), line 348 (Protocol's "Do NOT attempt"). All four blocks are simultaneously present and contradict each other.

### Artifact impact

- All 4 design-discussion skill templates (`templates/skills/weave-{explore,architect,prd,clarify}/SKILL.md`) and their installed copies.
- `src/lib/skill-template-checks.ts` (`EXPECTED_PLAN_MODE_PROTOCOL` constant).
- `tests/agent-skills.test.ts` (byte-identity assertions on the protocol; non-presence assertions).
- `wiki/knowledge/domains/change-workflow/domain-wide/plan-mode-protocol.md` (knowledge doc).

### Related tasks

T6 introduced the bad design; T12 implements the corrected unified Plan Mode Guard.

## Refactors

Refactor Status Legend:

- `proposed`: identified but not yet accepted
- `accepted`: agreed to do as part of this change
- `deferred`: logged for later; no `T#` yet
- `done`: completed and verified behavior-preserving
- `out_of_scope`: real but not part of this change
- `invalid`: no longer applies after source context changed

| ID | Status | Scope | Related Tasks | Summary |
| --- | --- | --- | --- | --- |

None.

## Invalid Tasks

None.

## Verification

Not run yet.
