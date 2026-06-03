# Knowledge Delta

Bridges change `260603-piln-npm-and-skill-versioning-and-updates` (npm and skill versioning, notices, lifecycle staleness levers, plan-mode protocol, defensive lane verification) to current knowledge.

## Durable Behavior Changes

### CLI Distribution (new domain)

- **`weave status` command**: new read-only Tier 1 command surfacing installed package version, per-skill drift state, and notices.
- **Notices system**: Tier 1 commands (`weave workspace`, `weave change current`, `weave change status`, `weave change new`, `weave status`) gain a stable top-level `--json notices` array. Non-Tier-1 commands are unchanged. Three v1 notice kinds: `package_outdated`, `skills_modified`, `skills_outdated`. A one-line stderr footer surfaces notices when stdout is a TTY and no opt-out is set. Opt-out via `NO_UPDATE_NOTIFIER=1` or `WEAVE_NO_NOTICES=1`.
- **Skill versioning**: every bundled `SKILL.md` carries a required `last_changed_in: <package-version>` frontmatter field. `.weave/agents.yml` gains a per-skill `installed_from` field. Drift states derived: `current`, `outdated`, `modified`, `modified+outdated`, `missing`. Hash-based modification detection (existing) is retained and complementary.
- **Release script**: `scripts/bump-skill-versions.mjs` (exposed as `npm run release:bump-skills`) maintains `last_changed_in` by diffing `templates/skills/**` against the previously published git tag. Never commits, tags, or pushes.
- **npm version cache**: `~/.weave/cache/npm-version.json` with a 24-hour TTL; background refresh on stale; 3s `AbortController` timeout per fetch.

### Change Workflow (existing domain, expanded)

- **Lifecycle progress flags (new CLI levers)**: `weave change progress <lane>` accepts `--no-invalidate` (skip all stale propagation) and `--invalidate=<comma-lanes>` (propagate to a named subset of transitive dependents only). The two are mutually exclusive. Default behavior (no flags) is unchanged: every transitive dependent is marked stale.
- **`weave change clear-stale <lane> --reason "..."`**: new subcommand. Removes a stale flag and appends a structured entry to `status.yml.stale_history` (lane, invalidated_by, invalidated_at, cleared_at, reason). `stale_history` is append-only and survives across progress and clear-stale calls.
- **Lifecycle Staleness Verification Protocol**: byte-identical `# Lifecycle Staleness Verification` section embedded in `weave-prd`, `weave-architect`, `weave-clarify`, `weave-issues`, `weave-capture`. The protocol instructs the agent to read structural dependents and decide per-lane whether the upstream change invalidates each dependent before calling `progress`, then to clear previously-stale dependents that are now in content sync with `--reason`. Pessimistic default applies when uncertain.
- **Plan Mode Guard (strengthened, narrowed to two skills)**: this change initially shipped a two-phase `# Plan Mode Protocol` in all four design-discussion skills (`weave-explore`, `weave-prd`, `weave-architect`, `weave-clarify`); QF1/T12 reverted that. The corrected behavior is a strengthened byte-identical `# Plan Mode Guard` in only the two plan-mode-required skills (`weave-explore`, `weave-architect`). The guard refuses non-Plan-Mode entry and explicitly authorizes `weave artifact current set <lane> --json` as a Plan-Mode-safe lane-commit (because it writes local session state only, not a repo-tracked artifact). `weave-prd` and `weave-clarify` run in Agent Mode and do not carry the guard; they call `weave artifact current set` (where applicable) in their normal body flow without ceremony.
- **Defensive Lane Verification in `weave-capture`**: `weave-capture` compares the resolved lane against the dominant subject of the conversation and explicitly asks the user when they disagree. Recovery path for any missed upstream lane-commit (e.g. a plan-mode-required skill invoked outside Plan Mode).
- **`# Surface Weave Notices` skill contract**: byte-identical block embedded in all 10 bundled skills, telling the agent to surface notices verbatim and never run package-manager commands directly.

## Affected Knowledge Areas

- New domain `cli-distribution/` with three features: `notices`, `skill-versioning`, `weave-status`.
- New `change-workflow/domain-wide/` files: `lifecycle-progress-and-staleness.md`, `plan-mode-guard.md`.
- New `change-workflow/features/weave-capture/behavior.md` feature file.
- Existing `change-workflow/features/weave-issues/behavior.md`: Change History entry and an `Integrations And Side Effects` addition noting protocol participation.
- Existing `change-workflow/index.md`: features and domain-wide listings extended; cross-reference to `cli-distribution` added.
- Existing `wiki/knowledge/index.md`: domains section now lists `change-workflow` and `cli-distribution`.

## Knowledge Files Updated

- `wiki/knowledge/index.md` (updated)
- `wiki/knowledge/domains/change-workflow/index.md` (updated)
- `wiki/knowledge/domains/change-workflow/features/weave-issues/behavior.md` (updated)
- `wiki/knowledge/domains/change-workflow/features/weave-capture/behavior.md` (created)
- `wiki/knowledge/domains/change-workflow/domain-wide/lifecycle-progress-and-staleness.md` (created)
- `wiki/knowledge/domains/change-workflow/domain-wide/plan-mode-guard.md` (created; replaces an interim `plan-mode-protocol.md` removed in QF1/T12)
- `wiki/knowledge/domains/cli-distribution/index.md` (created)
- `wiki/knowledge/domains/cli-distribution/features/notices/behavior.md` (created)
- `wiki/knowledge/domains/cli-distribution/features/skill-versioning/behavior.md` (created)
- `wiki/knowledge/domains/cli-distribution/features/weave-status/behavior.md` (created)

## No-Impact Rationale

Not applicable. This change introduced multiple durable behaviors across two domains.

## Source Evidence

CLI distribution:

- `src/lib/notices.ts`, `src/lib/with-notices.ts`, `src/lib/npm-version.ts`, `src/lib/status.ts`, `src/lib/user-paths.ts`
- `src/commands/status.ts`, `src/commands/workspace.ts`, `src/commands/change.ts` (Tier 1 wiring)
- `src/lib/agent-skills.ts` (`parseSkillFrontmatter`, `DefaultSkill.lastChangedIn`, `ManifestEntry.installed_from`, `setManifestEntry`, `loadAgentsManifest`)
- `src/lib/skill-template-checks.ts` (`EXPECTED_NOTICE_BOILERPLATE`, `EXPECTED_PLAN_MODE_GUARD`, `EXPECTED_LIFECYCLE_SYNC_PROTOCOL`)
- `scripts/bump-skill-versions.mjs`; `package.json` `release:bump-skills`
- Templates: every `templates/skills/<name>/SKILL.md` carries `last_changed_in: 0.1.0` and the notice block; the two plan-mode-required skills (`weave-explore`, `weave-architect`) carry the strengthened Plan Mode Guard; five progress-calling skills carry the lifecycle-sync block.
- Tests: `tests/notices.test.ts`, `tests/with-notices.test.ts`, `tests/cli-status.test.ts`, `tests/cli-tier1-notices.test.ts`, `tests/npm-version.test.ts`, `tests/agent-skills.test.ts`, `tests/bump-skill-versions.test.ts`

Change workflow:

- `src/lib/changes.ts` (`progressChange`, `resolveStalePropagationTargets`, `clearChangeStaleness`, `parseStaleHistory`, `transitiveDependents`)
- `src/commands/change.ts` (`progress` subcommand flags, `clear-stale` subcommand, `parseInvalidateList`)
- Templates: `templates/skills/weave-capture/SKILL.md` (Defensive Lane Verification); `templates/skills/weave-{explore,architect}/SKILL.md` (Plan Mode Guard, strengthened in QF1/T12); `templates/skills/weave-{prd,architect,clarify,issues,capture}/SKILL.md` (Lifecycle Staleness Verification)
- Tests: `tests/cli-change-staleness.test.ts`, `tests/agent-skills.test.ts` (byte-identity and non-presence assertions)

## Follow-Up Knowledge Work

- Consider per-skill feature behavior files for `weave-prd`, `weave-architect`, `weave-clarify`, `weave-explore` if any of them gains skill-specific behavior beyond the shared protocols. v1 documents them under `domain-wide/`.
- Optional `change-workflow/source-map.md` summarizing all `src/commands/change.ts` and `src/lib/changes.ts` surfaces in one place.
- Optional `cli-distribution/source-map.md` summarizing the install/update/reset/diff command surfaces alongside `weave status` and the notice plumbing.
- Decide whether `stale_history` should be size-bounded (currently grows unbounded).
- Decide whether to expose a separate `skills_new` notice kind for brand-new bundled skills (currently rolled into `skills_outdated`).
