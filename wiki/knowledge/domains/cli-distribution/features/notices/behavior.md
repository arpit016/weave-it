# Notices

## Purpose

Surface package and skill staleness to both human developers and AI agents in a single structured shape that travels through the same commands without corrupting machine-readable output.

## Current Behavior

Five Tier 1 commands compute notices in parallel with their normal work and return them in two channels:

- `--json` output gains a top-level `notices` array (always present, possibly empty).
- Non-JSON interactive output prints a one-line summary footer to **stderr** after the normal stdout body, only when stdout is a TTY and no opt-out is set.

Non-Tier-1 commands do not gain a `notices` field; their `--json` shape is unchanged.

Notices are computed from local manifest state plus a cached npm registry lookup. All sources degrade silently on failure: network error → no `package_outdated` notice; unreadable `~/.weave/cache/` → cache treated as cold; corrupted manifest entry → entry ignored; missing `templates/` for the bundled `last_changed_in` lookup → that skill is skipped.

## Notice Kinds

| kind               | trigger                                                                                                  | message shape                                                                                                       | details payload                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `package_outdated` | cached npm latest > installed `weave-it` package version                                                 | `weave-it <latest> is available (installed <installed>). Run 'weave status' for details.`                           | `{installed, latest}`                                    |
| `skills_modified`  | one or more installed `SKILL.md` files have a disk hash that differs from the manifest `installed_hash`  | `<N> installed skill file(s) have been modified locally. Run 'weave status' for details.`                           | `{skills: [{agent, name, kind}]}`                        |
| `skills_outdated`  | one or more installed skills' `installed_from` differs from the currently bundled `last_changed_in`      | `<N> installed skill file(s) are out of date. Run 'weave agent update --all' or 'weave status' for details.`        | `{skills: [{agent, name, kind, installed_from, current}]}` |

`skills_modified` wins over `skills_outdated` for the same skill: if the disk file was edited, the skill is reported as `modified` and `skills_outdated` is suppressed for that entry.

## Tier 1 Commands

The notice contract applies to exactly these five commands:

- `weave workspace`
- `weave change current`
- `weave change status`
- `weave change new`
- `weave status`

All five share the same implementation path: a `withNotices()` helper wraps the action, computes notices in parallel, and merges them into the rendered output. Adding a sixth Tier 1 command is a deliberate change; the rest of the CLI stays notice-free to keep `--json` payloads stable.

## Footer Suppression Rules

The interactive stderr footer is **only** emitted when ALL of these hold:

- `notices.length > 0`
- `process.stdout.isTTY` is true
- `WEAVE_NO_NOTICES` is not `"1"`
- `CI` env var is unset, empty, `"false"`, or `"0"`

`--json` output is never affected by these checks (other than the explicit `WEAVE_NO_NOTICES=1` opt-out, which short-circuits notice computation to `[]`).

## Opt-Out

Two equivalent environment variables suppress all notice work:

- `NO_UPDATE_NOTIFIER=1` (standard convention)
- `WEAVE_NO_NOTICES=1` (Weave-specific)

When either is set:

- The npm registry check is skipped entirely (no fetch, no cache write).
- `gatherNotices()` returns `[]` before any drift detection runs.
- The footer is not rendered.

## Skill Contract: `# Surface Weave Notices`

Every bundled `SKILL.md` contains a byte-identical `# Surface Weave Notices` section that tells the agent:

- Tier 1 commands return notices in `--json`; surface them verbatim near the top of the response when non-empty.
- Do not edit, suppress, or invent notices.
- Recommend `weave status` or `weave agent update` per the notice text; never run `npm i -g` or any package manager command directly.
- Treat empty `notices` under `WEAVE_NO_NOTICES=1` as intentional silence.

Byte identity is enforced by a test against `EXPECTED_NOTICE_BOILERPLATE` in `src/lib/skill-template-checks.ts`.

## Concurrency And Performance

Notice gathering runs in `Promise.all` with the wrapped command's main action. The npm registry check has a 3-second `AbortController` timeout; if it does not return in time, the in-flight request is aborted and notices for that call use whatever the cache already had (possibly `null`).

The npm cache file lives at `~/.weave/cache/npm-version.json` and has a 24-hour TTL. A stale (or absent) cache schedules a background fetch; the current invocation does not block on the network.

## Source Anchors

- Notice types and gathering: `src/lib/notices.ts` (`gatherNotices`, `detectSkillDrift`, `isNewerVersion`)
- npm version check + cache: `src/lib/npm-version.ts` (`getNpmVersionInfo`)
- Tier 1 wiring: `src/lib/with-notices.ts` (`withNotices`)
- Tier 1 commands: `src/commands/workspace.ts`, `src/commands/status.ts`, `src/commands/change.ts` (`new`, `current`, `status` subcommands)
- Skill contract source: `EXPECTED_NOTICE_BOILERPLATE` in `src/lib/skill-template-checks.ts`
- Templates: `templates/skills/<name>/SKILL.md` (every shipped skill carries the block)
- Tests: `tests/notices.test.ts`, `tests/with-notices.test.ts`, `tests/cli-status.test.ts`, `tests/cli-tier1-notices.test.ts`, `tests/agent-skills.test.ts` (byte-identity)

## Change History

- 2026-06-03 (change `260603-piln-npm-and-skill-versioning-and-updates`): notices introduced; Tier 1 set of five commands defined; `--json notices` contract and stderr footer rules established; `WEAVE_NO_NOTICES` and `NO_UPDATE_NOTIFIER` opt-outs added; `# Surface Weave Notices` byte-identical block embedded in all 10 bundled skills.

## Open Questions

- Should adding a brand-new bundled skill emit a separate `skills_new` notice kind, or stay rolled into `skills_outdated`? Exploration listed `skills_new` as a v1 kind; v1 implementation deferred it.
