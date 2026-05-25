# Active Change Commands Implementation Plan

## Problem Statement

Weave can create and propagate change artifacts, but it cannot reliably answer which change is active in the current repo or across the current workspace. Users and agents have to infer active work from branches, folder names, or conversation context. That makes it easy to continue the wrong change, create duplicate planning artifacts, propagate into the wrong repo context, or miss a mismatch between the saved active change and the current git branch.

The implementation needs to make active change state explicit, workspace-aware, and safe to mutate. It should support human CLI workflows and machine-readable agent workflows without committing local active state to the repo.

## Solution

Add active change workflows to the `weave change` command family. The CLI will list known changes, switch active context, report the current change, and show metadata-focused status.

Active state will be stored in the local Weave session as a per-folder `current_change` entry. This keeps active state local to the developer while still supporting multi-repo workspaces. Creating a change will activate it for every target. Propagating a change will activate it for destination repos only. Current/status commands will self-heal missing session state when the current branch unambiguously maps to a known change. Mutating commands will block when session state and git branch state disagree.

## Implementation Phases

### Phase 1: Session Active State

- Extend the local session model so each folder can optionally store the active change id, relative change artifact location, expected branch, and last-updated timestamp.
- Add session helpers to read, update, and persist active change entries by workspace folder.
- Preserve compatibility with existing session files that do not yet have active change entries.
- Keep active state out of committed repo metadata.

### Phase 2: Change Discovery and Resolution

- Add change discovery that reads known change metadata for a target folder.
- Normalize discovered changes into a stable internal shape containing id, slug, title, type, stage, branch, artifact location, and timestamps when available.
- Add reference resolution for full change id, 4-character token, and unique slug/title substring.
- Return clear no-match and ambiguous-match failures without mutating session or git state.
- Add workspace target resolution for the current folder, a named session folder, an explicit folder path, and `all`.

### Phase 3: Active State and Git Context

- Add git context helpers for current branch, expected branch existence, branch checkout/creation, and dirty worktree detection.
- Implement branch-to-change inference for branches that match known change ids.
- Self-heal missing active session state from branch inference only when no active state exists and the branch maps unambiguously to a known change.
- Treat saved active state versus branch-inferred active state as a conflict when both exist and point to different known changes.
- Block mutating commands that depend on active context when that conflict exists, and tell the user to resolve it with an explicit switch.

### Phase 4: Command Behavior

- Implement `list` as a clean index of known changes, sorted newest first, grouped by workspace folder for `all`, and marked with an active indicator where applicable.
- Implement `current` as the primary orientation command. It should report current active state, no-active state, or inferred-and-saved state. For `all`, it should apply the same self-healing behavior to every matching workspace folder and report which entries were saved.
- Implement `status` as metadata-focused diagnostics. Without an explicit change, it reports the active change and branch alignment. With an explicit change, it inspects that change without switching or changing active state.
- Implement `switch` as the explicit context change command. It resolves the requested change, blocks on dirty worktree, checks out or creates the expected branch, and updates active session state only after git work succeeds.
- Update `new` so successful creation activates the new change for every target. It should continue to allow dirty worktrees.
- Update `propagate` so successful propagation activates the propagated change only for destination repos. It should block dirty destination repos before changing branch or session state.
- Keep text output concise and make JSON output include enough structured state for agents to distinguish active, inactive, inferred, saved, dirty, ambiguous, missing, and mismatch outcomes.

### Phase 5: Documentation and Agent Guidance

- Update user-facing command docs to describe `list`, `switch`, `current`, and `status`.
- Explain that active change state is local workspace/session state and is not committed.
- Update agent-facing guidance so agents check `current` or `status` before continuing existing change work.
- Clarify that propagation copies planning artifacts and active context into destination repos, not implementation files or commits.

## Implementation Decisions

- Active change state belongs to the local workspace session, not committed repo metadata.
- Active state is tracked per workspace folder, not globally for the entire workspace.
- The active session entry stores the change id, relative artifact location, expected branch, and timestamp.
- Existing session files without active state remain valid.
- `weave change new` activates the created change for all targets after successful artifact and branch creation.
- `weave change new` does not block dirty worktrees because it may be used to formalize work already started.
- `weave change propagate` activates destination repos only and leaves source active state unchanged.
- `weave change propagate` copies planning artifacts only. It does not copy implementation files, commits, staged files, or patches.
- `weave change switch` is the only explicit command for replacing active context with an existing change.
- `switch` updates session state only after branch checkout or creation succeeds.
- `switch` and `propagate` block on dirty affected repos to avoid mixing local edits across change contexts.
- `current` and default `status` may save inferred active state when no active state exists and the current branch maps unambiguously to a known change.
- Explicit `status <change>` inspects a change without switching or saving active state.
- If active session state and branch-inferred state point to different known changes, Weave reports a mismatch and refuses mutating commands that depend on active context.
- `list` is an index, not a health report. It marks the active change but does not show inactive branch diagnostics.
- `status` is the branch-alignment diagnostic command for this version.
- Reference resolution supports full id, 4-character token, and unique slug/title substring.
- Ambiguous and missing references are user-visible errors and must not mutate state.
- Text output is optimized for humans; JSON output is the contract for agents and scripts.

## Testing Decisions

- Tests should verify external behavior: command results, generated artifacts, session state changes, git branch outcomes, and JSON/text outputs. They should not assert private helper structure or internal call order.
- Existing change workflow tests provide the closest prior art: they use temporary directories, local git repos, generated change artifacts, parsed YAML metadata, and direct command/library execution.
- Session-state tests should cover backwards compatibility with session entries that do not have active change state.
- Change discovery tests should cover sorting, metadata parsing, missing optional metadata, and target resolution.
- Reference resolution tests should cover full id, 4-character token, unique slug/title substring, ambiguous matches, and missing matches.
- `new` tests should verify activation across one target and multiple targets, including dirty worktree allowance.
- `propagate` tests should verify destination-only activation, copied planning artifacts, dirty destination blocking, and unchanged source active state.
- `switch` tests should verify successful branch checkout/creation, dirty worktree blocking, non-git behavior, ambiguous references, missing references, and no session mutation after failure.
- `current` tests should verify active state reporting, no-active reporting, self-healing from matching branch, all-workspace grouping, and saved-state reporting.
- `status` tests should verify active status, explicit change inspection without activation, branch match/mismatch reporting, all-workspace reporting, and metadata-only scope.
- JSON tests should verify stable machine-readable fields for successful results and failure cases that agents must handle.
- CLI-level tests should cover representative text output, while lower-level tests can cover detailed behavior around session state, git state, and change metadata.

## Out of Scope

- Do not add implementation progress tracking to `status`.
- Do not add inactive branch diagnostics to default `list`.
- Do not add `list --verbose` in this version.
- Do not create or use a repo-local active pointer file.
- Do not commit active change state to the repo.
- Do not change the existing change id format.
- Do not change the default `exploration.md` and `status.yml` artifact creation model.
- Do not make `propagate` copy implementation files, commits, staged files, or patches.
- Do not add interactive prompts for mismatch resolution in this version.
- Do not make `current` or default `status` overwrite conflicting active session state.
- Do not add remote branch or pull request awareness.
- Do not add lifecycle stages beyond the existing status metadata model.
