`behavior.md` is the core current-state spec:

```md
# <Feature Or Shared Behavior>

## Purpose
## Current Behavior
## Domain Model
## Configuration Dimensions
## Behavioral Rules
## Decision Tables
## Lifecycle
## Permissions And Visibility
## Integrations And Side Effects
## Edge Cases
## Invariants
## Source Anchors
## Change History
## Open Questions
```

Not every section must be populated. Strongly prefer `Purpose`, `Current Behavior`, `Source Anchors`, and `Change History`.

`decision-tables.md` is optional and focused on permutations:

```md
# <Feature> Decision Tables

## Table: <Scenario>

| Dimension | Value | Outcome |
| --- | --- | --- |

## Notes
## Source Anchors
```

`source-map.md` connects behavior to reality:

```md
# <Domain Or Feature> Source Map

## Core Product Surfaces
## Source Anchors
## Tests
## Config And Flags
## Jobs And Side Effects
## External Integrations
## Ownership Notes
```

`knowledge-delta.md` is the per-change bridge:

```md
# Knowledge Delta

## Durable Behavior Changes
## Affected Knowledge Areas
## Knowledge Files Updated
## No-Impact Rationale
## Source Evidence
## Follow-Up Knowledge Work
```
