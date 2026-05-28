# Add Weave Next Skill Tasks

Generated from `prd.md` and `architecture.md` on 2026-05-28.

External issue publishing status: not published. GitHub CLI and issue-tracker credentials were unavailable in this environment.

## Issue 1: Bundle `weave-next` as a read-only advisory skill

Type: AFK

Blocked by: None - can start immediately

User stories covered: 1, 2, 3, 4, 5, 6, 7, 8

### What to build

Add `weave-next` as a bundled Agent Skill that answers what to do next for the active Weave change. The skill should inspect the active change, branch health, live artifact state, current artifact context when valid, and recent session resume notes, then recommend the next command without mutating files or invoking other skills.

The recommendation should preserve the difference between resuming the current artifact lane and moving forward through the pipeline. When a valid current artifact context has a latest resume point, that resume command should be primary. When forward progress differs, show the forward pipeline command as the alternate step.

### Acceptance criteria

- [x] `weave-next` is available as a bundled skill for Codex, Cursor, and Claude installs.
- [x] The skill is explicitly read-only and advisory.
- [x] The skill has no Plan Mode guard.
- [x] The skill does not write artifacts, set artifact context, advance lifecycle state, or invoke other skills.
- [x] The skill scopes analysis to targets whose current change matches the active change.
- [x] The skill reads live artifacts as canonical current truth before using session notes.
- [x] The skill uses latest relevant `Next Resume Point` session context when present.
- [x] The skill emits the fixed headings: `Current Change`, `Artifact State`, `Resume Context`, `Recommended Next Step`, `Alternate Pipeline Step`, `Reason`, and `Optional Checkpoint`.
- [x] The skill recommends the correct pipeline step for missing or not-ready exploration, missing PRD, missing architecture, missing issues, and implementation handoff readiness.
- [x] Tests cover the bundled skill metadata, read-only behavior, active-change scoping, live-artifact-first behavior, resume point behavior, fixed output headings, and install coverage.

## Issue 2: Expose `weave-next` through opencode and docs

Type: AFK

Blocked by: Issue 1

User stories covered: 1, 2, 6

### What to build

Expose `weave-next` consistently across user-facing skill surfaces. opencode should receive a `/weave-next` wrapper that delegates to the portable skill, and documentation should show `weave-next` alongside the other Weave skills so users can discover it as the orientation command.

The docs should keep the user-facing model clear: `weave-next` recommends what to run next, while lane skills such as `weave-prd`, `weave-architect`, and `weave-issues` do the actual work.

### Acceptance criteria

- [x] opencode installs a `/weave-next` command wrapper.
- [x] opencode install/update/reset behavior treats `/weave-next` consistently with the other managed command wrappers.
- [x] CLI skill list/show tests include `weave-next`.
- [x] Agent install tests assert `weave-next` is installed for opencode.
- [x] README skill lists include `weave-next`.
- [x] README examples explain that `weave-next` is advisory and read-only.
- [x] Full test suite and typecheck pass.
