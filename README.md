# Weave-It

Weave-It is a TypeScript CLI package. The npm package is `weave-it` and the CLI binary is `weave`.

## What Is Weave?

Weave is an SDLC tool for AI-assisted software teams. It is designed to work with agents and coding tools like Claude, Codex, OpenCode, and similar systems.

The goal is to give AI tools durable project context across the full software lifecycle:

- Product discovery and requirements
- Engineering planning and implementation
- Cross-repo code exploration
- QA notes, validation, and handoff
- Long-lived product and technical knowledge

Each repo can contain a committed `wiki/` folder that acts like an LLM-friendly wiki for that repo. Weave also maintains committed metadata in `.weave/` and a temporary local session so agents can understand which folders/repos should be considered together for the current task.

## Installation

Install the CLI globally from npm:

```bash
npm install -g weave-it
```

Then verify it works:

```bash
weave --help
```

## Requirements

- Node.js `>=22.12`
- npm

If you use `nvm`:

```bash
nvm use 22
```

## Setup

Install dependencies from the project root:

```bash
npm install
```

## Development Commands

Run the CLI from source:

```bash
npm run dev -- <command>
```

Examples:

```bash
npm run dev -- --help
npm run dev -- init --help
npm run dev -- init --yes
npm run dev -- workspace --json
```

Typecheck:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

Recommended verification before opening a PR:

```bash
npm run typecheck
npm test
npm run build
```

## Test The CLI As `weave`

The package exposes this binary in `package.json`:

```json
"bin": {
  "weave": "./dist/cli.js"
}
```

To test the installed command shape locally:

```bash
npm run build
npm link
```

Then run:

```bash
weave --help
weave init --yes
weave workspace
```

After code changes, run `npm run build` again so the linked command uses the latest compiled output.

To remove the local global link:

```bash
npm unlink -g weave-it
```

## Supported CLI Commands

## `weave init`

Initializes Weave in repo mode or workspace mode and starts a new temporary session.

- Repo mode is the default. Use it when you want Weave to code/reference only the current repo or folder.
- Workspace mode is for multi-repo or multi-folder work. It creates a workspace with the shared `wiki/` and `.weave/` metadata.
- When workspace mode runs inside an existing git repo, Weave creates the workspace beside that repo, moves the repo into the workspace, adds the repo directory to the workspace `.gitignore`, and registers it in `.weave/workspace.yml`.
- After workspace-mode init, open the created workspace path in your editor.

V1 workspace mode only creates the workspace and adopts the current repo when detected. Arbitrary attach, clone, migration, skill rewrites, and workspace-aware change commands are deferred.

```bash
weave init [options]
```

Options:

```text
--id <id>                  folder id
--kind <kind>              folder kind, defaults to app
--mode <mode>              init mode: repo or workspace; defaults to repo with --yes
--workspace-name <name>    workspace name for workspace mode
--workspace-path <path>    workspace path for workspace mode outside a git repo
--yes                      accept defaults and skip prompts
-h, --help                 display help for command
```

Examples:

```bash
weave init --id weave-it --kind package --yes
weave init --mode repo --yes
weave init --mode workspace --workspace-name peoplebox-platform
weave init --mode workspace --workspace-name peoplebox-platform --workspace-path ../peoplebox-platform
```

From source:

```bash
npm run dev -- init --id weave-it --kind package --yes
npm run dev -- init --mode workspace --workspace-name peoplebox-platform
```

## `weave add <path>`

Adds another folder to the current Weave session.

```bash
weave add [options] <path>
```

Arguments:

```text
path           folder path to add
```

Options:

```text
--id <id>      folder id
--kind <kind>  folder kind, defaults to app
-h, --help     display help for command
```

Example:

```bash
weave add ../backend --id backend --kind api
```

From source:

```bash
npm run dev -- add ../backend --id backend --kind api
```

## `weave workspace`

Shows the current Weave session folders.

```bash
weave workspace [options]
```

Options:

```text
--json      print machine-readable JSON
-h, --help  display help for command
```

Examples:

```bash
weave workspace
weave workspace --json
```

From source:

```bash
npm run dev -- workspace
npm run dev -- workspace --json
```

## `weave change`

Creates, inspects, switches, and propagates durable change exploration folders under `wiki/changes/`.

```bash
weave change new "<title>" [options]
weave change list [target|all] [options]
weave change current [target|all] [options]
weave change status [change] [options]
weave change progress <lane> [options]
weave change clear-stale <lane> [options]
weave change switch <change> [options]
weave change propagate <change-id> --to <target...> [options]
```

`weave change new` creates a change id in the form `{YYMMDD}-{XXXX}-{slug}`, writes `status.yml` and `exploration.md`, creates or checks out the matching git branch, and records the new change as current in the local Weave session:

```text
change/{change-id}
```

Active change state is local workspace/session state. It is stored outside the repo so it does not appear in commits or pull requests.

Options for `new`:

```text
--type <type>          change type: feat, fix, refactor, docs, test, ci, or chore; defaults to feat
--slug <slug>          change slug override
--target <target...>   target folder path or current session folder id
--json                 print machine-readable JSON
```

Options for `propagate`:

```text
--from <target>        source folder path or current session folder id
--to <target...>       target folder path or current session folder id
--json                 print machine-readable JSON
```

Options for `list`, `current`, `status`, and `switch`:

```text
target                 folder path, current session folder id, or all
--target <target>      target for status; accepts folder path, session folder id, or all
--json                 print machine-readable JSON
```

Options for `progress`:

```text
lane                  exploration, prd, architecture, or issues
--target <target>     target folder path or current session folder id
--source <source>     repeatable source dependency: exploration, prd, architecture, discussion, sessions, or codebase
--no-invalidate       suppress all downstream stale propagation for this call
--invalidate <list>   mark only this comma-separated subset of dependent lanes stale (e.g. issues,architecture)
--json                print machine-readable JSON
```

Options for `clear-stale`:

```text
lane                  exploration, prd, architecture, or issues
--target <target>     target folder path or current session folder id
--reason <reason>     one-sentence verification rationale recorded in stale_history
--json                print machine-readable JSON
```

Examples:

```bash
weave change new "Analytics of reviews"
weave change new "Fix review import" --type fix --slug review-import --target app api
weave change list
weave change list all
weave change current
weave change status
weave change progress prd --source exploration --source sessions --json
weave change status 260522-f3q9-review-analytics --target app
weave change switch f3q9
weave change propagate 260522-f3q9-review-analytics --from app --to api
```

From source:

```bash
npm run dev -- change new "Analytics of reviews"
```

`weave change list` is a clean index and marks the active change with `*`. `weave change current` shows the active change and can recover missing session state from a matching `change/{id}` branch. `weave change status` reports metadata and branch alignment. `weave change switch` is the explicit way to move to another existing change.

`weave change progress <lane>` records lifecycle progress for the active change. `stage` is orientation for the furthest progressed lane; it does not prove skipped upstream artifacts were created. `artifacts` records the source graph used for stale invalidation:

```yaml
stage: architecture
artifacts:
  prd:
    sources:
      - exploration
      - sessions
    updated_at: "2026-05-31T04:00:00.000Z"
  architecture:
    sources:
      - prd
      - codebase
    updated_at: "2026-05-31T04:05:00.000Z"
```

Pass each source with repeatable `--source` flags. Source lists are replaced on each progress call for that lane.

`stale` records source-aware dependents that should be refreshed after a source lane changes:

```yaml
stage: issues
stale:
  architecture:
    invalidated_by: prd
    invalidated_at: "2026-05-31T04:06:16.000Z"
```

Weave-managed artifact-writing skills call `progress` after successful live artifact writes. Existing changes without `artifacts` or `stale` continue to work and are treated as having no recorded dependencies or stale lanes.

Default propagation marks every transitive downstream lane stale. Skills following the **Lifecycle Staleness Verification Protocol** (embedded in `weave-prd`, `weave-architect`, `weave-clarify`, `weave-issues`, and `weave-capture`) first read the dependent artifacts and decide per-lane whether the upstream change actually invalidates them:

```bash
# default: every downstream lane goes stale
weave change progress prd --source exploration --json

# narrow clarification, no dependent invalidated
weave change progress prd --source exploration --no-invalidate --json

# only `issues` is invalidated, not `architecture`
weave change progress prd --source exploration --invalidate=issues --json
```

If a previously-stale lane is now in content sync (verified by reading both artifacts), clear the flag with an audit-trail entry:

```bash
weave change clear-stale architecture --reason "Wording typo in prd; architecture references unchanged" --json
```

Each clear appends a record to `status.yml.stale_history` with `lane`, `invalidated_by`, `invalidated_at`, `cleared_at`, and `reason`. Never hand-edit `status.yml` to change stale state; use the CLI.

If a target is not a git repo, Weave still writes the change artifacts and reports branch creation as skipped. `switch` and `propagate` block when affected git repos have uncommitted changes; `new` does not block so already-started local work can be captured as a new change.

## `weave status`

Shows the installed weave-it package version, the bundled skill versions, and any notices for the current repo.

```bash
weave status [options]
```

Options:

```text
--json      print machine-readable JSON
-h, --help  display help for command
```

`weave status` is the explicit, detailed view of:

- the installed `weave-it` npm package version,
- the latest cached `weave-it` version from the npm registry (refreshed at most once every 24h),
- every installed skill, the package version it was installed from, the current bundled package version, and a per-skill state (`current`, `outdated`, `modified`, `missing`),
- the same `notices` array that Tier 1 commands return in `--json` mode.

Use it whenever a notice points you here:

```bash
weave status
weave status --json
```

## Notices

The five Tier 1 commands surface a stable `notices` array in their `--json` output and, in interactive TTY mode, print a one-line stderr footer that tells the user there are notices and to run `weave status`:

```text
weave workspace
weave change current
weave change status
weave change new
weave status
```

Notice kinds:

```text
package_outdated   a newer weave-it npm version is cached locally
skills_modified    one or more installed SKILL.md files differ from the manifest hash
skills_outdated    one or more installed skills were installed from an older weave-it version than the current bundled skills
```

Notices are computed in parallel with the command's normal work; missing network, an unwritable `~/.weave/cache`, or a stripped-down npm registry response all degrade gracefully to an empty array.

Suppress notices everywhere with either:

```bash
NO_UPDATE_NOTIFIER=1 weave change current
WEAVE_NO_NOTICES=1 weave change current
```

Non-Tier-1 commands (`agent install`, `agent update`, `change list`, `change progress`, etc.) never include a `notices` field.

## Skill Versioning

Every bundled `SKILL.md` template carries a `last_changed_in` frontmatter field recording the `weave-it` package version of the last substantive change to that skill:

```yaml
---
name: weave-prd
description: Generate or revise prd.md ...
last_changed_in: 0.1.0
---
```

When a skill is installed, the version is stamped into `.weave/agents.yml` as `installed_from`. The `skills_outdated` notice fires when the bundled version is newer than the recorded `installed_from`. Run `weave agent update <agent>` to bring untouched skills up to date, or `weave agent reset <agent> <skill>` to overwrite a locally-modified copy.

Maintainers bump `last_changed_in` for every skill that changed since the previous git tag with:

```bash
npm run release:bump-skills
```

The script reads `package.json`'s `version`, diffs each `templates/skills/<name>/SKILL.md` against the most recent reachable git tag, and only updates skills with real changes. It never commits or tags on its own.

## Plan Mode Protocol (design-discussion skills)

`weave-explore`, `weave-prd`, `weave-architect`, and `weave-clarify` ship with an embedded **Plan Mode Protocol** because every supported agent harness (Claude, Cursor, Codex, opencode) blocks filesystem writes in plan mode / ask mode. The protocol defers `weave artifact current set <lane>` until the user accepts the plan and the harness allows mutations:

- In plan/ask mode the skill declares `Lane: <lane>` at the top of the plan output and ends with `On plan acceptance, the first action will be: weave artifact current set <lane> --json`.
- The first agent-mode action after acceptance runs the deferred `weave artifact current set <lane> --json` call before continuing the skill's discovery and work.

The protocol text is enforced byte-identically across all four skills by a test against the canonical constant in `src/lib/skill-template-checks.ts`.

## `weave agent`

Installs and manages Weave Agent Skills for supported coding agents.

```bash
weave agent <install|update|diff|reset> <agent> [skill]
```

Agents:

```text
codex      install Agent Skills to .agents/skills
cursor     install Agent Skills to .agents/skills
claude     install Agent Skills to .claude/skills
opencode   install Agent Skills to .agents/skills and slash commands to .opencode/commands
all        install every supported integration
```

Examples:

```bash
weave agent install opencode
weave agent update opencode
weave agent diff opencode weave-explore
weave agent reset opencode weave-explore
```

`install` and `update` protect user edits. They update files only when the current file still matches the last Weave-installed hash in `.weave/agents.yml`. If a user edits an installed skill or command wrapper, Weave skips it. `reset` is the explicit overwrite path.

## Using Weave Skills

Weave ships Agent Skills for change discovery, requirements, implementation planning, and change workflow scaffolding. Each skill starts by running `weave workspace --json` and uses `wiki/knowledge/**` plus `wiki/changes/**` as durable context.

Skills:

```text
weave-new        start a new change exploration from a title or topic
weave-capture    capture the current discussion into an artifact or session-only note
weave-explore    stress-test product requirements and PRD readiness
weave-prd        generate or revise a PRD from the active exploration
weave-architect  generate or revise engineering architecture from the active PRD
weave-next       answer what to do next for the active change
weave-clarify    clarify an existing exploration, PRD, or architecture artifact
weave-issues     create or reconcile local tasks.md implementation tasks (T#), QA findings (QF#), and refactors (R#)
weave-knowledge  update current-state knowledge specs for an active change
weave-propagate  copy an existing change exploration to another repo
```

Every bundled skill carries a `# Surface Weave Notices` section telling the agent to forward any non-empty `notices` array from Tier 1 commands to the user verbatim, near the top of its response. The notice-surfacing block is byte-identical across all skills.

Install them for one agent:

```bash
weave agent install claude
weave agent install cursor
weave agent install codex
weave agent install opencode
```

Or install every supported integration:

```bash
weave agent install all
```

Install targets:

```text
claude     .claude/skills/<skill>/SKILL.md
cursor     .agents/skills/<skill>/SKILL.md
codex      .agents/skills/<skill>/SKILL.md
opencode   .agents/skills/<skill>/SKILL.md
opencode   .opencode/commands/<skill>.md
```

### Claude Code

Install:

```bash
weave agent install claude
```

Then start Claude Code in the repo and ask:

```text
/weave-new "Analytics of reviews"
/weave-capture
/weave-capture session
/weave-capture session prd
/weave-explore "Analytics of reviews"
/weave-prd
/weave-architect
/weave-next
/weave-clarify prd
/weave-issues "Create local tasks.md from the active PRD"
/weave-knowledge
/weave-propagate 260522-f3q9-review-analytics to api
```

### Cursor

Install:

```bash
weave agent install cursor
```

Then ask Cursor Agent from the repo:

```text
/weave-new "Analytics of reviews"
/weave-capture
/weave-capture session
/weave-capture session prd
/weave-explore "Analytics of reviews"
/weave-prd
/weave-architect
/weave-next
/weave-clarify prd
/weave-issues "Create local tasks.md from the active PRD"
/weave-knowledge
/weave-propagate 260522-f3q9-review-analytics to api
```

### Codex

Install:

```bash
weave agent install codex
```

Then ask Codex from the repo:

```text
$weave-new "Analytics of reviews"
$weave-capture
$weave-capture session
$weave-capture session prd
$weave-explore "Analytics of reviews"
$weave-prd
$weave-architect
$weave-next
$weave-clarify prd
$weave-issues "Create local tasks.md from the active PRD"
$weave-knowledge
$weave-propagate 260522-f3q9-review-analytics to api
```

### opencode

Install:

```bash
weave agent install opencode
```

Then invoke the slash command in opencode:

```text
/weave-new "Analytics of reviews"
/weave-capture
/weave-capture session
/weave-capture session prd
/weave-explore "Analytics of reviews"
/weave-prd
/weave-architect
/weave-next
/weave-clarify prd
/weave-issues "Create local tasks.md from the active PRD"
/weave-knowledge
/weave-propagate 260522-f3q9-review-analytics to api
```

Or invoke the skill naturally:

```text
Use the weave-explore skill for Analytics of reviews.
Use the weave-capture skill to capture this session without updating artifacts.
Use the weave-prd skill to generate the PRD.
Use the weave-architect skill to generate the engineering design.
Use the weave-next skill to decide what to run next.
Use the weave-clarify skill to revise the active PRD after scope changes.
Use the weave-knowledge skill to update current-state knowledge after the change.
```

Bare `weave-capture` writes a structured session note, promotes pending lane session context, and merges durable content into the current live artifact. If the live artifact is missing, bare capture considers all matching lane session notes; if the artifact exists, it considers matching session notes newer than the artifact `updated_at` timestamp. `weave-capture session` writes only a lane-aware session note using the current artifact context, and `weave-capture session prd` or another explicit lane stores the note under that lane without updating live artifacts. Downstream skills keep using live artifacts as canonical context in v1; they do not scan pending session notes before running.

`weave-next` is read-only and advisory. It summarizes the active change, artifact state, current artifact context, and recent resume notes, then recommends the next Weave skill without writing artifacts or invoking the recommendation automatically.

`weave-clarify` is for refining an existing change artifact when scope, requirements, assumptions, or decisions change midstream. It updates one selected artifact at a time, such as `exploration.md`, `prd.md`, or `architecture.md`, and reports follow-up artifacts that should be clarified separately. Use `weave-prd` and `weave-architect` for initial generation; use `weave-clarify` when an existing artifact needs a focused amendment.

`weave-knowledge` updates current-state behavioral specs under `wiki/knowledge/**` and writes change-local provenance to `wiki/changes/<change-id>/knowledge-delta.md`. It creates missing standard knowledge files when needed, but does not silently reorganize user-authored knowledge.

Knowledge freshness is tracked through the CLI-owned lifecycle command:

```bash
weave change knowledge pending --reason "Knowledge impact not resolved yet"
weave change knowledge updated --domain performance-reviews --shared approvals --file wiki/knowledge/domains/performance-reviews/domain-wide/approvals.md --delta wiki/changes/<change-id>/knowledge-delta.md --reason "Updated current approval behavior"
weave change knowledge none --delta wiki/changes/<change-id>/knowledge-delta.md --reason "No durable behavior impact"
weave change knowledge stale --invalidated-by prd --reason "PRD changed after knowledge was updated"
```

`weave change knowledge <status>` supports `pending`, `stale`, `updated`, and `none`, plus repeatable `--domain`, `--shared`, and `--file` flags and optional `--delta`, `--reason`, `--invalidated-by`, `--target`, and `--json`.

The standard knowledge structure is scaffolded progressively:

```text
wiki/knowledge/
  index.md
  README.md
  domains/
    README.md
    <domain>/
      index.md
      features/<feature>/behavior.md
      domain-wide/
      source-map.md
  shared/
    README.md
    <shared-behavior>/behavior.md
```

V1 provides scaffold/docs guidance and skill contract tests for this structure. It does not add a CLI validation command for knowledge folders.

Claude Code, Cursor, and opencode use slash commands such as `/weave-explore`, `/weave-prd`, `/weave-architect`, `/weave-next`, `/weave-clarify`, and `/weave-knowledge`. Codex uses `$weave-explore`, `$weave-prd`, `$weave-architect`, `$weave-next`, `$weave-clarify`, and `$weave-knowledge` to explicitly invoke installed skills. opencode gets small slash-command wrappers that delegate to the portable skills in `.agents/skills`; Weave does not install `.opencode/skills` by default.

## `weave skills` and `weave skill`

Lists and prints bundled Weave skills.

```bash
weave skills list
weave skill show weave-new
weave skill show weave-explore
weave skill show weave-prd
weave skill show weave-architect
weave skill show weave-next
weave skill show weave-clarify
weave skill show weave-issues
weave skill show weave-knowledge
```

## Project Structure

```text
src/
  cli.ts
  commands/
    add.ts
    agent.ts
    change.ts
    init.ts
    skills.ts
    workspace.ts
  lib/
    add-folder.ts
    agent-skills.ts
    changes.ts
    files.ts
    folders.ts
    git.ts
    ids.ts
    init-workspace.ts
    session-state.ts
    show-workspace.ts
    sync.ts
    weave-scaffold.ts
templates/
  opencode/
    commands/
  skills/
tests/
  agent-skills.test.ts
  cli-skills.test.ts
  changes.test.ts
  init.test.ts
.weave/
  agents.yml
  sync.yml
wiki/
  knowledge/
  changes/
weave-it/
  implementation-plan.md
  opencode-skills-implementation-plan.md
  skills-implementation-plan.md
  weave-init-v1.md
```

## Contribution Notes

- Keep changes small and focused.
- Add or update tests for behavior changes.
- Do not commit `node_modules/`, `dist/`, coverage output, or local machine state.
- Source files use ESM imports with `.js` specifiers because TypeScript is configured with `NodeNext` module resolution.
- Use `apply_patch` or normal editor changes for source edits, then run typecheck, tests, and build.

## Releasing

Releases are cut manually by a maintainer with npm publish access and push access to the repo. Each release is a single `npm version` bump that also stamps skill versions, followed by a push and publish.

1. Ensure the working tree is clean and all prep is committed.
2. Choose the bump level and create the version commit and tag in one step. The committed `.npmrc` (`tag-version-prefix=""`) produces bare-number tags such as `1.0.0`, not `v1.0.0`:

```bash
npm version <patch|minor|major> --message "release: %s"
```

   This bumps `version` in `package.json`, runs the `version` lifecycle hook (which stamps `last_changed_in` on every skill changed since the previous tag and stages `templates/skills`), creates one commit `release: <version>`, and creates the matching bare git tag.

3. Push the commit and the tag:

```bash
git push --follow-tags
```

4. Publish to npm. The `prepublishOnly` hook runs typecheck, tests, and build before anything is uploaded, so a failing gate aborts the publish:

```bash
npm publish
```

5. Verify the release:

```bash
npm view weave-it
npm install -g weave-it && weave --help
```

6. Optionally refresh this clone's own installed skill copies so local dogfooding matches what shipped:

```bash
weave agent update --all
```

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for the full text.
