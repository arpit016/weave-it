# Tasks

## 1. Source-aware progress metadata

- Type: AFK
- Blocked by: None
- User stories covered: 5, 7

Add repeatable `--source` support to `weave change progress`, validate known source IDs, persist `status.yml.artifacts.<lane>.sources`, preserve existing status fields, and show a visible no-source note when no sources are provided.

## 2. Graph-based stale invalidation

- Type: AFK
- Blocked by: Task 1
- User stories covered: 5, 6, 7

Replace fixed lane-order invalidation with transitive dependency traversal over `status.yml.artifacts`, stop inferring upstream lanes from downstream artifact existence, and keep stale output compatible with the current `invalidated_by` shape.

## 3. Independent PRD and architecture lane skills

- Type: AFK
- Blocked by: Task 1
- User stories covered: 1, 2, 3, 5

Update `weave-prd`, `weave-architect`, `weave-capture`, and `weave-clarify` templates plus installed copies so PRD/architecture can be created without hard upstream prerequisites and lifecycle progress calls pass actual source IDs.

## 4. Type-aware next-step and issue guidance

- Type: AFK
- Blocked by: Task 2
- User stories covered: 2, 3, 4, 6

Update `weave-next` and `weave-issues` to use source-aware stale state and change-type-aware recommendations, including `weave change progress issues --source architecture` for issue/task generation.

## 5. Docs and compatibility cleanup

- Type: AFK
- Blocked by: Tasks 1-4
- User stories covered: 1, 4, 7

Update README and skill contract tests to document the graph-in-`status.yml` model, remove expectations for frontmatter `sources`, and clarify that `stage` is orientation rather than proof of a completed pipeline.

## 6. End-to-end lifecycle regression coverage

- Type: AFK
- Blocked by: Tasks 1-4
- User stories covered: 1-7

Add full lifecycle tests for direct architecture, PRD-backed architecture, transitive stale invalidation, no-source progress, unknown source rejection, issue default sources, and old status files without `artifacts`.
