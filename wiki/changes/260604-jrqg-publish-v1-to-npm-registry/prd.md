---
artifact: prd
status: draft
owner: product
created_at: 2026-06-03T19:21:28.000Z
updated_at: 2026-06-03T19:38:00.000Z
reviewed_at: null
approved_at: null
approved_by: null
source: exploration.md
---

# Publish V1 To Npm Registry PRD

## Problem Statement

`weave-it` is a finished, working CLI that today exists only as a private GitHub repository. Nobody outside the maintainer can install it. The maintainer cannot run `npm install -g weave-it`, the bundled agent skills cannot reach any other developer or repo, and the in-flight follow-on change `260603-piln-npm-and-skill-versioning-and-updates` (which adds update/version notices) is blocked because it assumes a package that has actually been published.

The maintainer wants to ship the first public release. Doing that well requires more than a single `npm publish`: the package needs a license so others can legally use it, a build-and-publish process that guarantees the published artifact is always freshly built and tested, a versioning and tagging convention that stays consistent across every future release, and the standard package metadata that makes the npm package page usable. Without these, the first release risks shipping stale build output, an unlicensed package nobody can adopt, inconsistent git tags, or a broken global binary.

This matters because the first published version sets conventions every later release inherits. Getting licensing, the publish gate, and the version/tag format right once - now, while the project is solo-maintained and pre-release - is far cheaper than correcting them after adopters and contributors arrive.

## Goals

- Publish `weave-it` to the public npm registry as version `1.0.0`, installable via `npm install -g weave-it`.
- License the project under MIT so others can legally use, modify, and embed it.
- Guarantee every publish is built and tested from current source via a prepublish gate.
- Establish a single-keystroke version-bump-commit-tag flow where npm versions and git tags stay one-to-one.
- Use bare-number git tags (`1.0.0`), not v-prefixed (`v1.0.0`), for both npm and git.
- Populate the standard `package.json` metadata that renders the npm package page (license, author, repository, homepage, bugs, keywords).
- Keep the published tarball minimal and intentional (only `dist/` and `templates/` plus the files npm always includes).
- Keep the existing skill-version stamping wired so the first release establishes a clean `last_changed_in: 1.0.0` baseline for the follow-on change to build on.

## Non-Goals

- Automated version bumping driven by conventional commits, release-please, changesets, or semantic-release.
- CI-driven publishing (GitHub Actions on tag push). Deferred to a later release.
- npm provenance attestations and OIDC trusted publishing. Deferred with CI.
- A `CHANGELOG.md` or automated changelog generation in this release.
- Renaming the package to a scoped name (`@arpit016/weave-it`).
- Pre-release dist-tags (`@next`, `@beta`).
- Implementing the update/version notice surfaces, `weave status`, or runtime consumption of `last_changed_in` - those belong to change `260603-piln` and ship as `1.1.0`.
- Making the GitHub repository public (already done before this PRD).

## Actors

- **Maintainer / release engineer (human).** The single person who runs the release. Logs into npm, runs the version bump, pushes tags, and publishes. Owns every decision in this PRD.
- **End-user developer (human).** Installs `weave-it` globally from npm and runs `weave` in their own repos. Primary beneficiary of the package being published and licensed.
- **AI agent.** Claude, Cursor, Codex, or opencode running in an end-user's repo via installed Weave skills. Benefits indirectly because the package and its skills become installable.
- **npm registry.** Hosts the published package and renders its metadata page.
- **GitHub.** Hosts the now-public source and the release tags.

## Current Behavior

- `weave-it` builds via `tsup` into `dist/cli.js` with a `#!/usr/bin/env node` banner, ESM format, sourcemaps, and a type-declaration file. `tsup` is configured with `clean: true`, so each build wipes `dist/` first.
- `package.json` declares the binary as `"weave": "./dist/cli.js"` and an allowlist `"files": ["dist", "templates"]`.
- All 10 bundled skills already carry `last_changed_in: 0.1.0` in their YAML frontmatter, in preparation for the follow-on change. The runtime CLI does not yet read the field.
- A release-time script at `scripts/bump-skill-versions.mjs` (wired as `npm run release:bump-skills`) rewrites `last_changed_in` for skills that changed since the previous git tag. It handles the "no previous tag" case by treating every skill as changed.
- The GitHub repo `arpit016/weave-it` is public, but has no detected license (no `LICENSE` file yet).
- The npm name `weave-it` is unclaimed (registry returns 404). The maintainer is not currently logged into npm on the release machine.
- Missing today: no `LICENSE`, no `.npmrc`, no `CHANGELOG.md`, no git tags, and no `license`, `author`, `homepage`, `bugs`, `repository`, `keywords`, `publishConfig`, `prepublishOnly`, or `version` lifecycle script in `package.json`.

## Proposed Product Behavior

The maintainer can publish `weave-it` to npm with a short, repeatable runbook. Before the first publish, the repository gains four things: an MIT `LICENSE` file, a project `.npmrc` that makes git tags bare-numbered, expanded `package.json` metadata, and README sections that tell users how to install and tell maintainers how to release.

Once those are in place, every release follows the same flow: the maintainer runs one `npm version` command that bumps the version in `package.json`, stamps the skill versions, creates a single commit, and tags it with the bare version number. They push the commit and tag, then run `npm publish`. The publish automatically rebuilds and tests from current source before uploading, and ships only the intended files.

End users can then run `npm install -g weave-it` and immediately use the `weave` binary. The npm package page shows the MIT license, links back to the public GitHub repo, and surfaces the issue tracker and keywords.

## User Workflows

### Workflow: Maintainer Prepares The Repo For First Publish

1. Maintainer adds an MIT `LICENSE` file at the repo root with the chosen copyright holder line.
2. Maintainer adds a project `.npmrc` containing `tag-version-prefix=""` so git tags are bare numbers.
3. Maintainer expands `package.json` with `license`, `author`, `homepage`, `bugs`, `repository`, `keywords`, and `publishConfig`, and adds the `prepublishOnly` and `version` lifecycle scripts.
4. Maintainer adds README sections: Installation (for users), Releasing (for maintainers), and License.
5. Maintainer commits these preparation changes.

### Workflow: Maintainer Publishes The First Version (1.0.0)

1. Maintainer runs `npm pack --dry-run` and confirms the tarball lists only `dist/`, `templates/`, `LICENSE`, `README.md`, and `package.json`.
2. Maintainer runs `npm login` once on the release machine.
3. Maintainer runs `npm version 1.0.0 --message "release: %s"`.
4. The system bumps `package.json` to `1.0.0`, runs the `version` hook (which stamps every skill to `last_changed_in: 1.0.0` and stages the changes), creates one commit `release: 1.0.0`, and creates the bare git tag `1.0.0`.
5. Maintainer runs `git push --follow-tags` to publish the commit and tag to GitHub.
6. Maintainer runs `npm publish`.
7. The system runs `prepublishOnly` (typecheck, tests, build), then uploads the freshly built tarball.
8. Maintainer verifies with `npm view weave-it` and a global install in a scratch shell.
9. Maintainer optionally runs `weave agent update --all` to refresh this clone's own installed skill copies.

### Workflow: Maintainer Publishes A Later Release

1. Maintainer chooses the bump level: `npm version patch`, `npm version minor`, or `npm version major` (with `--message "release: %s"`).
2. The system bumps the version, stamps only the skills that changed since the previous tag, commits, and tags with the bare number.
3. Maintainer runs `git push --follow-tags`, then `npm publish`.
4. The prepublish gate rebuilds and tests before upload.

### Workflow: End User Installs The Published Package

1. Developer runs `npm install -g weave-it`.
2. The system installs the package and wires the `weave` binary onto their PATH.
3. Developer runs `weave --help` and the CLI responds.

## User Stories

1. As an end-user developer, I want to install `weave-it` from npm with a single global install command, so that I can use `weave` without cloning the repo.
2. As an end-user developer, I want the package to carry a clear open-source license, so that I can legally use and adopt it.
3. As an end-user developer, I want the npm package page to link to the source repo and issue tracker, so that I can find docs and report problems.
4. As a maintainer, I want every `npm publish` to rebuild and test from current source automatically, so that I never accidentally ship stale or broken output.
5. As a maintainer, I want one command to bump the version, commit, and tag, so that npm versions and git tags never drift apart.
6. As a maintainer, I want git tags to be bare numbers matching the npm version exactly, so that the two version systems are visually identical.
7. As a maintainer, I want the published tarball to contain only intended files, so that I do not leak sources, tests, wiki content, or local metadata.
8. As a maintainer, I want the first release to stamp every skill with `last_changed_in: 1.0.0`, so that the follow-on versioning change has a clean baseline to diff against.
9. As a maintainer, I want a documented release runbook in the README, so that future releases are repeatable without re-deriving the steps.
10. As a maintainer, I want to verify the tarball contents before the first publish, so that I catch packaging mistakes before they become public.
11. As a maintainer, I want to keep my own clone's installed skills in sync after publishing, so that dogfooding matches what shipped.

## Functional Requirements

- The repository should contain an MIT `LICENSE` file at the root with the chosen copyright holder.
- `package.json` should declare `"license": "MIT"`, and `version` should be `1.0.0` at first publish.
- `package.json` should include `author`, `homepage`, `bugs.url`, `repository` (type git, pointing at the public GitHub URL), `keywords`, and `publishConfig.access: "public"`.
- `package.json` should include a `prepublishOnly` script that runs typecheck, tests, and build, and which executes only on actual `npm publish`.
- `package.json` should include a `version` lifecycle script that runs the skill-version bumper and stages the updated skill files so they land in the version commit.
- The project should include a committed `.npmrc` with `tag-version-prefix=""` so `npm version` produces bare-number git tags.
- The published tarball should contain only `dist/`, `templates/`, and the files npm always includes (`package.json`, `README.md`, `LICENSE`). It should not contain sources, tests, `wiki/`, or `.weave/`.
- The system should produce a git tag whose name exactly equals the npm version (for example, `1.0.0`).
- The README should include an Installation section, a Releasing runbook, and a License section.
- The skill-version bumper should rewrite all 10 skills from `last_changed_in: 0.1.0` to `last_changed_in: 1.0.0` on the first release.
- The release process should not invoke any automatic global package install on the user's behalf.

## Permissions and Access Control

- Only the maintainer (the npm account owner authenticated via `npm login`, and a user with push access to `arpit016/weave-it`) can publish a release or push tags.
- End users need no special permissions to install the published public package.
- The package is published with public access; no private-registry or restricted-access configuration applies.

## States and Lifecycle

The release version lifecycle:

- **Unpublished**: package exists only locally and on GitHub; npm returns 404. (Current state.)
- **Published 1.0.0**: first version live on npm; git tag `1.0.0` exists locally and on the remote.
- **Subsequent versions**: each `npm version` bump moves the package forward (`1.0.1`, `1.1.0`, `2.0.0`, etc.), each paired with a bare-number git tag.

Transitions are triggered exclusively by the maintainer running `npm version` followed by `npm publish`. There is no automated transition. A failed `prepublishOnly` gate aborts the publish and leaves the registry unchanged (the version bump and tag may already exist locally and must be reconciled by the maintainer).

## Notifications and Visibility

- After publishing, the package is visible on the npm registry with its metadata page (license, repository link, issues link, keywords, README).
- The GitHub repo's About sidebar shows `License: MIT` once the `LICENSE` file is committed.
- Update/version notices to end users (newer package available, stale skills) are explicitly out of scope here; they are delivered by change `260603-piln` in a later release.

## Edge Cases

- **Stray files in the tarball.** If `npm pack --dry-run` lists anything beyond the intended set, the maintainer must tighten the `files` allowlist or add an `.npmignore` before publishing. This must be caught before the first publish, not after.
- **First release has no previous tag.** The skill-version bumper must treat every skill as changed when no prior tag exists, stamping all to `1.0.0`.
- **prepublish gate fails.** If typecheck, tests, or build fail, `npm publish` must abort and nothing is uploaded. The maintainer fixes the failure and republishes.
- **Version bump on a dirty working tree.** `npm version` refuses to run on an unclean tree. The maintainer must commit or stash preparation changes first.
- **npm name already taken.** If `weave-it` were claimed before first publish, the maintainer would need to choose a scoped name; this PRD assumes the name remains available (confirmed unclaimed at exploration time).
- **`.npmrc` accidentally shipped.** A project `.npmrc` can contain auth tokens; npm automatically excludes it from the published tarball, so it must not appear in `npm pack --dry-run` output.
- **Installed skill copies drift after release.** The bumper does not touch the maintainer clone's installed copies in `.claude/`, `.agents/`, `.opencode/`; the maintainer refreshes them with `weave agent update --all` to keep dogfooding aligned.

## Acceptance Criteria

- [ ] `npm view weave-it` returns metadata (not 404) with `version: 1.0.0` and `license: MIT`.
- [ ] `npm view weave-it` shows `repository.url` pointing at the public GitHub URL.
- [ ] `npm install -g weave-it` in a clean shell installs the binary and `weave --help` works.
- [ ] `npm pack --dry-run` lists only `dist/` files, `templates/`, `LICENSE`, `README.md`, and `package.json`.
- [ ] A git tag named `1.0.0` (no `v` prefix) exists locally and on `origin`.
- [ ] The npm package page shows the GitHub repo as Source, a working Issues link, and the MIT license.
- [ ] The GitHub repo About sidebar shows `License: MIT`.
- [ ] All 10 bundled skills show `last_changed_in: 1.0.0` after the release commit.
- [ ] A repeated release (`npm version <bump>` then `npm publish`) produces a new published version and a matching bare-number tag.
- [ ] `prepublishOnly` runs typecheck, tests, and build on `npm publish`, and aborts the publish if any step fails.

## Rollout Considerations

- This is the initial public release; there are no existing npm users to migrate.
- The publish is performed manually from the maintainer's machine; no CI infrastructure is introduced in this release.
- The first release establishes conventions (MIT, bare tags, prepublish gate, metadata shape) that all later releases inherit.
- The follow-on change `260603-piln` depends on this release landing first and will ship as `1.1.0` using the same pipeline.
- Communication: announcing the package is optional and outside this PRD's scope.

## Analytics and Success Metrics

- Package successfully resolves on the npm registry (no 404).
- Global install succeeds and the `weave` binary runs.
- Tarball contains only intended files on first inspection.
- Future releases can be cut using only the documented runbook, with no ad-hoc steps.
- npm download counts and adoption are observable on the npm package page over time (informational; not a gating metric for this release).

## Revision History

- 2026-06-03: Initial PRD generated from `exploration.md` and the exploration session note, covering licensing (MIT), the prepublish build gate, the `npm version`-driven bump-commit-tag flow with bare-number tags, package metadata, tarball boundaries, and skill-version baseline stamping.

## Assumptions

- The npm name `weave-it` remains unclaimed and unscoped at first publish (confirmed unclaimed during exploration).
- The maintainer accepts the semver post-1.0 contract implied by starting at `1.0.0` (additive changes are minor bumps; breaking changes require a major bump).
- The existing `files: ["dist", "templates"]` allowlist produces a clean tarball; verified via `npm pack --dry-run` before the first publish.
- The `version` lifecycle hook running the skill bumper inside `npm version` is acceptable maintainer behavior and will not conflict with the clean-tree requirement, because the hook stages its own writes into the version commit.
- The maintainer publishes from a machine with push access to GitHub and an authenticated npm session.

## Open Questions

- What exact copyright holder string should appear in `LICENSE` (full legal name, GitHub handle `arpit016`, or a company name)?
- What exact `author` string should appear in `package.json` (`Name <email>`), and should the email be a personal address or a GitHub `noreply` address for privacy?
- What is the final keyword list for `package.json`? Proposed: `weave`, `cli`, `ai`, `agent`, `claude`, `cursor`, `codex`, `opencode`, `sdlc`, `wiki`, `knowledge-base`.
- Should a `CHANGELOG.md` with the `1.0.0` entry be added as part of this release, or deferred?
- Should the optional `weave agent update --all` hygiene step be documented in the public README Releasing section, or kept only in the maintainer's local notes?

## Out of Scope

- CI-driven publishing, provenance attestations, and OIDC trusted publishing.
- Automated/conventional-commit-driven version bumping.
- Changelog automation.
- Scoped package rename and pre-release dist-tags.
- The update/version notice system, `weave status`, and runtime consumption of `last_changed_in` (owned by change `260603-piln`).

## Further Notes

- The build already injects the binary shebang via `tsup`'s banner config, and npm sets execute permission on `bin` files at install time, so the global binary should work without additional packaging steps; this is verified by the scratch-shell install in the publish workflow.
- During exploration, an unrelated CLI bug was found: `weave change progress` fails with `raw.trim is not a function` due to a collision between the `--no-invalidate` and `--invalidate <lanes>` options in the change command. It does not block this PRD but should be tracked as a separate `type: fix` change, since it prevents lifecycle progress from advancing in this repo.
