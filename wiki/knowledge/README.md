# Knowledge Structure

This folder contains current-state behavioral specs. Historical change provenance belongs in `wiki/changes/**`.

Use this progressive structure:

```text
wiki/knowledge/
  index.md
  README.md
  domains/
    README.md
    <domain>/
      index.md
      overview.md
      glossary.md
      source-map.md
      features/
        <feature>/
          behavior.md
          decision-tables.md
          lifecycle.md
          permissions.md
          source-map.md
      domain-wide/
        lifecycle.md
        permissions.md
        visibility.md
        notifications.md
        approvals.md
        edge-cases.md
  shared/
    README.md
    <shared-behavior>/
      behavior.md
      source-map.md
```

- `domains/` contains product or system areas users naturally name.
- `features/` contains independently understandable behavior inside a domain.
- `domain-wide/` contains behavior that coordinates multiple features inside one domain.
- `shared/` contains behavior reused across multiple domains.

## Guided Templates

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

`Purpose`, `Current Behavior`, `Source Anchors`, and `Change History` are strongly recommended. Other sections may be omitted when they do not apply.

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

`knowledge-delta.md` lives under `wiki/changes/<change-id>/` and bridges one change to current knowledge:

```md
# Knowledge Delta

## Durable Behavior Changes
## Affected Knowledge Areas
## Knowledge Files Updated
## No-Impact Rationale
## Source Evidence
## Follow-Up Knowledge Work
```
