# Weave-It

Weave-It is a TypeScript CLI package. The npm package is `weave-it` and the CLI binary is `weave`.

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

## Project Structure

```text
src/
  cli.ts
  commands/
    add.ts
    init.ts
    workspace.ts
  lib/
    add-folder.ts
    files.ts
    folders.ts
    git.ts
    ids.ts
    init-workspace.ts
    session-state.ts
    show-workspace.ts
    sync.ts
    weave-scaffold.ts
tests/
  init.test.ts
weave-it/
  implementation-plan.md
  weave-init-v1.md
```

## Contribution Notes

- Keep changes small and focused.
- Add or update tests for behavior changes.
- Do not commit `node_modules/`, `dist/`, coverage output, or local machine state.
- Source files use ESM imports with `.js` specifiers because TypeScript is configured with `NodeNext` module resolution.
- Use `apply_patch` or normal editor changes for source edits, then run typecheck, tests, and build.
