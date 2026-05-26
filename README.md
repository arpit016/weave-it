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

Initializes Weave in the current folder and starts a new temporary session from that folder.

```bash
weave init [options]
```

Options:

```text
--id <id>      folder id
--kind <kind>  folder kind, defaults to app
--yes          accept defaults and skip prompts
-h, --help     display help for command
```

Example:

```bash
weave init --id weave-it --kind package --yes
```

From source:

```bash
npm run dev -- init --id weave-it --kind package --yes
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

Examples:

```bash
weave change new "Analytics of reviews"
weave change new "Fix review import" --type fix --slug review-import --target app api
weave change list
weave change list all
weave change current
weave change status
weave change status 260522-f3q9-review-analytics --target app
weave change switch f3q9
weave change propagate 260522-f3q9-review-analytics --from app --to api
```

From source:

```bash
npm run dev -- change new "Analytics of reviews"
```

`weave change list` is a clean index and marks the active change with `*`. `weave change current` shows the active change and can recover missing session state from a matching `change/{id}` branch. `weave change status` reports metadata and branch alignment. `weave change switch` is the explicit way to move to another existing change.

If a target is not a git repo, Weave still writes the change artifacts and reports branch creation as skipped. `switch` and `propagate` block when affected git repos have uncommitted changes; `new` does not block so already-started local work can be captured as a new change.

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
weave-capture    capture the current discussion as a change exploration
weave-explore    stress-test product requirements and PRD readiness
weave-prd        generate or revise a PRD from the active exploration
weave-architect  generate or revise engineering architecture from the active PRD
weave-clarify    clarify an existing exploration, PRD, or architecture artifact
weave-issues     break architecture, a PRD, or implementation plan into tracer-bullet issues
weave-propagate  copy an existing change exploration to another repo
```

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
/weave-explore "Analytics of reviews"
/weave-prd
/weave-architect
/weave-clarify prd
/weave-issues "Break the active PRD into implementation issues"
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
/weave-explore "Analytics of reviews"
/weave-prd
/weave-architect
/weave-clarify prd
/weave-issues "Break the active PRD into implementation issues"
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
$weave-explore "Analytics of reviews"
$weave-prd
$weave-architect
$weave-clarify prd
$weave-issues "Break the active PRD into implementation issues"
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
/weave-explore "Analytics of reviews"
/weave-prd
/weave-architect
/weave-clarify prd
/weave-issues "Break the active PRD into implementation issues"
/weave-propagate 260522-f3q9-review-analytics to api
```

Or invoke the skill naturally:

```text
Use the weave-explore skill for Analytics of reviews.
Use the weave-prd skill to generate the PRD.
Use the weave-architect skill to generate the engineering design.
Use the weave-clarify skill to revise the active PRD after scope changes.
```

`weave-clarify` is for refining an existing change artifact when scope, requirements, assumptions, or decisions change midstream. It updates one selected artifact at a time, such as `exploration.md`, `prd.md`, or `architecture.md`, and reports follow-up artifacts that should be clarified separately. Use `weave-prd` and `weave-architect` for initial generation; use `weave-clarify` when an existing artifact needs a focused amendment.

Claude Code, Cursor, and opencode use slash commands such as `/weave-explore`, `/weave-prd`, `/weave-architect`, and `/weave-clarify`. Codex uses `$weave-explore`, `$weave-prd`, `$weave-architect`, and `$weave-clarify` to explicitly invoke installed skills. opencode gets small slash-command wrappers that delegate to the portable skills in `.agents/skills`; Weave does not install `.opencode/skills` by default.

## `weave skills` and `weave skill`

Lists and prints bundled Weave skills.

```bash
weave skills list
weave skill show weave-new
weave skill show weave-explore
weave skill show weave-prd
weave skill show weave-architect
weave skill show weave-clarify
weave skill show weave-issues
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
