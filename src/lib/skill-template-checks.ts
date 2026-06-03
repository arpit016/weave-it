export const EXPECTED_NOTICE_BOILERPLATE = `# Surface Weave Notices

Every Weave skill discovery phase calls at least one Tier 1 command
(\`weave workspace\`, \`weave change current\`, \`weave change status\`,
\`weave change new\`, or \`weave status\`). Tier 1 commands return a stable
\`notices\` array in their \`--json\` output describing outdated packages,
modified skills, and skills that need updating.

When you run any Tier 1 command (with or without \`--json\`) and the result
contains a non-empty \`notices\` array, surface them to the user verbatim
near the start of your response. Do not edit notice text. Do not suppress
notices unless the user explicitly asks. Do not invent notices.

If notices recommend \`weave status\`, suggest the user run it. If notices
recommend \`weave agent update\`, suggest that. Do not run \`npm i -g\` or
any package manager command yourself; let the user run it.

If \`WEAVE_NO_NOTICES=1\` is set in the environment, the notices array will
be empty by design and you should not warn about it.
` as const;

export const EXPECTED_PLAN_MODE_GUARD = `# Plan Mode Guard

This skill must run in Plan Mode.

If the current environment exposes collaboration mode and it is not Plan Mode, stop immediately and say:

\`This skill must run in Plan Mode. Switch to Plan Mode, then invoke <skill-name> again.\`

Do not inspect deeply, ask discovery questions, update artifacts, or continue work before this guard passes.

Static Weave skill content cannot automatically switch collaboration mode. The host, user, or developer layer must switch modes before this skill continues.

In Plan Mode, this skill commits the active artifact lane to local Weave session state via:

\`\`\`bash
weave artifact current set <lane> --json
\`\`\`

This writes local Weave session state only. It does not write repo-tracked artifacts and IS allowed in Plan Mode. Call it after resolving the active Weave change and before any other discovery work.

Do not write repo-tracked artifacts directly. Produce the plan, decisions, questions, or proposed artifact changes needed for the user to approve. Actual artifact writes happen only after the user exits Plan Mode and asks to implement the plan.
` as const;

export const EXPECTED_LIFECYCLE_SYNC_PROTOCOL = `# Lifecycle Staleness Verification

Before calling \`weave change progress\`, verify content-sync of every artifact
that would otherwise be marked stale by the default pessimistic propagation.

The \`--source\` arguments of \`weave change progress\` declare causal influence,
not strict-DAG dependency. Pessimistic staleness propagation is the safe default,
not the only correct answer. When the clarification this skill just performed is
narrowly contained (a typo fix, a sentence rewording, an open-question
resolution), dependents may already be in content sync; flagging them stale
creates churn the user did not ask for.

Procedure:

1. Identify the set of structural dependents of the lane being progressed. Read
   \`wiki/changes/<change-id>/status.yml\` and compute which lanes list this
   lane in their \`artifacts.<lane>.sources\`.
2. For each dependent lane, read both the dependent artifact and the artifact
   just being progressed. Decide whether the change you just made invalidates
   the dependent's content. The judgement is binary per lane: invalidates, or
   does not invalidate.
3. Select the appropriate progress invocation:

   - Every dependent is invalidated (or there are no dependents):
     \`weave change progress <lane> --source <list> --json\` (default, no new flags)
   - No dependent is invalidated:
     \`weave change progress <lane> --source <list> --no-invalidate --json\`
   - Some dependents are invalidated, some are not:
     \`weave change progress <lane> --source <list> --invalidate=<comma-list> --json\`

4. If a previously-stale dependent is now in content sync (because the upstream
   change has been absorbed but the stale flag still lingers from an earlier
   pessimistic propagation), clear it explicitly:

   \`weave change clear-stale <lane> --reason "<one-sentence verification>" --json\`

   Always pass \`--reason\` so the audit entry in \`stale_history\` carries the
   verification rationale. Do not clear flags without reading both artifacts.

5. Never edit \`status.yml\` by hand to manipulate stale state. Use the CLI.

Failure mode: if you are uncertain whether a dependent is in content sync,
prefer the pessimistic default (omit \`--no-invalidate\` and \`--invalidate\`).
The user can always run \`weave-clarify <lane>\` later. A false-positive stale
flag is recoverable; silently leaving a real downstream artifact mismatched is
not.
` as const;
