---
artifact: tasks
status: draft
owner: engineering
created_at: 2026-06-03T19:49:18.000Z
updated_at: 2026-06-03T19:49:18.000Z
source: prd.md
---

# Tasks: Publish V1 To Npm Registry

## Source Context

- PRD: `wiki/changes/260604-jrqg-publish-v1-to-npm-registry/prd.md`
- Exploration: `wiki/changes/260604-jrqg-publish-v1-to-npm-registry/exploration.md`
- Sessions: `wiki/changes/260604-jrqg-publish-v1-to-npm-registry/sessions/20260603-191513-m3vp-exploration.md`
- Codebase: `package.json`, `tsup.config.ts`, `scripts/bump-skill-versions.mjs`, `templates/skills/**/SKILL.md`, `tests/` (vitest)
- Architecture: not produced for this change (release-engineering scope; PRD + codebase sufficient)

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
| T1 | todo | AFK | Add MIT license | None (needs copyright-holder string) |
| T2 | todo | AFK | Expand package.json metadata | None (needs author string + keyword confirmation) |
| T3 | todo | AFK | Bare-number version tags via .npmrc | None |
| T4 | todo | AFK | Wire prepublish gate + version lifecycle hook | None |
| T5 | todo | AFK | README install + release docs | None |
| T6 | todo | AFK | Verify tarball contents | T1, T2, T3, T4, T5 |
| T7 | blocked | HITL | Execute first publish (1.0.0) | T6 + maintainer npm/GitHub credentials |

## T1: Add MIT license

Status: todo

Type: AFK

Blocked by: None - needs the copyright-holder string from the maintainer (see Open Questions in PRD)

User stories covered: 2, 3

Origin: none

Related finding: none

### What to build

Add an MIT `LICENSE` file at the repo root and reflect the license in package metadata and docs, so the package is legally usable and the npm/GitHub pages display MIT.

- Create `LICENSE` with the standard MIT text and a single `Copyright (c) 2026 <holder>` line.
- Set `"license": "MIT"` in `package.json`.
- Add a `## License` section to `README.md` pointing to `LICENSE`.

### Acceptance Criteria

- [ ] `LICENSE` exists at repo root with MIT text and the chosen copyright holder.
- [ ] `package.json` has `"license": "MIT"`.
- [ ] `README.md` has a `## License` section referencing `LICENSE`.
- [ ] After commit/push, the GitHub repo About sidebar detects `License: MIT`.

### Verification

- Automated tests: not applicable; no usable test base for license metadata.
- Manual/smoke check: `npm pkg get license` returns `"MIT"`; `LICENSE` present; GitHub About shows MIT after push.

## T2: Expand package.json metadata

Status: todo

Type: AFK

Blocked by: None - needs the `author` string (name + email) and keyword-list confirmation from the maintainer

User stories covered: 1, 3

Origin: none

Related finding: none

### What to build

Populate the standard npm metadata fields and set the initial published version, so the npm package page renders correctly and links back to source.

- Set `version` to `1.0.0`.
- Add `author` (`Name <email>`; a GitHub `noreply` address is acceptable for privacy).
- Add `homepage` (`https://github.com/arpit016/weave-it#readme`).
- Add `bugs.url` (`https://github.com/arpit016/weave-it/issues`).
- Add `repository` (`{ "type": "git", "url": "git+https://github.com/arpit016/weave-it.git" }`).
- Add `keywords` (proposed: `weave`, `cli`, `ai`, `agent`, `claude`, `cursor`, `codex`, `opencode`, `sdlc`, `wiki`, `knowledge-base`).
- Add `publishConfig.access: "public"`.

### Acceptance Criteria

- [ ] `package.json` `version` is `1.0.0`.
- [ ] `author`, `homepage`, `bugs.url`, `repository`, `keywords`, and `publishConfig.access` are present and correct.
- [ ] `package.json` remains valid JSON and existing fields (`bin`, `files`, `scripts`, `engines`, deps) are preserved.

### Verification

- Automated tests: not applicable.
- Manual/smoke check: `npm pkg get version repository.url publishConfig.access bugs.url homepage` returns expected values; `node -e "require('./package.json')"` parses.

## T3: Bare-number version tags via .npmrc

Status: todo

Type: AFK

Blocked by: None

User stories covered: 6

Origin: none

Related finding: none

### What to build

Add a committed project `.npmrc` so `npm version` creates bare-number git tags (`1.0.0`) instead of v-prefixed (`v1.0.0`).

- Create `.npmrc` at repo root containing `tag-version-prefix=""`.

### Acceptance Criteria

- [ ] `.npmrc` exists at repo root with `tag-version-prefix=""`.
- [ ] In-repo, `npm config get tag-version-prefix` resolves to an empty string.
- [ ] `.npmrc` does not appear in `npm pack --dry-run` output (npm auto-excludes it).

### Verification

- Automated tests: not applicable.
- Manual/smoke check: `npm config get tag-version-prefix` (run in repo) prints empty; confirmed absent from `npm pack --dry-run` (cross-checked in T6).

## T4: Wire prepublish gate + version lifecycle hook

Status: todo

Type: AFK

Blocked by: None

User stories covered: 4, 5, 8

Origin: none

Related finding: none

### What to build

Add the two npm lifecycle scripts that guarantee a fresh, tested build on publish and keep skill versions stamped in the version commit.

- Add `"prepublishOnly": "npm run typecheck && npm run test && npm run build"`.
- Add `"version": "npm run release:bump-skills && git add -A templates/skills"`.
- Leave existing scripts (`build`, `dev`, `test`, `typecheck`, `release:bump-skills`) unchanged.

### Acceptance Criteria

- [ ] `prepublishOnly` runs typecheck, tests, and build, and aborts on any failure.
- [ ] `version` runs the skill bumper and stages `templates/skills` changes.
- [ ] Running the version flow stamps all 10 skills from `last_changed_in: 0.1.0` to `last_changed_in: 1.0.0` on the first release (no prior tag).

### Verification

- Automated tests: `npm test` (vitest) still passes; existing `tests/bump-skill-versions.test.ts` covers the bumper.
- Manual/smoke check: `npm run prepublishOnly` exits 0; standalone `npm run release:bump-skills` rewrites skill frontmatter to `1.0.0` (revert after the smoke test so the real run happens inside `npm version`).

## T5: README install + release docs

Status: todo

Type: AFK

Blocked by: None

User stories covered: 1, 9, 11

Origin: none

Related finding: none

### What to build

Document how end users install the package and how maintainers cut releases.

- Add a `## Installation` section near the top: `npm install -g weave-it` then `weave --help`.
- Add a `## Releasing` section with the runbook: `npm version <bump> --message "release: %s"`, `git push --follow-tags`, `npm publish`, and the optional `weave agent update --all` hygiene step.

### Acceptance Criteria

- [ ] `README.md` has an `## Installation` section with the global install command.
- [ ] `README.md` has a `## Releasing` section with the full runbook.
- [ ] Runbook reflects bare-number tags and the `release: %s` commit message.

### Verification

- Automated tests: not applicable.
- Manual/smoke check: sections render correctly; commands match the actual scripts and `.npmrc` behavior.

## T6: Verify tarball contents

Status: todo

Type: AFK

Blocked by: T1, T2, T3, T4, T5

User stories covered: 7, 10

Origin: none

Related finding: none

### What to build

Confirm the published tarball ships only intended files before any real publish.

- Run `npm pack --dry-run` and inspect the file listing.

### Acceptance Criteria

- [ ] Dry-run lists only `dist/cli.js`, `dist/cli.js.map`, `dist/cli.d.ts`, `templates/**`, `LICENSE`, `README.md`, `package.json`.
- [ ] No sources (`src/`), tests (`tests/`), `wiki/`, `.weave/`, `.npmrc`, or other stray files appear.
- [ ] If stray files appear, tighten the `files` allowlist (or add `.npmignore`) and re-run until clean.

### Verification

- Automated tests: not applicable.
- Manual/smoke check: `npm pack --dry-run` output matches the allowlist exactly. (A fresh `npm run build` may be needed first so `dist/` exists, since it is gitignored.)

## T7: Execute first publish (1.0.0)

Status: blocked

Type: HITL

Blocked by: T6 complete, plus maintainer npm authentication and GitHub push access. Maintainer-run; not executed by the agent.

User stories covered: 1, 2, 3, 5, 6 (and all acceptance criteria)

Origin: none

Related finding: none

### What to build

Perform the first public release from the maintainer's machine. Full step sequence:

1. Ensure the working tree is clean and T1-T6 are committed:
   `git status` (clean), `git add LICENSE .npmrc package.json README.md`, `git commit -m "chore: prepare v1.0.0 npm publish"`.
2. Smoke-test the skill bumper, then revert so the real run happens inside `npm version`:
   `npm run release:bump-skills` then `git checkout -- templates/skills`.
3. Re-verify the tarball: `npm pack --dry-run` (optionally run `npm run build` first so `dist/` exists).
4. Authenticate to npm (one-time per machine): `npm login`; confirm with `npm whoami`.
5. Bump, stamp skills, commit, and tag in one step:
   `npm version 1.0.0 --message "release: %s"`.
   - This bumps `package.json` to `1.0.0`, runs the `version` hook (stamps all skills to `last_changed_in: 1.0.0` and stages them), creates one commit `release: 1.0.0`, and creates the bare git tag `1.0.0`.
6. Push commit and tag: `git push --follow-tags`.
7. Publish: `npm publish`.
   - `prepublishOnly` runs typecheck + tests + build before upload.
8. Verify the registry: `npm view weave-it` shows `version: 1.0.0`, `license: MIT`, repository URL.
9. Verify install in a scratch shell: `npm install -g weave-it` then `weave --help`.
10. Confirm the tag on the remote: `git ls-remote --tags origin` includes `1.0.0`.
11. Refresh this clone's installed skills for dogfooding: `weave agent update --all`.

### Acceptance Criteria

- [ ] `npm view weave-it` returns metadata (not 404) with `version: 1.0.0` and `license: MIT`.
- [ ] `npm install -g weave-it` installs the binary and `weave --help` works.
- [ ] Bare git tag `1.0.0` exists locally and on `origin`.
- [ ] npm package page shows GitHub Source link, working Issues link, and MIT license.
- [ ] All 10 bundled skills show `last_changed_in: 1.0.0` after the release commit.

### Verification

- Automated tests: `prepublishOnly` runs the full vitest suite as the publish gate.
- Manual/smoke check: registry view + scratch-shell global install + remote tag listing, as enumerated above.

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
| QF1 | out_of_scope | medium | exploration/capture | None | `weave change progress` crashes with `raw.trim is not a function` |

### QF1: `weave change progress` crashes with `raw.trim is not a function`

Status: out_of_scope

Severity: medium

Source: Observed repeatedly during `weave-capture` and `weave-prd` lifecycle-progress calls for this change.

Related task: None (not part of publishing).

Details: `weave change progress <lane> --source ... --json` exits 1 with `{"status":"error","code":"unknown_error","message":"raw.trim is not a function"}`. Likely root cause: in `src/commands/change.ts`, Commander's `--no-invalidate` flag populates `options.invalidate` as a boolean, which collides with the `--invalidate <lanes>` string option; `parseInvalidateList()` then calls `.trim()` on a boolean. Effect: lifecycle stage cannot advance via the CLI in this repo, so `status.yml` for this change remains at `stage: exploration` despite exploration/prd/tasks artifacts existing.

Recommendation: open a separate `type: fix` change to repair the option-key collision, then re-run the `weave change progress` calls to advance this change's lifecycle.

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
