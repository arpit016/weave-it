# Tasks: Explicit Change Stage And Stale Downstream Artifacts

## 1. Add lifecycle schema and `weave change progress`

Type: AFK
Blocked by: None
Status: done

Build the change-level lifecycle model, stale metadata parsing, `weave change progress <lane> --json`, status/current stale output, backward-compatible reads, and core tests.

Acceptance criteria:

- [x] `status.yml.stage` supports `exploration`, `prd`, `architecture`, and `issues`.
- [x] `weave change progress <lane> --json` advances to the highest reached lane.
- [x] Upstream progress marks reached downstream lanes stale with `invalidated_by` and `invalidated_at`.
- [x] Refreshing a stale lane clears only that lane.
- [x] Existing changes without `stale` remain readable.
- [x] Status/current JSON and human output expose stale lanes.

## 2. Make artifact-writing skills advance lifecycle

Type: AFK
Blocked by: 1
Status: done

Update canonical and installed skill templates so exploration, PRD, architecture, capture, clarify, and issues flows call the progress helper only after successful live artifact writes.

Acceptance criteria:

- [x] Artifact-writing skill templates mention the correct `weave change progress` command.
- [x] Session-only capture explicitly does not progress lifecycle.
- [x] Installed `.agents` and `.claude` skill copies stay aligned with templates.

## 3. Make `weave-next` stale-first

Type: AFK
Blocked by: 1
Status: done

Update `weave-next` guidance to read stale state, choose the earliest stale lane, and recommend refresh before forward progress.

Acceptance criteria:

- [x] `weave-next` reads `status.yml`.
- [x] `weave-next` recommends the earliest stale lane before forward pipeline progress.
- [x] Template tests cover stale-first guidance.

## 4. Gate stale architecture in `weave-issues`

Type: AFK
Blocked by: 1
Status: done

Update issue-generation guidance so stale architecture triggers a warning and explicit confirmation before continuing, then records `issues` progress only after task or issue evidence is created.

Acceptance criteria:

- [x] `weave-issues` reads `status.yml` when available.
- [x] Stale architecture triggers warning and explicit confirmation before issue creation.
- [x] Issue/task creation records `weave change progress issues --json`.

## 5. Document and verify lifecycle behavior

Type: AFK
Blocked by: 1, 2, 3, 4
Status: done

Update README command docs and run the full verification set.

Acceptance criteria:

- [x] README documents `weave change progress`.
- [x] `npm run test` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run build` passes.
