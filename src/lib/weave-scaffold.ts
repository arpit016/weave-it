import path from "node:path";
import YAML from "yaml";
import { ensureDir, pathExists, writeFileIfMissing } from "./files.js";
import type { ResolvedFolder } from "./folders.js";
import { hashDocument } from "./sync.js";

export type ScaffoldResult = {
  weaveDir: string;
  created: string[];
};

export async function ensureWeaveScaffold(input: { folder: ResolvedFolder; now: Date }): Promise<ScaffoldResult> {
  const weaveDir = path.join(input.folder.path, "weave");
  const created: string[] = [];
  const timestamp = input.now.toISOString();
  const knowledgeIndex = knowledgeIndexTemplate();
  const featuresDir = path.join(weaveDir, "features");
  const featuresExisted = await pathExists(featuresDir);

  await ensureDir(path.join(weaveDir, "knowledge"));
  await ensureDir(featuresDir);

  if (await writeFileIfMissing(path.join(weaveDir, "local.yml"), localTemplate(input.folder, timestamp))) {
    created.push("weave/local.yml");
  }

  if (await writeFileIfMissing(path.join(weaveDir, "sync.yml"), syncTemplate(knowledgeIndex))) {
    created.push("weave/sync.yml");
  }

  if (await writeFileIfMissing(path.join(weaveDir, "knowledge", "index.md"), knowledgeIndex)) {
    created.push("weave/knowledge/index.md");
  }

  if (!featuresExisted) {
    created.push("weave/features/");
  }

  return { weaveDir, created };
}

function localTemplate(folder: ResolvedFolder, timestamp: string): string {
  const local: {
    version: number;
    folder: {
      id: string;
      name: string;
      kind: string;
      git_remote?: string;
    };
    created_at: string;
  } = {
    version: 1,
    folder: {
      id: folder.id,
      name: folder.name,
      kind: folder.kind,
    },
    created_at: timestamp,
  };

  if (folder.gitRemote) {
    local.folder.git_remote = folder.gitRemote;
  }

  return YAML.stringify(local);
}

function syncTemplate(knowledgeIndex: string): string {
  return YAML.stringify({
    version: 1,
    documents: {
      "knowledge.index": {
        path: "weave/knowledge/index.md",
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
