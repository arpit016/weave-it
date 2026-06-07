import path from "node:path";
import YAML from "yaml";
import { ensureDir, pathExists, writeFileIfMissing } from "./files.js";
import { hashDocument } from "./sync.js";

export type ScaffoldResult = {
  wikiDir: string;
  metadataDir: string;
  created: string[];
};

export async function ensureWeaveScaffold(input: { folder: { path: string } }): Promise<ScaffoldResult> {
  const wikiDir = path.join(input.folder.path, "wiki");
  const metadataDir = path.join(input.folder.path, ".weave");
  const created: string[] = [];
  const knowledgeIndex = knowledgeIndexTemplate();
  const knowledgeReadme = knowledgeReadmeTemplate();
  const domainsReadme = domainsReadmeTemplate();
  const sharedReadme = sharedReadmeTemplate();
  const architectureConsiderations = architectureConsiderationsTemplate();
  const knowledgeDir = path.join(wikiDir, "knowledge");
  const changesDir = path.join(wikiDir, "changes");
  const changesExisted = await pathExists(changesDir);

  await ensureDir(knowledgeDir);
  await ensureDir(path.join(knowledgeDir, "domains"));
  await ensureDir(path.join(knowledgeDir, "shared"));
  await ensureDir(changesDir);
  await ensureDir(metadataDir);

  if (await writeFileIfMissing(path.join(metadataDir, "sync.yml"), syncTemplate(knowledgeIndex))) {
    created.push(".weave/sync.yml");
  }
  if (await writeFileIfMissing(path.join(metadataDir, "architecture-considerations.md"), architectureConsiderations)) {
    created.push(".weave/architecture-considerations.md");
  }

  if (await writeFileIfMissing(path.join(knowledgeDir, "index.md"), knowledgeIndex)) {
    created.push("wiki/knowledge/index.md");
  }
  if (await writeFileIfMissing(path.join(knowledgeDir, "README.md"), knowledgeReadme)) {
    created.push("wiki/knowledge/README.md");
  }
  if (await writeFileIfMissing(path.join(knowledgeDir, "domains", "README.md"), domainsReadme)) {
    created.push("wiki/knowledge/domains/README.md");
  }
  if (await writeFileIfMissing(path.join(knowledgeDir, "shared", "README.md"), sharedReadme)) {
    created.push("wiki/knowledge/shared/README.md");
  }

  if (!changesExisted) {
    created.push("wiki/changes/");
  }

  return { wikiDir, metadataDir, created };
}

function syncTemplate(knowledgeIndex: string): string {
  return YAML.stringify({
    version: 1,
    documents: {
      "knowledge.index": {
        path: "wiki/knowledge/index.md",
        hash: hashDocument(knowledgeIndex),
        status: "synced",
      },
    },
  });
}

function knowledgeIndexTemplate(): string {
  return `# Product Knowledge

This folder contains current product knowledge for this repo/folder.

## Domains

_Add product domains here as they become relevant._

Examples:
- Billing
- Permissions
- Onboarding
- Notifications
`;
}

function architectureConsiderationsTemplate(): string {
  return `# Architecture Considerations

This file is user-owned. Weave creates it once and never overwrites it.

Use this file to capture team-specific architecture guidance that agents should keep in mind when discussing technical design.

## Design Principles

- _Add preferred design principles here._

## Patterns To Prefer

- _Example: Prefer service objects for cross-domain workflows._

## Patterns To Avoid

- _Example: Avoid callback-driven cross-domain side effects._

## Data Access And Scaling

- _Example: Watch for N+1 queries in list/detail views._
- _Example: Prefer batched reads for high-cardinality associations._

## Caching And Consistency

- _Add caching rules, invalidation expectations, or consistency constraints._

## Async Boundaries And Events

- _Add guidance for jobs, queues, events, callbacks, or synchronous flows._

## Observability And Operations

- _Add logging, metrics, alerting, rollout, and failure-mode expectations._

## Notes For Agents

- Apply relevant guidance silently.
- Surface only constraints, conflicts, or risks that materially affect the design.
- Do not treat examples as mandatory unless this file says they are.
`;
}

function knowledgeReadmeTemplate(): string {
  return `# Knowledge Structure

This folder contains current-state behavioral specs. Historical change provenance belongs in \`wiki/changes/**\`.

Use this progressive structure:

\`\`\`text
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
\`\`\`

- \`domains/\` contains product or system areas users naturally name.
- \`features/\` contains independently understandable behavior inside a domain.
- \`domain-wide/\` contains behavior that coordinates multiple features inside one domain.
- \`shared/\` contains behavior reused across multiple domains.

## Guided Templates

\`behavior.md\` is the core current-state spec:

\`\`\`md
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
\`\`\`

\`Purpose\`, \`Current Behavior\`, \`Source Anchors\`, and \`Change History\` are strongly recommended. Other sections may be omitted when they do not apply.

\`decision-tables.md\` is optional and focused on permutations:

\`\`\`md
# <Feature> Decision Tables

## Table: <Scenario>

| Dimension | Value | Outcome |
| --- | --- | --- |

## Notes
## Source Anchors
\`\`\`

\`source-map.md\` connects behavior to reality:

\`\`\`md
# <Domain Or Feature> Source Map

## Core Product Surfaces
## Source Anchors
## Tests
## Config And Flags
## Jobs And Side Effects
## External Integrations
## Ownership Notes
\`\`\`

\`knowledge-delta.md\` lives under \`wiki/changes/<change-id>/\` and bridges one change to current knowledge:

\`\`\`md
# Knowledge Delta

## Durable Behavior Changes
## Affected Knowledge Areas
## Knowledge Files Updated
## No-Impact Rationale
## Source Evidence
## Follow-Up Knowledge Work
\`\`\`
`;
}

function domainsReadmeTemplate(): string {
  return `# Domains

Create one folder per product or system domain. A domain folder may start small and grow as behavior becomes heavier.

Recommended domain files:

- \`index.md\`: entry point and links to important specs
- \`overview.md\`: domain summary
- \`glossary.md\`: domain terms
- \`source-map.md\`: code, tests, flags, jobs, integrations, and ownership
- \`features/<feature>/behavior.md\`: feature-level current behavior
- \`domain-wide/*.md\`: behavior that coordinates multiple features in the domain
`;
}

function sharedReadmeTemplate(): string {
  return `# Shared Behavior

Use this folder for behavior reused across multiple domains, such as permissions, approvals, notifications, audit logs, privacy, retention, imports, exports, and integrations.

Prefer keeping behavior inside one domain until multiple domains depend on it. When behavior becomes shared, document the shared model here and the domain-specific integration inside the domain.
`;
}
