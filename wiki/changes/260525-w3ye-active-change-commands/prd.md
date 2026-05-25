# Active Change Commands PRD

## Problem Statement

Users can create and propagate Weave changes, but once multiple changes exist, it is difficult to know which change is currently active in a repo or across a multi-repo workspace. Users and agents currently have to infer active work from branch names, folder names, or memory from the discussion. That creates ambiguity when switching between changes, continuing work later, propagating a change to another repo, or checking whether the current git branch matches the change being worked on.

From the user's perspective, Weave needs to answer simple workflow questions directly: "What changes exist?", "Which change am I working on?", "Can I switch to this other change?", "Is my active change aligned with my current branch?", and "Which repos in my workspace are currently participating in this change?"

The lack of an explicit active-change workflow is especially painful for agent-assisted development. Agents need a reliable way to discover the active change before creating artifacts, continuing implementation, or propagating work. Without that, agents may create duplicate changes, update the wrong change folder, or work on a branch that does not match the intended change.

## Solution

Add active change commands under `weave change` so users and agents can list changes, switch between them, inspect the current change, and check status.

Weave will track active change state in the local workspace session, per workspace folder. This state is local to the developer's machine and is not committed to the repo. A change can be active in one repo, multiple repos, or no repos, depending on the current workspace and propagation flow.

The first version will add:

- `weave change list [target|all] [--json]`
- `weave change switch <change> [--json]`
- `weave change current [target|all] [--json]`
- `weave change status [change] [--target <target|all>] [--json]`

`weave change new` will make the newly-created change current for every target. `weave change propagate` will make the propagated change current only in destination repos. `weave change current` and `weave change status` will self-heal missing active state when the current branch clearly maps to a known change. When saved active state and branch state disagree, Weave will block mutating commands that depend on active context and tell the user how to resolve the mismatch explicitly.

## User Stories

1. As a developer, I want to list changes in my current repo, so that I can see what planning work already exists.

2. As a developer, I want listed changes sorted newest first, so that the most recent work is easiest to find.

3. As a developer, I want the active change marked in the change list, so that I can immediately see what I am currently working on.

4. As a developer, I want `weave change list` to stay visually clean, so that I can scan changes without being distracted by branch diagnostics.

5. As a developer, I want to list changes across all workspace folders, so that I can understand active work across a multi-repo task.

6. As a developer, I want `weave change list all` to group changes by workspace folder, so that I can tell which repo each change belongs to.

7. As a developer, I want to create a new change and have it become current automatically, so that I can continue working without running a second command.

8. As a developer, I want `weave change new` to allow existing uncommitted edits, so that I can formalize work I already started into a tracked change.

9. As a developer, I want active change state to be local to my workspace session, so that my active work does not affect other developers.

10. As a developer, I want active change state tracked per workspace folder, so that different repos can have different current changes.

11. As a developer, I want a propagated change to become current in the destination repo, so that the destination repo is ready to participate in the change.

12. As a developer, I want propagation to leave the source repo's active change unchanged, so that copying a change to another repo does not steal focus from my current source work.

13. As a developer, I want propagation to copy only change planning artifacts, so that I do not accidentally copy source code edits, commits, staged files, or patches.

14. As a developer, I want propagation to create or check out the matching change branch in destination repos, so that planning artifacts and git context are aligned.

15. As a developer, I want propagation to block when a destination repo has uncommitted changes, so that unrelated local work is not mixed into the propagated change context.

16. As a developer, I want to switch to a change by full change id, so that I can precisely select the intended change.

17. As a developer, I want to switch to a change by its 4-character token, so that common switching is faster.

18. As a developer, I want to switch to a change by unique slug or title text, so that I do not need to copy the full id.

19. As a developer, I want ambiguous switch references to fail with a clear message, so that Weave does not select the wrong change.

20. As a developer, I want missing switch references to fail clearly, so that I know the change does not exist in the selected target.

21. As a developer, I want switching to check out the change's expected branch, so that my git branch matches my active change.

22. As a developer, I want switching to create the expected branch when it does not exist, so that I can continue a known change without manual branch setup.

23. As a developer, I want switching to update active session state only after branch checkout succeeds, so that active state does not claim a switch happened when it failed.

24. As a developer, I want switching to block when the worktree has uncommitted changes, so that edits from one change do not accidentally follow me into another change.

25. As a developer, I want switching in a non-git folder to update active change state and report branch work as skipped, so that Weave can still be useful outside git repos.

26. As a developer, I want to ask for the current change in my repo, so that I can orient myself before continuing work.

27. As a developer, I want `weave change current` to show the change id, title, type, stage, branch, and path, so that I have the key context in one command.

28. As a developer, I want `weave change current` to report when no active change exists, so that I know I need to create or switch to one.

29. As a developer, I want `weave change current` to infer active state from a matching `change/{id}` branch when no session pointer exists, so that manual git checkout can still be understood by Weave.

30. As a developer, I want inferred active state to be saved when there is no conflicting session state, so that future commands can rely on the current session.

31. As a developer, I want `weave change current all` to show the active change in each workspace folder, so that I can understand the whole workspace at once.

32. As a developer, I want `weave change current all` to self-heal missing active state across matching workspace branches, so that the workspace session catches up to the actual branch layout.

33. As a developer, I want self-healing output to say when it saved active state, so that I know local session metadata changed.

34. As a developer, I want `weave change status` to show the active change's metadata, so that I can verify what Weave thinks I am working on.

35. As a developer, I want `weave change status` to show whether the current git branch matches the expected change branch, so that I can catch branch/context drift.

36. As a developer, I want `weave change status <change>` to inspect a specific change without switching to it, so that I can review another change safely.

37. As a developer, I want explicit status inspection to avoid changing active state, so that read-only inspection does not unexpectedly change my workflow.

38. As a developer, I want `status` to stay focused on metadata and branch alignment, so that it remains predictable and easy to interpret.

39. As a developer, I want inactive branch diagnostics kept out of the default list view, so that list remains an index rather than a health report.

40. As a developer, I want mutating commands to block when saved active state and the current branch point to different changes, so that Weave does not guess where work should happen.

41. As a developer, I want mismatch errors to show both the saved active change and the branch-inferred change, so that I can understand the conflict.

42. As a developer, I want mismatch errors to tell me to run `weave change switch <id>`, so that I have an explicit path to resolve the conflict.

43. As a developer, I want `weave change switch` to be the explicit way to resolve active-context conflicts, so that context changes are intentional.

44. As a developer, I want active change state to avoid committed repo files, so that my local workflow state does not appear in pull requests.

45. As a developer, I want committed `.weave/` metadata to remain focused on shared sync and agent install manifests, so that local active state does not mix with shared project metadata.

46. As an agent, I want to run `weave change current` before continuing work, so that I can find the correct active change without relying on conversation memory.

47. As an agent, I want to run `weave change status` before mutating artifacts, so that I can detect branch/context mismatches before editing files.

48. As an agent, I want JSON output for `list`, `switch`, `current`, and `status`, so that I can parse results reliably.

49. As an agent, I want JSON errors for ambiguity, missing changes, dirty worktrees, and context mismatches, so that I can stop safely and report the right next step.

50. As an agent, I want `weave change list all --json` to include workspace grouping, so that I can reason about multi-repo tasks programmatically.

51. As an agent, I want `weave change current all --json` to include which session entries were inferred or saved, so that I can distinguish existing state from self-healed state.

52. As an agent, I want `weave change status --target all --json` to report branch alignment per folder, so that I can avoid applying work to the wrong repo.

53. As an agent, I want switch failures to leave session state unchanged, so that retry logic does not operate on incorrect active state.

54. As an agent, I want propagation to activate destination repos, so that follow-up implementation in those repos naturally uses the propagated change.

55. As an agent, I want propagation not to activate the source repo unless it was already active there, so that source context is not overwritten unexpectedly.

56. As a developer working across repos, I want each repo to have its own active change in the session, so that a frontend repo and backend repo can be on different changes when needed.

57. As a developer working across repos, I want the same change to be active in multiple repos after propagation, so that a cross-repo change can be coordinated.

58. As a developer working across repos, I want `all` commands to be explicit in their output, so that I can tell which repo each result describes.

59. As a developer returning to a workspace, I want Weave to recover active state from existing change branches, so that I can resume work without remembering prior commands.

60. As a developer returning to a workspace, I want Weave to avoid overwriting conflicting active state, so that stale or surprising branch checkouts do not silently change my current work.

61. As a developer, I want `weave change status` to work even when I pass a specific change, so that I can inspect old or inactive changes without making them current.

62. As a developer, I want change status to include the change path, so that I can open or edit the right change artifacts quickly.

63. As a developer, I want change status to include the stage, so that I know whether a change is still exploratory or ready for implementation.

64. As a developer, I want change status to include the type, so that I can distinguish capability work from fixes, refactors, docs, tests, CI, and chores.

65. As a developer, I want target arguments to accept current session folder ids, so that I do not have to type full paths for workspace repos.

66. As a developer, I want target arguments to accept paths, so that I can work with repos even when I do not remember their session ids.

67. As a developer, I want `all` to mean every folder in the current Weave session, so that workspace-wide commands have a predictable boundary.

68. As a developer, I want no-active-current output to be clear and non-alarming, so that an empty active state is understandable before any change is selected.

69. As a developer, I want dirty-worktree blocking messages to identify the affected repo, so that I know where cleanup is required.

70. As a developer, I want dirty-worktree blocking messages to leave the active change unchanged, so that Weave remains consistent after a failed command.

71. As a developer, I want branch checkout failures to preserve the previous active session state, so that failed git operations do not corrupt my local workflow.

72. As a developer, I want successful `switch` output to show the selected change and branch result, so that I know exactly what changed.

73. As a developer, I want successful `new` output to show that the new change is now current, so that I understand the next command context.

74. As a developer, I want successful `propagate` output to show which destination repos are now current for the change, so that I can continue work in the right places.

75. As a developer, I want command behavior to be consistent between text and JSON output, so that human and agent workflows share the same product semantics.
