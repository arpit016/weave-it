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
  const changesDir = path.join(wikiDir, "changes");
  const changesExisted = await pathExists(changesDir);

  await ensureDir(path.join(wikiDir, "knowledge"));
  await ensureDir(changesDir);
  await ensureDir(metadataDir);

  if (await writeFileIfMissing(path.join(metadataDir, "sync.yml"), syncTemplate(knowledgeIndex))) {
    created.push(".weave/sync.yml");
  }

  if (await writeFileIfMissing(path.join(wikiDir, "knowledge", "index.md"), knowledgeIndex)) {
    created.push("wiki/knowledge/index.md");
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
