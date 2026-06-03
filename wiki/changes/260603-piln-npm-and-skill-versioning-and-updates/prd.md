---
artifact: prd
status: draft
owner: product
created_at: 2026-06-03T12:59:00.000Z
updated_at: 2026-06-03T14:50:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Npm And Skill Versioning And Updates PRD

## Problem Statement

`weave-it` will be published to npm. Once it is, two independent staleness conditions become possible for any given user, and today neither is visible:

- **Package staleness.** A user installed `weave-it@0.1.0` globally weeks ago. A newer version exists on npm. The user has no way to find out from the tool itself.
- **Skill staleness.** A user installed agent skills into a repo via `weave agent install <agent>` weeks ago. Since then the bundled `templates/skills/**` in their globally installed package have moved on (either because the user upgraded the package, or because a future package upgrade moves them). Their `.claude/skills/`, `.agents/skills/`, and `.opencode/commands/` files are now behind. Today no surface in the tool tells them this. The agent silently continues to use stale prompts.

The problem hurts two audiences differently:

- **Human developers** running `weave` directly miss new features, regressions get fixed but the fixes never reach their installs, and they have no easy way to compare what they have to what the current package ships.
- **AI agents** that invoke `weave` programmatically (Claude Code, Cursor, Codex, opencode) run against the user's stale skill prompts, producing degraded behavior that the user blames on the agent rather than on a stale tool.

The user explicitly distinguished these two layers and asked that *both* be reported. Calling them both "version" creates ambiguity that the PRD must resolve.

## Goals

- Detect and report when a newer `weave-it` is available on the npm registry.
- Detect and report when the skills installed in a Weave repo differ from the skills bundled in the currently installed package.
- Establish a single, terse notification shape that works in both a human terminal and an AI-agent context without corrupting machine-readable output.
- Establish a single read-only command (`weave status`) that gives the full picture and the exact remediation commands to run.
- Introduce per-skill version metadata that travels with the package and can anchor a useful sentence to the user ("this skill last changed in 0.3.0; you installed it from 0.1.0").
- Make staleness reachable from inside an AI agent's chat without requiring the user to ever drop to a terminal.

## Non-Goals

- Automatically upgrading the global `weave-it` package on the user's behalf (no programmatic `npm i -g`).
- Independent semver per skill or any per-skill release pipeline separate from the package.
- Three-way merge of a locally modified skill against an upstream update.
- Pre-release or beta dist-tag tracking in v1 (e.g., notifying about `@next` or `@beta`).
- A new per-skill remediation command surface; reuse the existing `weave agent install`/`update`/`reset`/`diff`.
- Telemetry or analytics about install/update events.
- A general "what's new" / changelog viewer inside the CLI. Release notes live in the repo and on npm.

## Actors

- **Developer (human).** Installs `weave-it` globally, runs `weave` directly in their terminal, runs `weave agent install <agent>` per repo. Primary recipient of the stderr footer and `weave status`.
- **AI agent.** Claude Code, Cursor, Codex, or opencode. Invokes `weave workspace --json`, `weave change current --json`, and other commands as part of running skills. Primary recipient of structured `notices` in `--json` output. Surfaces notices to the developer through chat.
- **Release engineer / maintainer.** Cuts a new `weave-it` release. Owns the release script that bumps `last_changed_in` in changed `SKILL.md` files. Not addressed in the runtime UX; addressed in `Rollout Considerations`.
- **CI environment.** Any non-TTY execution context (CI runs, scripts, programmatic callers). Should never see the stderr footer; should still receive `notices` in `--json` output if a command opts into it.

## Current Behavior

- The package version lives in `package.json` (`weave-it@0.1.0`). The published tarball includes `dist` and `templates`, so the skill prompts ship inside the package.
- Each bundled `SKILL.md` has only `name` and `description` in its frontmatter (e.g., `templates/skills/weave-explore/SKILL.md` lines 1-4). No version field exists.
- When the user runs `weave agent install <agent>` or `weave agent update <agent>`, the CLI hashes each bundled `SKILL.md`, writes the file to the target directory, and records `path`, `source_hash`, `installed_hash`, and `installed_at` per skill in `.weave/agents.yml`. The same flow runs for opencode command wrappers.
- If the user has hand-edited an installed skill file, `installArtifact`/`updateArtifact` detect the hash mismatch and skip the file with status `modified`. The user is told the file was skipped but not why their edit matters going forward.
- `weave agent diff <agent> <skill>` shows the diff between the installed file and the bundled current default. `weave agent reset <agent> <skill>` overwrites the installed file with the bundled default.
- Nothing checks npm. Nothing tells the user a newer package exists. Nothing flags that an installed skill is behind the bundled one. There is no `weave status` command. `--json` output across commands has no shared `notices` field.

## Proposed Product Behavior

The tool gains four cooperating surfaces:

- **A new `last_changed_in: <package-version>` frontmatter field** on every bundled `SKILL.md`, maintained by a release script.
- **A passive stderr footer** on a small, named set of entry-point commands (the **Tier 1** set) that reports staleness (newer package on npm, stale repo skills, locally modified skills, brand-new skills) when relevant. Always terse. Always points to `weave status`.
- **A stable additive top-level `notices` array** on every Tier 1 command's `--json` output, carrying the same information as a structured payload. Non-Tier-1 commands do not gain the field; their `--json` shape is unchanged.
- **A new read-only `weave status` command** that prints the full picture and the exact remediation commands per skill.

The **Tier 1** set is exactly five commands, chosen so that both the human's normal Weave-discovery moments and every shipped skill's discovery commands carry notices without requiring a universal change to every command:

- `weave workspace`
- `weave change current`
- `weave change status`
- `weave change new`
- `weave status`

Every shipped skill's discovery phase already invokes at least one of `weave workspace --json` and `weave change current --json`, so the AI-agent surfacing path is preserved without changing every command. The human anchor moment (`weave change new`) is also in Tier 1.

The package itself never invokes `npm i -g`. Notices are inform-only. The user (or their agent) decides what to act on.

Each shipped `SKILL.md` is updated with boilerplate that reads notices during its (Tier 1) discovery phase and surfaces them to the human via the agent. This makes staleness reachable from inside Claude, Cursor, Codex, or opencode chats without the developer ever opening a terminal.

## User Workflows

### Workflow: Developer Upgrades Global Package, Walks Into A Repo

1. Developer runs `npm i -g weave-it@latest`. The global binary moves from `0.1.0` to `0.3.0`.
2. Developer changes directory into an existing Weave repo where they previously ran `weave agent install claude`.
3. Developer runs any `weave` command (e.g., `weave change new "Something"`).
4. The CLI silently performs Check B (local skill drift) using `.weave/agents.yml` against the bundled `templates/skills/**` of the now-installed `0.3.0`.
5. The CLI also asynchronously triggers Check A (newer package on npm). Because the developer just upgraded, Check A reports no gap.
6. After the command's normal output, a one-block footer is written to **stderr** summarizing skill staleness for this repo:

    ```text
    Notice: 5 skills are outdated in this repo.
      weave-explore: bundled 0.3.0, you installed 0.1.0
      weave-prd: bundled 0.3.0, you installed 0.1.0
      ...
    Run "weave status" for details and remediation commands.
    ```
7. Developer runs `weave status`. They see the same skill list grouped by agent, the suggested `weave agent update claude` command, and any new skills introduced since their install.
8. Developer runs `weave agent update claude` (or `weave agent update all`). All unmodified skills are rewritten from the bundled `0.3.0` templates. The next `weave status` reports no skill drift.

### Workflow: Developer Works Through An AI Agent

1. Developer is inside Claude Code (or Cursor / Codex / opencode) and invokes `/weave-explore "Some topic"`.
2. The skill's discovery phase runs `weave workspace --json` and `weave change current --json` (both Tier 1) as it does today.
3. The CLI runs the same Check A and Check B silently. Because the command was called with `--json`, the stderr footer is suppressed.
4. The `--json` response contains a top-level `notices` array with structured staleness entries (see Functional Requirements). This array is present because the discovery command is a Tier 1 command; future skills authored against non-Tier-1 discovery commands would not receive the field and must be authored to call at least one Tier 1 command during discovery.
5. The `SKILL.md` boilerplate reads `notices` and surfaces a short summary to the developer in chat, before continuing with the skill's normal behavior.

    > _Heads up: 3 Weave skills in this repo are outdated. Run `weave status` for details._
6. Developer can ignore the heads-up and continue the skill, or interrupt and run `weave status` / `weave agent update` themselves.

### Workflow: Developer Has Locally Modified A Skill And A Newer Version Exists

1. Developer previously hand-edited `.claude/skills/weave-prd/SKILL.md` to add a project-specific rule. The hash in `.weave/agents.yml` no longer matches the installed file (existing `modified` state).
2. Developer upgrades the global package. `weave-prd` moves from `last_changed_in: 0.1.0` to `last_changed_in: 0.3.0`.
3. On their next `weave` invocation, the footer surfaces:

    ```text
    Notice: 1 skill is locally modified AND outdated.
      weave-prd: bundled 0.3.0, you installed 0.1.0, locally modified
    Run "weave status" for details and remediation commands.
    ```
4. `weave status` shows two remediation options for this skill:

    - Review upstream changes: `weave agent diff claude weave-prd`
    - Discard local edits and adopt the new bundled version: `weave agent reset claude weave-prd`
5. Developer chooses. `weave agent update claude` continues to skip the file (status quo). The CLI does not attempt to merge.

### Workflow: Developer Outside Any Weave Repo

1. Developer runs `weave --help` or `weave status` in a folder with no `.weave/`.
2. Check B does not fire (nothing to compare).
3. Check A runs. If a newer package is available, the footer says:

    ```text
    Notice: weave-it 0.4.0 is available (you have 0.3.0).
    Run "npm i -g weave-it@latest" to upgrade.
    ```
4. `weave status` reports installed package version + latest known package version, plus `Not a Weave repo. Run "weave init" to set up Weave here.`

### Workflow: Brand-New Skill Appears In A Release

1. A future release adds `weave-foobar` to the bundled templates with `last_changed_in: 0.4.0`.
2. Developer upgrades the package and walks into a repo that has Weave skills installed for the `claude` agent.
3. Footer surfaces a `skills_new` notice:

    ```text
    Notice: 1 new skill is available in weave-it 0.4.0.
      weave-foobar (introduced in 0.4.0)
    Run "weave status" for details and remediation commands.
    ```
4. `weave status` lists the new skill under a "New skills available" section and suggests `weave agent install claude` to pick it up.
5. Developer runs `weave agent install claude`. The existing install flow creates the new skill file without touching existing skills.

### Workflow: Developer Drives A Design-Discussion Skill From Plan Mode

1. Developer is inside Cursor Plan Mode (or Claude's plan flow, etc.) and invokes `/weave-architect` against an active Weave change at the `architecture` lane.
2. The skill produces its architectural plan in Plan Mode. The plan output begins with `Lane: architecture` and ends with `On plan acceptance, the first action will be: weave artifact current set architecture --json`. The skill does **not** attempt to set artifact context inside Plan Mode.
3. Developer reviews and accepts the plan. The agent re-enters Agent Mode.
4. The agent's first tool call is `weave artifact current set architecture --json`. The local Weave session state now correctly reflects `architecture` as the current artifact context.
5. The agent then proceeds with the rest of the plan (writing `architecture.md`, running `weave change progress architecture`, etc.).
6. Developer later invokes `/weave-capture` (bare). `weave-capture` reads the stored artifact context (`architecture`), the substance of the conversation matches, and the capture lands cleanly without disambiguation.

### Workflow: Developer Invokes `/weave-capture` Immediately After A Plan-Mode Skill

1. Developer accepts the `/weave-architect` plan and immediately invokes `/weave-capture` before the agent has run any agent-mode action (for example, the developer typed `/weave-capture` as the first message after accepting the plan).
2. Stored artifact context is still whatever it was before the design-discussion skill ran (for example, `prd` from a prior `/weave-prd`).
3. `weave-capture` detects that the stored context disagrees with the substance of the conversation since the last capture and asks the developer which lane to use, presenting both the stored option and the substance-derived option.
4. Developer picks `architecture`. `weave-capture` proceeds with that lane and updates the artifact correctly.

### Workflow: Release Engineer Cuts A Release

1. Engineer prepares a release candidate on a branch.
2. A release script diffs `templates/skills/**` against the previously published git tag. For each `SKILL.md` whose content changed, the script bumps `last_changed_in` in that file's frontmatter to the new package version.
3. Engineer reviews the diff, lands it, and publishes the package.
4. Developers on the next `weave` invocation see Check A surface the new version. After they upgrade, Check B surfaces per-skill version pairs.

(Architecture defines *how* the release script discovers the previous tag and runs in CI. The PRD only requires that the field move correctly.)

## User Stories

1. As a **developer**, I want to be told when a newer `weave-it` is on npm, so that I can upgrade without manually polling the registry.
2. As a **developer**, I want to be told when the Weave skills in my repo are behind the bundled ones in my installed `weave-it`, so that my AI agents are not running stale prompts.
3. As a **developer**, I want a single command (`weave status`) that shows the full picture and tells me exactly what to run to fix each gap, so that I do not have to memorize remediation commands.
4. As a **developer**, I want skill staleness reported per agent (claude, cursor, codex, opencode), so that I can update only the agents I actually use in this repo.
5. As a **developer** who hand-edited a skill, I want to be told both that the skill is locally modified *and* that a newer version exists upstream, so that I can decide whether to discard my edit or merge upstream changes manually.
6. As a **developer**, I want notices to suggest concrete commands without ever silently running `npm i -g` for me, so that I retain control over my global install.
7. As a **developer using an AI agent**, I want stale-skill warnings to reach me in the agent chat (not buried in stderr the agent ignores), so that I learn about staleness in the same surface I am already working in.
8. As an **AI agent**, I want structured `notices` in every `--json` response, so that I can surface staleness consistently across all skills without scraping stderr.
9. As a **developer in CI** (or running with `--json`), I want the stderr footer suppressed so my build logs stay clean, while still being able to see notices in `--json` when I opt into it.
10. As a **developer in an offline environment**, I want the CLI to never block or print errors because the npm registry is unreachable; local skill-drift detection should still work normally.
11. As a **developer**, I want notices to be terse and predictable, so that I learn the shape once and can scan them quickly.
12. As a **release engineer**, I want a release-time script to bump `last_changed_in` on changed skills, so that I do not depend on contributors remembering to bump it in every PR.
13. As a **developer**, I want notices about brand-new skills to be distinct from notices about outdated skills, so that I can choose to install new skills rather than update existing ones.
14. As a **developer**, I want a way to permanently opt out of npm-version checks (env var), so that I am never surprised by network calls.
15. As a **developer driving design-discussion skills from a plan-capable agent** (Cursor Plan Mode, Claude's plan flow, etc.), I want the artifact context for the lane I am designing against to be reliably set on plan acceptance, so that follow-up skills like `/weave-capture` land in the correct artifact lane without making me disambiguate.
16. As a **developer using `/weave-capture`** immediately after a plan-mode design skill, I want `weave-capture` to detect when stored artifact context disagrees with the conversation substance and ask me which lane to use, so that the wrong artifact is never silently updated.
17. As a **maintainer authoring or editing skills**, I want the Plan Mode Protocol text, the `# Surface Weave Notices` boilerplate, and the Lifecycle Staleness Verification Protocol text to live in a single canonical source and be byte-identity-checked across all four agent destinations, so that the four agents never silently drift from one another.
18. As a **developer who just clarified one artifact** and folded the implications into the dependent artifact in the same session, I do NOT want `weave change status` to keep reporting a stale flag on the dependent, because the artifacts are already in content sync. I expect the agent to recognise this and suppress the false-positive stale flag.
19. As a **developer**, I want the default lifecycle progress behavior to remain conservative (fire stale flags on all dependents) so that my workflow is never silently letting artifacts drift out of sync. False positives are acceptable noise; false negatives would be a correctness regression.
20. As a **developer who reviewed a stale flag and confirmed the dependent is actually in sync** (manually, after the fact), I want an explicit `weave change clear-stale <lane>` command that records who/when/why I cleared it, so the audit trail is honest about the fact that staleness was reviewed and dismissed rather than silently ignored.
21. As an **AI agent invoking any skill that calls `weave change progress`**, I want a uniform verification protocol that I follow before progressing, plus CLI levers (`--no-invalidate`, `--invalidate=<list>`) that let my content-sync judgement actually overrule the pessimistic default, so that I do not pollute the user's workflow with stale flags that I know are false positives.

## Functional Requirements

### Skill Version Metadata

- Every bundled `templates/skills/<name>/SKILL.md` should include `last_changed_in: <package-version>` in its YAML frontmatter alongside `name` and `description`.
- `last_changed_in` should reflect the package version in which that skill's content last meaningfully changed.
- The release process should bump `last_changed_in` automatically by diffing `templates/skills/**` against the previously published version.
- Contributors should not be required to maintain `last_changed_in` by hand.
- The package's existing `.weave/agents.yml` per-skill entry should additionally record the `last_changed_in` value that was read from the bundled `SKILL.md` at install time.

### Footer (Stderr)

- The CLI should write a single-block notice footer to **stderr only** at the end of any **Tier 1** `weave` invocation when at least one notice applies. Non-Tier-1 commands do not emit a footer.
- The footer should be suppressed when any of these are true:
  - The invoked command was called with `--json`.
  - `stdout` is not a TTY.
  - The `CI` environment variable is set.
  - The opt-out environment variable is set (exact name decided in architecture).
- When the user is inside a Weave repo (a `.weave/` exists at the workspace root), the footer should surface local skill-drift notices first, then npm package notices.
- When the user is not in a Weave repo, the footer should only surface npm package notices.
- The footer should never duplicate within the same process invocation (one footer per command).
- The footer should always end with: `Run "weave status" for details and remediation commands.`
- The footer should never print remediation commands inline (other than the `weave status` pointer above) and should never print diffs.

Tier 1 commands that may emit a footer (subject to the suppression rules above):

- `weave workspace`
- `weave change current`
- `weave change status`
- `weave change new`
- `weave status`

Future commands may join Tier 1 via an explicit decision; the addition is a stable-contract change documented in `Revision History`.

When multiple notices apply, they should render in a single footer block separated by blank lines, ordered:

1. `skill_modified` (warning)
2. `skills_outdated` (info)
3. `skills_new` (info)
4. `package_outdated` (info)

This puts the most actionable warning first while keeping the package upgrade prompt at the bottom where it does not crowd skill remediation.

The notice-message templates should be exactly as follows. `<placeholders>` are filled at runtime; bracketed conditional clauses appear only when applicable.

`package_outdated`:

```text
Notice: weave-it <latest> is available (you have <installed>).
Run "weave status" for details and remediation commands.
```

`skills_outdated`:

```text
Notice: <N> Weave skill(s) in this repo are outdated.
  <skill>: bundled <X>, you installed <Y>
  ...
Run "weave status" for details and remediation commands.
```

`skill_modified` (covers both modified-only and modified+stale via the conditional bundled clause):

```text
Notice: <N> Weave skill(s) are locally modified.
  <skill>: bundled <X>, you installed <Y>, locally modified
  ...
Run "weave status" for details and remediation commands.
```

`skills_new`:

```text
Notice: <N> new Weave skill(s) available in <X>.
  <skill> (introduced in <X>)
  ...
Run "weave status" for details and remediation commands.
```

### `--json` Notices Contract

- Every **Tier 1** command's `--json` output should include a stable top-level `notices` array. The Tier 1 set is the same five commands listed under `Footer (Stderr)`.
- Non-Tier-1 commands (for example `weave agent install`, `weave agent update`, `weave agent reset`, `weave agent diff`, `weave init`, `weave add`, `weave artifact current`, `weave skill`, `weave skills`) do **not** include a `notices` field. Their `--json` shape is unchanged by this feature.
- For Tier 1 commands, each notice entry should include:
  - `kind` — one of `package_outdated`, `skills_outdated`, `skill_modified`, `skills_new`.
  - `severity` — one of `info` or `warning` (warning reserved for `skill_modified` and combined modified+stale cases).
  - `message` — a short single-line string suitable for surfacing to a human.
  - `payload` — structured per-kind detail (see below).
- For Tier 1 commands, the `notices` array should always be present (possibly empty) on every `--json` response. Adding new fields is allowed; removing or renaming fields is a breaking change. Adding a Tier 1 command (introducing the field on a command that previously lacked it) is an additive change documented in `Revision History`. Removing a command from Tier 1 (dropping the field from a command that previously had it) is a breaking change.
- Notices should never appear inside stdout that is not `--json`.
- The shipped skill boilerplate that consumes `notices` always runs against a Tier 1 discovery command (`weave workspace --json` and/or `weave change current --json`), so every shipped skill receives the field by construction. New skills should call at least one Tier 1 command during discovery; using a non-Tier-1 command means the skill will not receive notices and should be documented as such.

Per-kind payload shape:

- `package_outdated`: `{ installed: "0.1.0", latest: "0.3.0", upgrade_command: "npm i -g weave-it@latest" }`
- `skills_outdated`: `{ agent: "claude", skills: [{ name: "weave-explore", installed_from: "0.1.0", bundled_from: "0.3.0" }, ...], suggested_command: "weave agent update claude" }`
- `skill_modified`: `{ agent: "claude", skill: "weave-prd", installed_from: "0.1.0", bundled_from: "0.3.0" | null, suggested_commands: ["weave agent diff claude weave-prd", "weave agent reset claude weave-prd"] }`
- `skills_new`: `{ agent: "claude", skills: [{ name: "weave-foobar", introduced_in: "0.4.0" }, ...], suggested_command: "weave agent install claude" }`

### `weave status` Command

- A new top-level command `weave status` should exist.
- `weave status` should be **read-only**: it should never write to `.weave/agents.yml`, never write skill files, and never invoke `npm`.
- `weave status` output should include:
  - Installed package version.
  - Latest known package version (from cache or live check; clearly indicate when the value is cached or unknown).
  - For each installed agent: a per-skill table of installed-from version, bundled version, and per-skill state (`current`, `stale`, `modified`, `modified + stale`).
  - A "New skills available" section listing bundled skills not present in any installed agent's skill set, with the version each was introduced in.
  - A "Suggested commands" section that lists the exact remediation commands the user can copy and run.
- `weave status` should support `--json` and emit a stable structured representation of the above plus the `notices` array.
- `weave status` outside a Weave repo should print the package-version pair and `Not a Weave repo. Run "weave init" to set up Weave here.`
- `weave status` with no installed skills should print `No agents have Weave skills installed in this repo. Run "weave agent install <agent>" to get started.`

Flags:

- `--target <target>` — folder path, session folder id, or `all`. Matches the shape of `weave change status --target`.
- `--agent <name>` — limit output to one agent (`claude`, `cursor`, `codex`, or `opencode`).
- `--json` — emit the stable structured representation including the `notices` array.

Human-readable layout (default, in-repo, with skill drift):

```text
weave-it 0.1.0 (latest: 0.3.0 - newer available)

Folder: weave-it (/Users/arpit/personal/weave-it)

  claude
    Skill            Installed   Bundled   State
    weave-explore    0.1.0       0.3.0     stale
    weave-prd        0.1.0       0.3.0     modified + stale
    weave-knowledge  0.2.0       0.2.0     current

  opencode
    Skill            Installed   Bundled   State
    weave-explore    0.1.0       0.3.0     stale
    weave-prd        0.1.0       0.3.0     stale

  New skills available
    weave-foobar (introduced in 0.4.0)

Suggested commands:
  npm i -g weave-it@latest                  upgrade global package
  weave agent update claude                 refresh 1 outdated skill for claude
  weave agent update opencode               refresh 2 outdated skills for opencode
  weave agent diff claude weave-prd         review upstream changes to modified skill
  weave agent reset claude weave-prd        discard local edits and adopt bundled version
  weave agent install claude                install 1 new skill into claude
```

Out-of-repo variant:

```text
weave-it 0.3.0 (up to date)

Not a Weave repo. Run "weave init" to set up Weave here.
```

Repo without installed skills:

```text
weave-it 0.3.0 (up to date)

Folder: weave-it (/Users/arpit/personal/weave-it)

No agents have Weave skills installed in this repo.
Run "weave agent install <agent>" to get started.
```

Output style:

- No colors in v1; output stays consistent with the rest of the CLI.
- Plain ASCII tables; column widths auto-fit to the longest value per column.
- When `weave add` has introduced multiple folders, each folder gets its own `Folder:` block in the order returned by `weave workspace`.

### `weave agent install` / `update` / `reset` / `diff`

- `weave agent install <agent>` and `weave agent update <agent>` should additionally report per-skill `installed_from`/`bundled_from` pairs in their per-skill status output (human and `--json`).
- These commands are **not** Tier 1 and do **not** include a top-level `notices` array in their `--json` output. (Superseded from the initial draft, which carried a universal `notices` claim. See `Revision History`.) Users surface notices via Tier 1 commands such as `weave status` or `weave workspace`.
- `weave agent update` should continue to skip `modified` files (status quo).
- `weave agent reset <agent> <skill>` should continue to overwrite the installed file with the bundled default (status quo) and should bring the skill's `installed_from` to match `bundled_from`.

### Skill Boilerplate

- Every shipped `SKILL.md` should contain a dedicated `# Surface Weave Notices` section that reads `notices` from the `--json` discovery output the skill already runs and surfaces each entry to the user.
- Placement: the section sits immediately after the first discovery block (the one that runs `weave workspace --json`) and before the skill's domain-specific workflow. For skills that include `# Plan Mode Guard`, the order is `Plan Mode Guard` -> discovery -> `Surface Weave Notices` -> skill-specific workflow. For the four design-discussion skills that also include the Plan Mode Protocol (`weave-explore`, `weave-prd`, `weave-architect`, `weave-clarify`), the order is `Plan Mode Guard` -> `Plan Mode Protocol` -> discovery -> `Surface Weave Notices` -> skill-specific workflow. The discovery block in these four skills no longer includes the `weave artifact current set <lane> --json` line; that command is moved into the Plan Mode Protocol's post-acceptance directive.
- The exact section text is identical across all skills (DRY) and is:

  ```md
  ---

  # Surface Weave Notices

  The discovery commands above return a `notices` field in their JSON output. Before continuing with the skill's normal behavior, scan that array. For each entry, surface a single-line heads-up to the user using this exact format:

  > Heads up: <notice.message>. Run `weave status` for details.

  If `notices` is empty, skip this step. Do not block the skill's work on notices.

  ---
  ```

- The boilerplate is owned by the skill templates in `templates/skills/<name>/SKILL.md`. The release script that bumps `last_changed_in` does not rewrite the boilerplate. Architecture decides whether a lint check enforces presence of the section across all bundled skills.

### Network And Cache Behavior

- The npm version check should be performed asynchronously with a cached previous result. The check should never block the user-facing command's response.
- If the cache is fresh, the CLI should use the cached value and not contact npm.
- If the cache is stale and npm is unreachable, the CLI should fall back to the cached value (or omit the `package_outdated` notice entirely if no cached value exists) and should not print errors.
- The very first `weave` invocation after a fresh install (no cache present) should not block waiting for the npm response. If the response arrives before the command exits, the notice surfaces; otherwise the cache is populated for the next call and the notice surfaces then.
- The exact cache TTL, cache file location, and transport are architecture decisions.

### Design-Skill Artifact Context Protocol

The notice-surfacing system above assumes that design-discussion skills produce reliable lane state for the change they are designing against. Today they do not, because every supported agent (claude, cursor, codex, opencode) categorically blocks filesystem-write tool calls in plan, ask, and read-only modes, and the existing skill instruction to set local artifact context inside those modes is unenforceable. The result is that a design-discussion skill (`weave-explore`, `weave-prd`, `weave-architect`, or `weave-clarify`) run in plan mode leaves the stored artifact context stale, which silently lands follow-up skills (notably `weave-capture`) in the wrong artifact lane. This is treated as a **co-requirement** of the notice-surfacing system because the two share the same byte-identity-shared-text enforcement pattern, the same skill-template propagation path, and the same `last_changed_in` rollout story.

The design-discussion skills (`weave-explore`, `weave-prd`, `weave-architect`, `weave-clarify`) should set the artifact context for the lane they design against, regardless of the host agent's mode. The mechanism is a two-phase protocol:

- **In Plan Mode (or any mode that blocks filesystem-write tool calls, including ask mode and read-only mode):**
  - Do NOT attempt `weave artifact current set <lane>` (the call will be refused by the host harness regardless of the skill's intent).
  - Declare the target lane explicitly in the plan output at the top: `Lane: <lane>`.
  - Include a clear, machine-parseable directive at the end of the plan output: `On plan acceptance, the first action will be: weave artifact current set <lane> --json`.

- **On plan acceptance (Agent Mode resumes):**
  - The FIRST tool call MUST be `weave artifact current set <lane> --json`, before any other action.
  - The skill's normal post-acceptance work proceeds from there.

- **Affected skills:** `weave-explore` (`exploration` lane), `weave-prd` (`prd` lane), `weave-architect` (`architecture` lane), `weave-clarify` (lane the user names). Other Weave skills do not set artifact context and are not affected.

- **Companion defensive behavior in `weave-capture`:** when the stored artifact context disagrees with the substance of the conversation since the last capture (for example, stored = `prd` but the just-completed skill was `weave-architect`), `weave-capture` should detect the mismatch and ask the user which lane to use rather than silently using stored context. An explicit lane argument (`weave-capture <lane>` or `weave-capture session <lane>`) should always bypass this check.

- **Enforcement:** the in-skill protocol text is owned by `templates/skills/<name>/SKILL.md`. The shipped file across all four agent destinations (`.claude/`, `.cursor/`, `.opencode/`, `.codex/` or whichever each agent installs into) should contain byte-identical protocol text, enforced by a CI test that compares against a shared canonical constant. This is the same byte-identity-shared-text mechanism used for the `# Surface Weave Notices` boilerplate.

- **User-visible behavior changes:**
  - In agent mode: unchanged. The skill still sets context as part of its discovery step.
  - In plan / ask / read-only mode: the plan output now declares the lane explicitly and includes the post-acceptance directive. The deferred mutation runs on plan acceptance.

- **What this fixes:** after invoking and accepting any design-discussion skill's plan, `weave artifact current --json` returns the correct lane, regardless of host agent mode. Follow-up skills (especially `weave-capture`) land in the correct artifact lane without needing to ask the user to disambiguate.

### Lifecycle Staleness Verification Protocol

The lifecycle progress system (`weave change progress <lane>`) marks downstream lanes as stale whenever an upstream lane progresses, based purely on the `sources` declaration. Today this propagation is **pessimistic and content-blind**: it fires whenever a structural dependency exists, regardless of whether the progressed update actually invalidated the dependent's content. In practice this produces frequent false-positive stale flags — for example, a PRD typo fix that does not affect architecture still marks architecture stale; a PRD clarification whose decisions have already been folded into architecture still marks architecture stale immediately after the architecture lane catches up.

The natural-language semantics of `sources` (per the skill text: "sources that informed the clarified artifact") describe **causal influence** — what discussion, sessions, or other artifacts informed this update — and not strict-DAG structural dependency. The two interpretations coexist in the same field: agents and humans reasonably list any lane that informed an update (including downstream lanes whose discussion drove the change), but the CLI uses the list as a structural-dependency graph for staleness propagation. This conflation is the root cause of the false-positive stale flag pattern.

The fix is treated as a **third co-requirement** of the notice-surfacing system, alongside the Plan Mode Protocol. It uses the same byte-identity-shared-text enforcement pattern, the same skill-template propagation path, and the same `last_changed_in` rollout vehicle. The fix has three layers:

#### 1. Skill verification protocol (byte-identical across affected skills)

Before any skill calls `weave change progress <lane>`, it should:

1. **Read the artifact being progressed** and identify its current dependents (any lane that lists this lane as a source). Dependent lanes are discoverable via `weave change status --json`.
2. **Read each dependent artifact** to understand what content it has today.
3. **Make a content-sync judgement** for each dependent: does the dependent's content correctly reflect the new state of the progressed lane? The LLM uses semantic comparison; this is judgement, not a string diff.
4. **Choose the progress call accordingly:**
   - All dependents in sync → progress with `--no-invalidate` (no stale flags fire).
   - Specific dependents out of sync → progress with `--invalidate=<lane>,<lane>` (only the named lanes are marked stale).
   - Unsure or judgement ambiguous → default behavior (full pessimism, conservative; stale flags fire on all dependents).

When uncertain, the conservative default is correct: a false positive (stale flag fires when content is in sync) is annoying noise; a false negative (stale flag suppressed when content actually drifted) is a silent correctness bug. Prefer the noise.

#### 2. CLI levers (the smallest set the protocol needs)

- `weave change progress <lane> --no-invalidate` — progresses the lane (updates timestamp, sources) but skips the downstream staleness propagation step entirely. Equivalent to "I have verified that no dependent is invalidated by this update."
- `weave change progress <lane> --invalidate=<lane>,<lane>` — progresses the lane and marks only the named dependents stale, instead of all structural dependents. The named lanes must be among the lane's actual structural dependents (those that list it as a source); naming an unrelated lane is an error.
- `weave change clear-stale <lane> [--reason "<text>"]` — explicitly clear a stale flag on `<lane>` without re-progressing the lane. Persists a small audit entry in `status.yml` (`stale_history` or similar) recording who cleared it, when, and with what reason. Intended for after-the-fact false-positive resolution when content review confirms sync.
- These levers are additive; existing `weave change progress <lane> --source ...` behavior is unchanged when `--no-invalidate` and `--invalidate` are not passed.

#### 3. Companion skill-text clarification

The affected skills' `--source` guidance gains a single sentence to remove the conflation:

> `--source` reflects what informed this update (causal influence). The CLI uses sources for pessimistic staleness propagation; the Lifecycle Staleness Verification Protocol above is how you tell the CLI when a dependent is actually in sync despite the source declaration.

#### Affected skills

The verification protocol applies to every skill that calls `weave change progress`: `weave-explore`, `weave-prd`, `weave-architect`, `weave-clarify`, `weave-capture`. Other skills (e.g., `weave-next`, `weave-knowledge`, `weave-issues`, `weave-new`, `weave-propagate`) that do not call progress are unaffected.

#### Enforcement

The verification protocol text is owned by `templates/skills/<name>/SKILL.md`. The shipped file across all four agent destinations should contain byte-identical protocol text, enforced by a CI test that compares against a shared canonical constant. This is the third use of the byte-identity-shared-text mechanism (after the `# Surface Weave Notices` boilerplate and the Plan Mode Protocol).

The new CLI levers (`--no-invalidate`, `--invalidate`, `clear-stale`) have unit tests asserting:

- `--no-invalidate` suppresses staleness propagation on dependents.
- `--invalidate=<lane>` marks only the named lanes stale and errors clearly when a non-dependent lane is named.
- `clear-stale` removes the flag and records the audit entry; it is a no-op when the flag is already absent.
- `--no-invalidate` and `--invalidate` are mutually exclusive on the same call.

#### User-visible behavior changes

- The pessimistic default behavior is unchanged. A user running `weave change progress prd` with no additional flags sees the same behavior as today (full downstream staleness propagation).
- Skills that adopt the verification protocol may now silently suppress false-positive stale flags by using `--no-invalidate`. The user does not see the stale flag they would have seen previously, because the agent verified content sync.
- A user who wants to force the conservative default can pass `--invalidate=<lane>,<lane>` explicitly, or simply omit `--no-invalidate`.
- `weave change clear-stale <lane>` is a new explicit command for the recovery case; users do not need to invoke it directly when using a skill that follows the protocol.

#### What this fixes

The two failure modes that motivated this co-requirement:

- **False-positive stale propagation on benign updates.** A typo fix or a clarification whose content has already been folded into dependents no longer fires a misleading stale flag.
- **Stale-loop after sequential clarifies.** The exact pattern hit on 2026-06-03: a PRD clarify followed by an architecture clarify followed by another PRD review would otherwise create a recurring stale flag every time one lane caught up to the other. With the verification protocol, the agent recognises the artifacts are in content sync and uses `--no-invalidate`.

#### What this explicitly does NOT change

- The `sources` field's semantics remain causal-influence ("what informed this update"). The protocol does not impose strict-DAG validation on which lanes may appear in `--source`. (See `Out of Scope`.)
- The pessimistic default behavior of `weave change progress` is unchanged for callers that do not use the new levers.
- The lifecycle model's `transitiveDependents` logic is unchanged; the new levers gate when it runs, not how it runs.

## Permissions And Access Control

This is a developer CLI and a single-user tool. There is no multi-tenant permission system.

Behavior-relevant access:

- The CLI should read `.weave/agents.yml`, `package.json`, and bundled `templates/skills/**` from the user's installed package. These are normal local file reads.
- The CLI should make outbound HTTPS calls to the npm registry for Check A. The user should be able to disable these by setting the opt-out environment variable. The CLI should never make any other outbound calls in this feature.
- The CLI should never require elevated privileges (`sudo`). The CLI should never write to the global package install directory.

## States And Lifecycle

Each per-repo, per-agent, per-skill installation is in exactly one of these states at any time:

- **`absent`** — the agent has been used elsewhere but this skill is not installed in this repo for this agent. Reachable for new skills appearing in a release.
- **`current`** — the installed file's content hash matches the bundled `SKILL.md` and `installed_from` equals `bundled_from`. No notice.
- **`stale`** — `installed_from` does not equal `bundled_from` and the installed file's hash matches what the bundle had at install time (no local edit). Surfaces as `skills_outdated`.
- **`modified`** — installed file's hash does not match `.weave/agents.yml`'s `installed_hash`. Surfaces as `skill_modified`. May or may not also be `stale`.
- **`modified + stale`** — both `modified` and `stale` hold. Surfaces as `skill_modified` with `bundled_from` populated and additional remediation hints.

State transitions:

- `absent -> current` by `weave agent install <agent>`.
- `current -> stale` by the user upgrading their global package, which moves `bundled_from` forward.
- `current -> modified` by the user hand-editing the installed file.
- `stale -> current` by `weave agent update <agent>`.
- `modified -> current` by `weave agent reset <agent> <skill>` (discards user edits) or by the user manually restoring the file to match the recorded `installed_hash`.
- `modified + stale -> current` by `weave agent reset <agent> <skill>` (discards user edits and adopts the new bundled version).
- `modified + stale -> stale` is not directly reachable through the CLI; the user would have to manually revert their local edits.

Invalid transitions:

- The CLI should never silently move a skill out of `modified` (existing safety).
- The CLI should never silently install a new skill into `absent` agents (new-skill installs require an explicit `weave agent install`).

## Notifications And Visibility

- **Footer (stderr).** Once per Tier 1 `weave` invocation, conditional on at least one notice applying and suppression rules not firing. Non-Tier-1 commands do not emit a footer.
- **`--json` notices array.** Always present (possibly empty) on every Tier 1 command's `--json` output. Non-Tier-1 commands do not include the field.
- **Skill boilerplate.** Every shipped `SKILL.md` surfaces a one-line summary to the human via the agent during its discovery phase. The boilerplate relies on the discovery command being Tier 1 (`weave workspace --json` and/or `weave change current --json`).
- **`weave status`.** The full picture on demand, with concrete remediation commands.
- **`weave agent install` / `update` output.** Per-skill version pairs in the per-file status output (human and `--json`). These commands are not Tier 1 and do not carry the `notices` array; users surface notices via Tier 1 commands such as `weave status` or `weave workspace`.

Visibility rules:

- A modified-only skill is always shown as a warning in the footer and in `weave status`, regardless of whether a newer version exists upstream.
- A stale-only skill is shown as `info` severity.
- A modified+stale skill is shown as `warning` severity and combined into a single notice (not two).
- Brand-new skills are shown only when at least one agent has Weave skills installed in this repo.
- When multiple notices apply in a single footer block, they render in this order: `skill_modified` (warning) -> `skills_outdated` (info) -> `skills_new` (info) -> `package_outdated` (info). The most actionable warning comes first; the package upgrade prompt comes last.

## Edge Cases

- **No `.weave/` in the current folder.** Only Check A fires. `weave status` says `Not a Weave repo.`.
- **`.weave/` exists but no skills installed for any agent.** Footer only fires for Check A. `weave status` says `No agents have Weave skills installed.`.
- **Multiple agents installed in the same repo.** Notices and `weave status` should report per-agent. Per-skill suggested commands should specify the agent.
- **npm registry unreachable.** Silent degradation. Check A omits `package_outdated` (or uses the cached value if recent). No error noise.
- **First-ever `weave` invocation after fresh install.** No cached npm value yet. The first invocation does not block on the npm response. If the response arrives before the command exits, the notice surfaces; otherwise the cache is populated for the next call and the notice surfaces then. This is the locked v1 behavior.
- **`weave --help` and `weave --version`.** Should still be fast and should still suppress the footer if `stdout` is non-TTY. With a TTY, the footer may surface after the help text but should not push the help text off-screen.
- **Verbose stdout commands (long `weave change status all`, etc.).** The stderr footer is always written after stdout has flushed. In v1, footer interleaving with verbose output is acceptable and not specially handled. Revisit only if users report it being lost in scrollback or interleaved confusingly.
- **User on a pre-release / beta dist-tag.** Out of scope for v1; the npm check should compare only against the `latest` dist-tag. A future enhancement may add `--include-prereleases` or a config.
- **`installed_from` is unknown** (because the install predates this feature). `weave status` should display `unknown` for that field and treat the skill as `stale` if the content hash differs from the bundled hash, `current` otherwise.
- **A skill is renamed or removed in a future release.** Out of scope for v1. The PRD assumes the set of skills only grows. A removed-skill notice kind can be added later if needed.
- **`weave agent install <agent>` after a brand-new skill is added.** The existing install flow creates the new skill file without disturbing other skills. No special handling needed.
- **Multi-folder Weave session (multiple `.weave/` via `weave add`).** Notices should report per-folder. `weave status` should accept `--target` to filter (matching the existing `weave change status --target` shape).
- **User has the latest package but stale skills in this repo.** Footer fires only for Check B. No npm notice.
- **`weave agent reset` brings a skill from `modified` to `current`.** `installed_from` should be updated to `bundled_from` so subsequent `weave status` runs no longer flag it.
- **Non-Tier-1 command called with `--json`.** Its output does not include a `notices` field, by design. `weave agent install --json`, `weave agent update --json`, `weave init --json`, `weave artifact current --json`, and similar non-Tier-1 commands keep their previous `--json` shape and are not extended by this feature.
- **Design-discussion skill invoked in Plan Mode.** The skill does not attempt to set artifact context inside Plan Mode. The plan output declares the lane and includes the post-acceptance directive. On plan acceptance, the agent's first action is `weave artifact current set <lane> --json`.
- **Design-discussion skill invoked in Agent Mode directly (no plan step).** The skill behaves as today and sets artifact context as the first agent-mode action during its discovery step. Behavior is unchanged from the current implementation.
- **`/weave-capture` invoked immediately after a plan-mode design skill, before any agent-mode tool calls.** Stored artifact context is still the prior value. `weave-capture` detects the mismatch between stored context and conversation substance and asks the user which lane to use. An explicit lane argument (`weave-capture <lane>` or `weave-capture session <lane>`) bypasses the check.
- **`/weave-capture` invoked after a host without Plan Mode.** Agents that lack a Plan Mode (or where the user never enters one) follow the agent-mode path; stored context is set during discovery and `weave-capture` proceeds without prompting.
- **An agent harness that allows local-state mutations in plan-like modes.** The skill's Plan Mode Protocol still applies: the skill declares the lane in plan output and runs the deferred `weave artifact current set` on plan acceptance. There is no benefit to the skill detecting harness leniency and attempting an in-plan-mode mutation; the protocol stays uniform across all four agents.
- **A non-design-discussion skill (e.g., `weave-issues`, `weave-knowledge`).** These skills do not set artifact context and are not affected by the Plan Mode Protocol. They continue to read context only.
- **Sequential clarifies that fold downstream — the pattern that motivated this change.** Developer clarifies PRD, then clarifies architecture in the same session to fold the PRD changes into architecture. With Fix B in place, the architecture clarify reads PRD + architecture, verifies content sync, and progresses with `--no-invalidate`. No stale flag fires on PRD. `weave change status` reports `stale: {}` after both progresses.
- **Benign upstream update with downstream untouched.** Developer fixes a typo in PRD. The agent verifies architecture content has not been invalidated by the typo fix, and progresses PRD with `--no-invalidate`. No stale flag fires on architecture.
- **Upstream update that genuinely invalidates one of several dependents.** Developer changes a PRD acceptance criterion that architecture references but issues does not. The agent uses `--invalidate=architecture` (selectively marks architecture stale, leaves issues alone). Issues is not flagged, architecture is.
- **Agent is unsure whether a dependent is invalidated.** The agent omits both `--no-invalidate` and `--invalidate` and lets the conservative default fire stale on every structural dependent. The user can review and use `weave change clear-stale <lane>` to dismiss any that they review as in-sync.
- **User wants to force pessimistic propagation explicitly.** The user passes `--invalidate=<all dependents>` or simply omits the new flags. Behavior matches today's pessimistic default.
- **`--no-invalidate` and `--invalidate` passed together.** The CLI rejects with a clear error. They are mutually exclusive: `--no-invalidate` means "no dependents" and `--invalidate` means "exactly these dependents."
- **`--invalidate` names a lane that is not a structural dependent of the progressed lane.** The CLI rejects with a clear error naming the actual structural dependents (so the user can correct the call). This catches typos and prevents silent misuse of the selective lever.
- **`weave change clear-stale <lane>` invoked when no stale flag is set on `<lane>`.** No-op (the flag is already absent). Exit code is 0; output is informational. `--json` returns `{ "status": "noop", "lane": "<lane>", "reason": "no stale flag set" }`.
- **`weave change clear-stale <lane>` invoked repeatedly on the same lane.** First call clears the flag and writes an audit entry. Subsequent calls are no-op (per the rule above). No duplicate audit entries are written for no-op invocations.
- **Agent attempts the verification protocol but cannot reliably judge content sync** (e.g., the dependent is large or the change is structural in a way the LLM cannot easily verify). The agent must default to full pessimism (omit `--no-invalidate` and `--invalidate`). False positives are acceptable; false negatives are not.
- **`--source` declaration that names a downstream lane.** Allowed (the `sources` field's semantics are causal influence, not strict DAG dependency). The CLI accepts the declaration without warning. The verification protocol is what prevents false-positive stale flags in this case; structural DAG validation on `--source` is explicitly out of scope.

## Acceptance Criteria

### Skill Version Metadata

- [ ] Every bundled `templates/skills/<name>/SKILL.md` has a `last_changed_in: <package-version>` field in its frontmatter.
- [ ] A release-time script (or equivalent) bumps `last_changed_in` automatically for skills whose content changed since the previous published version. Architecture defines the exact mechanism.
- [ ] `.weave/agents.yml` per-skill entries record the `last_changed_in` value read at install time alongside `source_hash`, `installed_hash`, and `installed_at`.

### `weave status`

- [ ] On a fresh install of `weave-it`, `weave status` works and produces output without errors.
- [ ] After a global package upgrade, `weave status` inside a repo reports per-agent skill drift with installed and bundled versions.
- [ ] When the user has hand-edited a skill, `weave status` reports it as `modified` and suggests `weave agent diff` and `weave agent reset` commands.
- [ ] When a brand-new skill is added in a release, `weave status` lists it under "New skills available" and the footer fires a `skills_new` notice that suggests `weave agent install <agent>`.
- [ ] `weave status` supports `--json` and emits a stable structured representation.
- [ ] `weave status` is read-only — it does not modify `.weave/agents.yml`, skill files, or invoke any package manager.

### Tier 1 Notices Surface

- [ ] After a global package upgrade, the stderr footer on any **Tier 1** `weave` invocation inside a Weave repo surfaces a `skills_outdated` notice that ends with `Run "weave status" for details and remediation commands.`.
- [ ] The stderr footer is emitted only by Tier 1 commands (`weave workspace`, `weave change current`, `weave change status`, `weave change new`, `weave status`). Non-Tier-1 commands never emit a footer.
- [ ] The stderr footer is suppressed when `--json` is set on the invoked command.
- [ ] The stderr footer is suppressed when `stdout` is non-TTY or `CI` is set.
- [ ] The stderr footer is suppressed when the opt-out env var is set.
- [ ] Every **Tier 1** command's `--json` output includes a top-level `notices` array (possibly empty) with the documented per-kind payload shape.
- [ ] Non-Tier-1 commands' `--json` output (e.g., `weave agent install --json`, `weave artifact current --json`) does **not** include a `notices` field. Their `--json` shape is unchanged by this feature.
- [ ] An automated test (or equivalent CI check) asserts both halves of the Tier 1 contract: every Tier 1 command includes `notices` in `--json`, and at least one representative non-Tier-1 command does not.

### `weave agent install` / `update` / `reset` / `diff`

- [ ] `weave agent install` and `weave agent update` per-skill status output includes installed-from / bundled-from version pairs in both human and `--json` output.
- [ ] Existing `weave agent update`, `reset`, and `diff` behavior is preserved unchanged for `current` and `modified` skills.

### Skill Boilerplate

- [ ] Every shipped `SKILL.md` contains the `# Surface Weave Notices` boilerplate that surfaces `notices` to the human via the agent during the skill's discovery phase.
- [ ] The boilerplate text is byte-identical across all bundled skills and across all four agent destinations (claude, cursor, codex, opencode), enforced by a CI test against a shared canonical constant.

### Design-Skill Artifact Context Protocol

- [ ] Each of `weave-explore`, `weave-prd`, `weave-architect`, and `weave-clarify` contains a byte-identical Plan Mode Protocol section in its `templates/skills/<name>/SKILL.md`, enforced by a CI test against a shared canonical constant.
- [ ] After invoking and accepting any of these four skills' plans from Plan Mode (Cursor, Claude plan flow, or equivalent), `weave artifact current --json` returns the lane the skill designed against.
- [ ] In Plan Mode, the skill's plan output declares the lane at the top and ends with the post-acceptance directive `On plan acceptance, the first action will be: weave artifact current set <lane> --json`.
- [ ] In Agent Mode (no Plan Mode involved), the skill's discovery step sets artifact context as it does today (behavior unchanged).
- [ ] When `/weave-capture` is invoked with stored artifact context that disagrees with the conversation substance, it asks the user to choose a lane rather than silently using stored context. An explicit lane argument bypasses this check.
- [ ] All four agent destinations (claude, cursor, codex, opencode) receive the protocol text identically when contributors edit only `templates/skills/<name>/SKILL.md` and run `weave agent update --all`.

### Network And Cache

- [ ] When the npm registry is unreachable, the CLI does not error, does not block, and uses the cached value or omits `package_outdated`.
- [ ] The CLI never invokes `npm i -g` (or equivalent) on the user's behalf.

### Lifecycle Staleness Verification Protocol

- [ ] Each of `weave-explore`, `weave-prd`, `weave-architect`, `weave-clarify`, `weave-capture` contains a byte-identical Lifecycle Staleness Verification Protocol section in its `templates/skills/<name>/SKILL.md`, enforced by a CI test against a shared canonical constant.
- [ ] `weave change progress <lane> --no-invalidate` progresses the lane without firing any stale flags on dependents. `weave change status` afterward reports `stale: {}` (assuming no prior stale flags) and the lane's `updated_at` is bumped.
- [ ] `weave change progress <lane> --invalidate=<dependent>,<dependent>` progresses the lane and marks only the named dependents stale. Lanes that are structural dependents but not named are NOT marked stale.
- [ ] `weave change progress <lane> --invalidate=<non-dependent>` errors clearly, naming the actual structural dependents of `<lane>`, and does not progress the lane.
- [ ] `weave change progress <lane> --no-invalidate --invalidate=<list>` errors clearly that the two flags are mutually exclusive, and does not progress the lane.
- [ ] `weave change clear-stale <lane>` clears the stale flag on `<lane>` and writes a small audit entry to `status.yml` recording the clearer (or "agent" if invoked via skill), the timestamp, and an optional `--reason "<text>"`.
- [ ] `weave change clear-stale <lane>` invoked when no stale flag is set on `<lane>` is a successful no-op (exit 0, informational message, no audit entry written).
- [ ] When a design-discussion or clarify skill is invoked in a flow that calls `weave change progress`, the agent follows the verification protocol: reads the artifact and its dependents, makes a content-sync judgement, and chooses the appropriate progress call. End-to-end manual verification per agent (Claude, Cursor, Codex, OpenCode) confirms that sequential clarifies on artifacts already in sync do NOT produce false-positive stale flags.
- [ ] The pessimistic default behavior of `weave change progress` is preserved when neither `--no-invalidate` nor `--invalidate` is passed. Existing callers that do not adopt the new flags see identical behavior to today.
- [ ] An automated test asserts the verification protocol byte-identity across all five affected skills AND across all installed agent destinations (`.claude/`, `.cursor/`, `.opencode/`, `.codex/` if present). The same test set that enforces `EXPECTED_NOTICE_BOILERPLATE` and `EXPECTED_PLAN_MODE_PROTOCOL` covers `EXPECTED_LIFECYCLE_SYNC_PROTOCOL`.

## Rollout Considerations

- **Migration baseline.** On the day this feature ships, all existing bundled skills should be pinned to the package version that introduces the field. No git-history backfill is attempted. This means every existing install will report `installed_from: unknown` for skills until the user re-installs or until the next install/update cycle stamps it.
- **Existing installs.** Users who already have skills installed in repos at the time of upgrade should not be silently broken. `weave status` should display `installed_from: unknown` for legacy entries and treat them as `current` unless the content hash differs from the bundled hash. The user can run `weave agent install <agent>` (idempotent for unmodified files) to stamp `installed_from`.
- **Default-on, opt-out.** The npm check is on by default. Users in restricted environments (or those who prefer offline operation) can set the opt-out env var.
- **No telemetry.** This feature does not introduce any analytics or telemetry. The npm registry call is read-only and contains no identifying payload beyond the standard request.
- **Communication.** The release notes for the version that introduces this feature should explain the new field, the new command, and the opt-out env var. The README should be updated to document `weave status` and the `notices` JSON contract.
- **Release cadence.** The release script that bumps `last_changed_in` runs in CI or as a release step. The maintainer should not be expected to bump it by hand.
- **Pre-release dist-tags.** Out of scope for v1. The npm check uses `latest` only. If users on `@next` or `@beta` are ever supported, they would see "you are ahead of `latest`" as info, not as a `package_outdated` warning. Architecture and a follow-up PRD decide that.

## Analytics And Success Metrics

This feature does not introduce telemetry. Success is qualitative for v1:

- A user upgrading their global package and walking into an old repo learns about stale skills on their next `weave` invocation, without surprise.
- An AI agent invoked through `/weave-explore` (or any other skill) surfaces a stale-skill heads-up to the developer in chat.
- No CI builds or `--json` consumers report broken output because of the footer.
- No user reports the CLI invoking `npm i -g` against their will.
- The number of repos visibly running on far-out-of-date skills decreases over time (anecdotal, observable through user support channels).

If telemetry is ever introduced (out of scope for v1), the natural signals would be: time between package release and per-user upgrade, rate of `modified` skills, and rate of `weave agent update` invocations following a footer notice.

## Revision History

- 2026-06-03: Initial PRD generated from `exploration.md`.
- 2026-06-03: Resolved all six open questions via `weave-clarify prd`. Locked: final notice-message templates per kind and multi-notice ordering (warning -> outdated -> new -> package); skill boilerplate text and placement (dedicated `# Surface Weave Notices` section after the first discovery block); `weave status` human-readable output layout with concrete examples for in-repo, out-of-repo, and no-skills variants; `weave status` flags (`--target`, `--agent`, `--json`); first-run grace (no blocking on first npm response); footer interleaving with verbose stdout (acceptable for v1).
- 2026-06-03: Scoped notice surface to Tier 1 commands via `weave-clarify prd`, driven by `architecture.md > Product Questions Raised by Technical Design`. Superseded the initial "every command's `--json` output should include a stable top-level `notices` array" and the implied "every `weave` invocation may emit a stderr footer" with the Tier 1 set of five commands: `weave workspace`, `weave change current`, `weave change status`, `weave change new`, `weave status`. Non-Tier-1 commands' `--json` shape is unchanged and they do not emit a footer. Updated `Proposed Product Behavior`, `Footer (Stderr)`, `--json Notices Contract`, `weave agent install / update / reset / diff` (removed the notices-array claim on these commands), `Notifications and Visibility`, `Acceptance Criteria`, `Edge Cases`, and `Out of Scope` accordingly. Added the explicit Tier 1 enumeration in three places (Proposed Product Behavior, Footer, --json Notices Contract) to keep the contract visible without cross-referencing.
- 2026-06-03: Added the **Design-Skill Artifact Context Protocol** as a co-requirement of the notice-surfacing system, captured in `sessions/20260603-194500-k7m2-architecture.md`. Locked the two-phase protocol: in Plan/ask/read-only modes, design-discussion skills declare the target lane in the plan output and include a post-acceptance directive; on plan acceptance, the FIRST tool call is `weave artifact current set <lane> --json`. Affected skills: `weave-explore`, `weave-prd`, `weave-architect`, `weave-clarify`. Added companion defensive behavior to `weave-capture` (detects stored-context vs conversation-substance mismatch and asks). Added new user stories #15-#17, two new workflows (plan-mode design skill + immediate capture), eight new edge cases, six new acceptance criteria, and two new out-of-scope entries. Resolved with the same byte-identity-shared-text enforcement pattern as the `# Surface Weave Notices` boilerplate; the two share the same `templates/skills/<name>/SKILL.md` source-of-truth path and the same `weave agent update --all` propagation.
- 2026-06-03: Added the **Lifecycle Staleness Verification Protocol** as a third co-requirement of the notice-surfacing system. Discovered during a workflow review when sequential PRD-then-architecture clarifies produced a recurring false-positive stale flag on PRD even after the artifacts were folded into content sync. Root cause analysis showed two distinct problems: (1) a wrong `--source` direction declaration on a clarify call, and (2) the lifecycle model's content-blind pessimistic staleness propagation that fires regardless of actual content sync. After explicitly weighing two fix candidates, only Fix B was scoped in: a verification protocol that the agent runs before any `weave change progress` call (reads the artifact and dependents, judges content sync semantically, chooses between `--no-invalidate` / `--invalidate=<list>` / default pessimism), plus three new CLI levers (`--no-invalidate`, `--invalidate`, `weave change clear-stale`), plus a companion skill-text clarification on `--source` semantics. **Fix A explicitly rejected** in this revision: a strict-DAG validation on `--source` was considered and rejected because the field's documented semantics are causal influence ("what informed this update"), not strict structural dependency; forcing a DAG constraint would conflict with the documented skill text and would not actually solve the false-positive problem (which exists even with correct-direction sources). The rejection is recorded in `Out of Scope` so it is not re-litigated. Added new user stories #18-#21, eleven new edge cases, ten new acceptance criteria under `Acceptance Criteria > Lifecycle Staleness Verification Protocol`, five new out-of-scope entries (strict DAG validation, content-aware CLI staleness, hash-based staleness, auto-clear, always-pessimistic global flag), and four new assumptions. Resolved with the same byte-identity-shared-text enforcement pattern as the existing two protocols; the three together share `src/lib/skill-template-checks.ts` for canonical text constants and the same CI test for byte-identity across all four agent destinations.

## Assumptions

- The release process can run a script that diffs `templates/skills/**` against the previously published git tag. Architecture has locked the discovery mechanism to `git describe --tags --abbrev=0`.
- An HTTPS GET against the npm registry is acceptable behavior for the npm package check. Architecture has locked the transport to Node 22's built-in `fetch` with a 3-second `AbortController` timeout.
- Users primarily install `weave-it` via npm globally (`npm i -g weave-it`). Other install patterns (per-repo `npx`, `pnpm dlx`, custom global package managers like volta) are uncommon and treated as edge cases; the `package_outdated` notice should still work because it depends on the installed binary's own `package.json` version, not on how it was installed.
- The four supported agents (claude, cursor, codex, opencode) continue to be the supported set in v1. New agent integrations would naturally flow through the same `notices`, `weave status`, and Plan Mode Protocol contract.
- The set of bundled skills only grows release over release. Skill removal/rename is not supported in v1.
- `installed_from` for legacy installs may be `unknown`; users can resolve it by running `weave agent install <agent>` which is idempotent for unmodified files.
- Every supported agent harness blocks filesystem-write tool calls in plan / ask / read-only modes uniformly. The Plan Mode Protocol does not need per-agent branching.
- A skill's discovery phase calls at least one Tier 1 command (`weave workspace --json` and/or `weave change current --json`). All currently shipped skills satisfy this; future skills are authored to maintain it.
- LLM agents running the affected skills can reliably perform semantic content-sync judgement between two related artifacts (PRD vs architecture, exploration vs PRD, etc.). The judgement is bounded — the artifacts are typically <1000 lines each and the LLM already has them in context. The conservative default (full pessimism) is the safety net when the LLM is unsure.
- `--no-invalidate` is a developer-trustable promise. Users who want absolute pessimism can omit the flag or explicitly use `--invalidate=<all dependents>`; the new levers are opt-in and the default behavior is unchanged.
- Audit entries written by `weave change clear-stale` are a useful trail for change-history review but are not load-bearing for any other automation. The CLI tolerates a missing or malformed audit field.

## Open Questions

None at this time. PRD-level open questions raised in earlier drafts have been resolved (see `Revision History`). Architecture has since locked the previously-deferred technical unknowns:

- Cache TTL: 24 hours.
- Cache file location: `~/.weave/cache/npm-version.json`.
- Opt-out env vars: `NO_UPDATE_NOTIFIER` (industry standard, disables the npm check only) and `WEAVE_NO_NOTICES` (Weave-specific, disables all notice output).
- npm version transport: direct HTTPS via Node 22's built-in `fetch` against `https://registry.npmjs.org/weave-it/latest` with a 3-second `AbortController` timeout.
- Cold-start performance budget: notice computation runs in parallel with the Tier 1 command's work and is local-file-only on the hot path. Architecture documents the profile-before-after expectation.
- Release script tag discovery: `git describe --tags --abbrev=0`.
- Skill boilerplate and Plan Mode Protocol presence checks: enforced by byte-identity CI tests against shared canonical constants in `src/lib/skill-template-checks.ts` (architecture-defined helper).

A small number of architecture-level open technical questions remain (release-script auto-commit, `--force-refresh` flag for `weave status`, exposing the notices builder as a stable internal API, a v1 `--debug` flag, missing-`last_changed_in` release-script behavior). These are tracked in `architecture.md > Open Technical Questions` and are not PRD-blocking.

## Out of Scope

- Independent per-skill semver and any per-skill release pipeline.
- Programmatic `npm i -g weave-it@latest` on behalf of the user.
- Three-way merge of a modified-and-stale skill against the upstream update.
- A general changelog viewer inside the CLI.
- Pre-release / beta dist-tag tracking (`@next`, `@beta`).
- Notifications about removed or renamed skills.
- Telemetry, analytics, or usage reporting.
- Notifications for skill versions per individual workspace folder in a multi-folder session at finer granularity than per-folder (already covered).
- Auto-installing new skills on `weave agent update`.
- Universal `notices` array on every command's `--json` output (superseded; see Tier 1 scoping in `Functional Requirements > --json Notices Contract` and `Revision History`).
- A universal stderr footer on every command (superseded; see Tier 1 scoping in `Functional Requirements > Footer (Stderr)` and `Revision History`).
- Detecting host-agent-mode (Plan / ask / Agent / read-only) from inside the skill in order to conditionally attempt the artifact-context mutation. The Plan Mode Protocol is uniform across all four agents and does not branch on detected mode.
- Auto-recovering stored artifact context for users who decline the Plan Mode Protocol's post-acceptance directive (i.e., skip the first action). `weave-capture`'s defensive check is the safety net; there is no auto-fix beyond that.
- **Strict DAG validation on `weave change progress --source <lane>`.** The CLI does NOT reject downstream-as-source declarations. The `sources` field's semantics are causal influence ("what informed this update"), not strict structural dependency. Imposing a strict-DAG constraint would conflict with the documented skill semantics and would not actually solve the false-positive stale-flag problem (which exists even with correct-direction sources). The Lifecycle Staleness Verification Protocol replaces this rejected validation approach. See `Revision History` (2026-06-03) for the rejection rationale.
- **Content-aware staleness detection inside the CLI** (e.g., the CLI computes diffs and only fires stale on "material" content change). Rejected because "material change" is a semantic judgement that the LLM agent makes naturally and the CLI cannot make generically. The verification protocol locates this judgement in the skill layer (where it belongs) rather than in the CLI.
- **Hash-based artifact tracking for staleness** (e.g., the CLI stores content hashes per artifact and only fires stale when hash changes). Rejected because (a) cosmetic changes like reformatting would still fire stale, and (b) substantive structural changes that don't actually invalidate dependents would still fire stale. Hashes are content-blind in the same way `transitiveDependents` is.
- **Auto-clear of stale flags after a successful re-progress.** The CLI does not silently dismiss stale flags as a side effect of any progress call. Explicit dismissal goes through `weave change clear-stale <lane>` and is audited.
- **Bypass of the verification protocol by user request** (e.g., a `--always-pessimistic` global flag). Not in v1; the existing pessimistic default IS the always-pessimistic behavior when the user omits the new flags.

## Further Notes

For Engineering: the `notices` contract is the most consequential additive surface in this PRD, scoped to the **Tier 1** set of five commands. Adding a command to Tier 1 is an additive change documented in `Revision History`; removing a command from Tier 1 (dropping the field from a command that previously had it) is a breaking change. The internal helper that builds `notices` once and reuses it across the Tier 1 commands and `weave status` is worth the up-front investment. Three byte-identity-shared text blocks across skill templates use the same enforcement mechanism: `EXPECTED_NOTICE_BOILERPLATE`, `EXPECTED_PLAN_MODE_PROTOCOL`, `EXPECTED_LIFECYCLE_SYNC_PROTOCOL`, all exported from `src/lib/skill-template-checks.ts` and asserted by a single test in `tests/agent-skills.test.ts`. Centralise both the constants and the test to keep the pattern uniform. The Lifecycle Staleness Verification Protocol's three CLI levers (`--no-invalidate`, `--invalidate=<list>`, `weave change clear-stale`) are small additions to `src/lib/changes.ts`; preserve the existing pessimistic default behavior exactly when no new flag is passed.

For QA: the modified-and-stale combination, the legacy `installed_from: unknown` case, and the multi-agent / multi-folder cases remain the highest-risk test surfaces. The Tier 1 contract should be verified both ways (Tier 1 commands include `notices`; non-Tier-1 commands do not). The Plan Mode Protocol should be verified across all four agents (claude, cursor, codex, opencode) end-to-end: invoke a design-discussion skill in Plan Mode, accept the plan, then verify `weave artifact current --json` returns the correct lane. `weave-capture`'s defensive lane-mismatch check should be verified in both directions (asks when mismatch, does not ask when stored matches substance or when an explicit lane is passed). The Lifecycle Staleness Verification Protocol should be verified end-to-end per agent by running the sequential-clarify pattern (PRD-then-architecture or architecture-then-PRD) on artifacts intentionally folded into content sync, and asserting that no stale flag remains after both progresses. Also verify the three CLI levers in isolation: `--no-invalidate` suppresses dependents, `--invalidate=<list>` marks only named lanes, `clear-stale` works including the no-op case and the audit-trail field. The CI-context suppression rules for the notice footer should be verified with `--json`, `CI=1`, and non-TTY independently.

For Support and Customer Success: when a user reports that their AI agent is "behaving oddly," ask them to run `weave status` first. Stale skills will frequently be the cause. The remediation command is in `weave status` output verbatim. If a user reports that `/weave-capture` landed in the wrong artifact lane, check whether they invoked a design-discussion skill in Plan Mode and whether the agent ran `weave artifact current set <lane>` as its first post-acceptance action; if not, the Plan Mode Protocol was bypassed and stored context is stale. If a user reports that `weave change status` keeps showing a stale flag they don't believe should be there, either (a) the agent's verification protocol made an incorrect content-sync judgement (false negative — user manually clears with `weave change clear-stale <lane>` after confirming sync), or (b) the agent legitimately could not judge and fell back to the pessimistic default (also resolved by `weave change clear-stale` after review). Either way, the explicit clear-stale path is the supported recovery.

For Documentation: README should add a `weave status` section, document the opt-out env vars (`NO_UPDATE_NOTIFIER`, `WEAVE_NO_NOTICES`), enumerate the Tier 1 set, document the Plan Mode Protocol expectation for skill authors, and document the Lifecycle Staleness Verification Protocol including the three CLI levers (`--no-invalidate`, `--invalidate`, `clear-stale`) and the explicit note that `--source` semantics are causal influence and not strict-DAG dependency. The notices contract should be documented for downstream `--json` consumers, including the explicit note that non-Tier-1 commands do not include the field.
