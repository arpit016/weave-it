# Skill Versioning

## Purpose

Give every bundled `SKILL.md` a version identity that travels with the package, so the CLI can detect when an installed copy is behind without inventing per-skill release pipelines.

## Current Behavior

Each `templates/skills/<name>/SKILL.md` carries a required `last_changed_in: <package-version>` field in its YAML frontmatter. The field is the `weave-it` package version that last meaningfully changed that skill.

When the user runs `weave agent install <agent>` or `weave agent update <agent>`, the CLI stamps the bundled `last_changed_in` value into `.weave/agents.yml` as the skill's `installed_from` field. Later, drift detection compares the manifest `installed_from` against the currently bundled `last_changed_in` to decide whether the installed copy is `outdated`.

Hash-based modification detection (existing behavior) and version-based outdated detection (new) operate independently and may both fire for the same skill.

## Domain Model

`SKILL.md` frontmatter (required fields):

```yaml
---
name: <skill-name>
description: <short description>
last_changed_in: <package-version>   # e.g. "0.1.0"
---
```

`.weave/agents.yml` per-skill entry shape:

```yaml
installed:
  claude:
    skills:
      weave-explore:
        path: .claude/skills/weave-explore/SKILL.md
        source_hash: sha256:...
        installed_hash: sha256:...
        installed_at: 2026-06-03T10:03:45.819Z
        installed_from: 0.1.0          # null for pre-versioning legacy entries
```

Skill drift state derived for the per-skill view:

- `current`: disk hash == manifest `installed_hash` AND `installed_from` == bundled `last_changed_in`.
- `outdated`: disk hash == manifest `installed_hash` AND `installed_from` != bundled `last_changed_in`.
- `modified`: disk hash != manifest `installed_hash` (regardless of version).
- `missing`: manifest entry exists but the file on disk is gone.

`modified` short-circuits `outdated`: when both conditions are technically true, the skill reports as `modified` only. Users see the version pair under `weave status`.

## Behavioral Rules

- The parser refuses to load a bundled `SKILL.md` whose frontmatter omits `last_changed_in`. Error: `Skill frontmatter in <path> must include last_changed_in (the weave-it package version of the last skill change)`.
- The parser is lenient on legacy `.weave/agents.yml` entries: a manifest entry without `installed_from` is loaded with `installed_from: null`. Such entries always report as `outdated` until reinstalled or updated.
- `installed_from` is rewritten on every `install`, `update`, and `reset` operation that touches the skill, using the bundled `last_changed_in` at that moment.
- Independent per-skill semver is explicitly out of scope; the version is always the `weave-it` package version that last changed the skill.
- Hand-editing `last_changed_in` in a bundled template is not the maintainer workflow; the release script owns it.

## Release Script

`scripts/bump-skill-versions.mjs` (exposed as `npm run release:bump-skills`) is the maintainer workflow for stamping `last_changed_in`:

- Reads `package.json.version` (the upcoming release version).
- Reads the most recent reachable git tag via `git describe --tags --abbrev=0`.
- For every `templates/skills/<name>/SKILL.md`, runs `git diff <tag>..HEAD -- <path>` and bumps `last_changed_in` to the upcoming version only when the diff is non-empty.
- Defaults missing `last_changed_in` fields to the upcoming version with a warning.
- Never commits, tags, pushes, or runs npm.
- When no prior tag is reachable, treats every skill as new and stamps every one.

The script is invoked by the maintainer as part of cutting a release, before `npm publish`.

## Integrations And Side Effects

- `weave agent install`, `weave agent update`, `weave agent reset` all populate `installed_from` from the bundled `DefaultSkill.lastChangedIn`. Opencode command wrappers carry `installed_from: null` (commands are not versioned).
- `weave status` and the notices system both rely on the `installed_from` vs current `last_changed_in` comparison to decide `outdated` state.

## Source Anchors

- Frontmatter parsing and stamping: `src/lib/agent-skills.ts` (`parseSkillFrontmatter`, `DefaultSkill.lastChangedIn`, `ManifestEntry.installed_from`, `setManifestEntry`, `loadAgentsManifest`)
- Templates: every `templates/skills/<name>/SKILL.md` (10 skills as of `0.1.0`)
- Release script: `scripts/bump-skill-versions.mjs`; npm script: `release:bump-skills` in `package.json`
- Drift derivation: `detectSkillDrift` in `src/lib/notices.ts`; per-skill state derivation in `src/lib/status.ts` (`collectSkillRows`)
- Tests: `tests/agent-skills.test.ts`, `tests/bump-skill-versions.test.ts`, `tests/notices.test.ts`

## Change History

- 2026-06-03 (change `260603-piln-npm-and-skill-versioning-and-updates`): `last_changed_in` frontmatter field added to all 10 bundled skills; `installed_from` manifest field introduced; legacy-tolerant manifest loader added; release script and npm script introduced; the existing hash-based modification detection is retained and complementary.

## Open Questions

- Whether to extend the model to opencode command wrappers (currently always `null`). Not blocking v1.
