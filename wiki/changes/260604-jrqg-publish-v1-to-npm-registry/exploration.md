---
artifact: exploration
status: ready
owner: product
created_at: 2026-06-03T18:33:09.445Z
updated_at: 2026-06-03T19:15:13.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: discussion
---

# Publish V1 To Npm Registry

## Topic

Take `weave-it` from "private GitHub repo, never published" to "public GitHub repo, published on the npm registry as `weave-it@1.0.0`, repeatably re-publishable with a single keystroke that always rebuilds first." Establish the licensing, build, versioning, and tagging conventions that future releases will inherit.

## Current Understanding

`weave-it` lives at `arpit016/weave-it` on GitHub (now public). The npm name `weave-it` is unclaimed (`registry.npmjs.org` returns 404). The package builds via `tsup` into `dist/cli.js` with a shebang and ESM banner. The published tarball is intended to ship only `dist/` and `templates/` plus the standard `package.json`, `README.md`, and `LICENSE` that npm always includes once they exist.

Two design lines need to be drawn together: (1) the publishing pipeline itself - what `npm publish` actually does and what it gates on - and (2) the version-and-tag conventions that will outlive v1. The maintainer is solo, the package is single, and the in-flight change `260603-piln-npm-and-skill-versioning-and-updates` (currently in `issues` stage) already assumes a published `weave-it` and a release-time skill-version bumper. v1 must not block that follow-on but should not absorb it either.

## Open Questions

Resolved during exploration; none blocking PRD.

Deferred to PRD or implementation:

- Exact copyright holder string for `LICENSE`.
- Exact `author` string for `package.json` (and whether the email is personal or a GitHub `noreply`).
- Final keyword list for `package.json`.
- Whether to add a `CHANGELOG.md` with the v1.0.0 entry as part of v1, or defer to a later release.
- Whether the optional `weave agent update --all` hygiene step belongs in the published `## Releasing` section of `README.md` or only in the maintainer's local runbook.

## Decisions

### License

- License is **MIT**. Standard text in a new repo-root `LICENSE` file with `Copyright (c) 2026 <holder>`. Mirrored as `"license": "MIT"` in `package.json` and a `## License` section in `README.md`.
- Rationale: gravitational center for npm CLIs; lowest friction for users and contributors; weave-it has no SaaS-resale attack surface that would justify Apache-2.0's patent grant or BUSL's anti-managed-service clause.
- The right time to tighten (relicense to Apache-2.0 or stricter) or loosen is now, before any outside contributor lands code; chose to loosen and welcome adoption.

### Initial Version

- First published version is **`1.0.0`**, not `0.1.0`.
- Implies semver post-1.0 contract: additive changes are minor bumps, breaking changes require a major bump and a deprecation cycle.
- The in-flight `260603-piln` change is purely additive (new commands, new frontmatter fields, new `--json notices` array). It will land as `1.1.0`.

### Versioning And Tagging Model

- Built-in `npm version` is the only knob. Single keystroke bumps `package.json`, makes a commit, and creates an annotated git tag - all in one atomic step.
- Tag format is **bare numbers** (`1.0.0`), not v-prefixed (`v1.0.0`). Achieved via a project-local `.npmrc` with `tag-version-prefix=""`. The `.npmrc` is committed and is automatically excluded from the published npm tarball regardless of the `files` allowlist.
- Commit message uses `npm version --message "release: %s"`, producing `release: 1.0.0` rather than `release: v1.0.0`, consistent with the bare-number preference.
- No release-please, changesets, semantic-release, or conventional-commits-driven bumping in v1. Manual bump per release.

### Build-And-Publish Gate

- A new `prepublishOnly` script runs `typecheck && test && build`. Fires only on actual `npm publish` (not `npm install`, not `npm pack`), so it cannot accidentally slow other workflows.
- `tsup`'s existing `clean: true` already wipes `dist/` before each build, so the published tarball is always built from the current source tree.
- `prepack` is deliberately not used; `npm pack` remains a fast inspection tool that does not run the full test suite.

### Skill Version Bumper Wiring

- The pre-existing [scripts/bump-skill-versions.mjs](scripts/bump-skill-versions.mjs) stays wired into the npm `version` lifecycle hook via `"version": "npm run release:bump-skills && git add -A templates/skills"`.
- For the v1.0.0 release specifically: every bundled skill currently has `last_changed_in: 0.1.0`. With no previous git tag, the bumper treats every skill as changed and rewrites all 10 to `last_changed_in: 1.0.0` in place. The result lands in the same git commit as the `package.json` bump, so the tag points at a tree where every version field agrees.
- Rejected the alternative of dropping the bumper from v1 (waiting for `260603-piln` to start consuming `last_changed_in`). Keeping it cheaply establishes a baseline for `260603-piln` to diff against from day one.

### Tarball Boundaries

- Keep the existing allowlist `"files": ["dist", "templates"]`. No `.npmignore`.
- Validate before any real publish via `npm pack --dry-run`. Expected contents: `dist/cli.js`, `dist/cli.js.map`, `dist/cli.d.ts`, `templates/**`, `LICENSE`, `README.md`, `package.json`. Anything else means the allowlist or `.gitignore` needs tightening.

### Publish Surface

- Maintainer publishes locally from their laptop after one-time `npm login`.
- No CI-driven publishing in v1. CI-on-tag with npm provenance attestations and trusted-publisher OIDC is a clean v1.x follow-on.

### Repo Visibility

- Repo is already public at `https://github.com/arpit016/weave-it`. No further visibility action needed before publish.

### Package.json Metadata

- Add the standard set of fields the npm.com page renders: `license`, `author`, `homepage`, `bugs.url`, `repository`, `keywords`, `publishConfig.access: "public"`.
- `publishConfig.access: "public"` is technically only required for scoped packages, but adding it is harmless and pre-empts a future scope rename from accidentally publishing as private.

### Maintainer Hygiene Post-Publish

- After every release, the maintainer runs `weave agent update --all` in this clone to refresh installed copies in `.claude/`, `.agents/`, `.opencode/` so the dogfooding clone matches what just shipped. The bumper itself does not touch those paths (source-of-truth is `templates/skills/**` only).

## Scenarios

### Scenario: First Publish (1.0.0)

Maintainer is on `change/260604-jrqg-publish-v1-to-npm-registry` with the LICENSE, .npmrc, README, and package.json edits committed. They run `npm pack --dry-run`, inspect the tarball, run `npm login`, then `npm version 1.0.0 --message "release: %s"`. The `version` lifecycle hook bumps every skill from `last_changed_in: 0.1.0` to `last_changed_in: 1.0.0` and stages them; npm makes one commit `release: 1.0.0` containing `package.json` plus the 10 skill edits, and creates the bare-number git tag `1.0.0`. They run `git push --follow-tags`, then `npm publish`. `prepublishOnly` runs typecheck + tests + build; npm uploads the tarball. They verify with `npm view weave-it` and `npm install -g weave-it` in a scratch shell. Then `weave agent update --all` to refresh the dogfood copies in this clone.

### Scenario: Patch Release After v1 Lands

A bug fix is committed to main. Maintainer runs `npm version patch --message "release: %s"`. The bumper sees the previous tag is `1.0.0`, diffs each skill against it, and bumps `last_changed_in` only on skills that actually changed. `package.json` bumps to `1.0.1`. New commit, new tag `1.0.1`. `git push --follow-tags`, then `npm publish`. The npm-version-cache feature in `260603-piln` (when it lands) will surface "1.0.1 available" notices to existing users.

### Scenario: 260603-piln Lands As 1.1.0

The notice/version-surfacing change implements `weave status`, the `--json notices` array on Tier 1 commands, and the runtime consumption of `last_changed_in` and `installed_from`. All additive. Maintainer runs `npm version minor --message "release: %s"` -> `1.1.0`. The existing pipeline carries it through unchanged. From this release on, users who upgrade see actionable notices and the maintainer's pre-stamped `last_changed_in` baseline becomes meaningful.

### Scenario: A User Hits A Stale `weave-it`

A user installed `weave-it@1.0.0` globally weeks ago. After `1.1.0` ships, their next `weave workspace --json` (in any Weave repo) carries a `package_outdated` notice through the `--json notices` array (added by `260603-piln`). The notice points to `weave status` for remediation. The CLI never invokes `npm i -g`; the user runs it themselves. Mentioned here only to confirm the v1.0.0 publish does not foreclose it - the actual work lives in `260603-piln`.

### Scenario: Tarball Accidentally Includes A Stray File

`npm pack --dry-run` shows `wiki/`, `tests/`, `.weave/`, or similar in the listed contents. Cause: the `files` allowlist did not actually trim what we expected, or an always-included path leaked. Mitigation: tighten `files` further or add an explicit `.npmignore`. v1 expectation is that `files: ["dist","templates"]` produces a clean tarball; if the dry-run shows otherwise, it is a bug we fix before the first publish, not after.

## Existing Behavior

- Build: `tsup` produces `dist/cli.js` with `#!/usr/bin/env node` banner, ESM format, sourcemaps, and a `dts` declaration. `clean: true` is on. Configured in [tsup.config.ts](tsup.config.ts).
- Bin: `package.json.bin` declares `"weave": "./dist/cli.js"`. npm sets execute permission automatically on global install.
- Skill version metadata: All 10 templates already carry `last_changed_in: 0.1.0` in their YAML frontmatter (added recently as preparation for `260603-piln`). The runtime CLI does not yet consume the field.
- Bumper: [scripts/bump-skill-versions.mjs](scripts/bump-skill-versions.mjs) reads `package.json.version`, calls `git describe --tags --abbrev=0` for the previous tag, diffs each skill against it, and rewrites `last_changed_in` in place. Handles "no previous tag" (treats every skill as changed) and "field missing" (appends it) gracefully.
- gitignore: `node_modules/`, `dist/`, `coverage/`, `.DS_Store`. `dist/` is gitignored even though it is published; `npm publish` rebuilds it via `prepublishOnly`. Standard pattern.
- Repo visibility: `arpit016/weave-it` is `PUBLIC` (confirmed via `gh repo view`). No `licenseInfo` yet (will auto-detect once `LICENSE` lands).
- npm registry: `weave-it` is unclaimed (404). Maintainer is not currently logged in on this machine.
- Missing today: no `LICENSE` file, no `CHANGELOG.md`, no `.npmrc`, no `.npmignore`, no CI workflow files, no git tags. `package.json` lacks `license`, `author`, `homepage`, `bugs`, `repository`, `keywords`, `publishConfig`, `prepublishOnly`, and the `version` lifecycle script.

## PRD Readiness

Ready
