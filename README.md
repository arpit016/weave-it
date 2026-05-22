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
weave agent diff opencode weave-prd
weave agent reset opencode weave-prd
```

`install` and `update` protect user edits. They update files only when the current file still matches the last Weave-installed hash in `.weave/agents.yml`. If a user edits an installed skill or command wrapper, Weave skips it. `reset` is the explicit overwrite path.

## Using `weave-prd`

Weave ships the `weave-prd` Agent Skill for product discovery and PRD refinement. The workflow starts by running `weave workspace --json`, reading relevant `wiki/knowledge/**` and `wiki/features/**` context, then guiding the agent through product questions before creating or updating a PRD.

Install it for one agent:

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
claude     .claude/skills/weave-prd/SKILL.md
cursor     .agents/skills/weave-prd/SKILL.md
codex      .agents/skills/weave-prd/SKILL.md
opencode   .agents/skills/weave-prd/SKILL.md
opencode   .opencode/commands/weave-prd.md
```

### Claude Code

Install:

```bash
weave agent install claude
```

Then start Claude Code in the repo and ask:

```text
/weave-prd "Analytics of reviews"
```

### Cursor

Install:

```bash
weave agent install cursor
```

Then ask Cursor Agent from the repo:

```text
/weave-prd "Analytics of reviews"
```

### Codex

Install:

```bash
weave agent install codex
```

Then ask Codex from the repo:

```text
$weave-prd "Analytics of reviews"
```

### opencode

Install:

```bash
weave agent install opencode
```

Then invoke the slash command in opencode:

```text
/weave-prd "Analytics of reviews"
```

Or invoke the skill naturally:

```text
Use the weave-prd skill for Analytics of reviews.
```

Claude Code and Cursor can invoke the installed skill directly with `/weave-prd`. opencode gets a small `/weave-prd` command wrapper that delegates to the portable skill in `.agents/skills`. Codex uses `$weave-prd` to explicitly invoke the skill. Weave does not install `.opencode/skills` by default.

## `weave skills` and `weave skill`

Lists and prints bundled Weave skills.

```bash
weave skills list
weave skill show weave-prd
```

## Project Structure

```text
src/
  cli.ts
  commands/
    add.ts
    agent.ts
    init.ts
    skills.ts
    workspace.ts
  lib/
    add-folder.ts
    agent-skills.ts
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
  init.test.ts
.weave/
  agents.yml
  sync.yml
wiki/
  knowledge/
  features/
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
