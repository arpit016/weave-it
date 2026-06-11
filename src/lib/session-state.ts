import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { ArtifactName } from "./artifact-metadata.js";
import { ensureDir, pathExists, writeFileAtomic } from "./files.js";
import type { ResolvedFolder } from "./folders.js";
import { slugify, titleFromSlug } from "./ids.js";

export type SessionCurrentChange = {
  id: string;
  path: string;
  branch: string;
  updated_at: string;
};

export type SessionCurrentArtifact = {
  artifact: ArtifactName;
  change_id: string;
  path: string;
  updated_at: string;
};

export type SessionFolder = {
  path: string;
  name: string;
  kind: string;
  git_remote?: string;
  current_change?: SessionCurrentChange;
  current_artifact?: SessionCurrentArtifact;
};

export type CurrentSession = {
  version: 1;
  updated_at: string;
  folders: Record<string, SessionFolder>;
};

export type AddFolderResult = {
  added: boolean;
  id: string;
  session: CurrentSession;
};

export function defaultSessionPath(): string {
  if (process.env.WEAVE_SESSION_PATH) {
    return path.resolve(process.env.WEAVE_SESSION_PATH);
  }

  return path.join(os.homedir(), ".cache", "weave", "current-session.yml");
}

export async function loadCurrentSession(sessionPath = defaultSessionPath()): Promise<CurrentSession | undefined> {
  if (!(await pathExists(sessionPath))) {
    return undefined;
  }

  return YAML.parse(await readFile(sessionPath, "utf8")) as CurrentSession;
}

export async function saveCurrentSession(
  session: CurrentSession,
  sessionPath = defaultSessionPath(),
): Promise<void> {
  await ensureDir(path.dirname(sessionPath));
  await writeFileAtomic(sessionPath, YAML.stringify(session));
}

export function createCurrentSession(folder: ResolvedFolder, now: Date): CurrentSession {
  const session: CurrentSession = {
    version: 1,
    updated_at: now.toISOString(),
    folders: {},
  };

  addFolderToSession(session, folder, now);
  return session;
}

export function addFolderToSession(session: CurrentSession, folder: ResolvedFolder, now: Date): AddFolderResult {
  const existingId = findFolderByPath(session, folder.path);

  if (existingId) {
    session.updated_at = now.toISOString();
    return { added: false, id: existingId, session };
  }

  const id = uniqueFolderId(session, folder.id);
  const sessionFolder: SessionFolder = {
    path: folder.path,
    name: folder.name,
    kind: folder.kind,
  };

  if (folder.gitRemote) {
    sessionFolder.git_remote = folder.gitRemote;
  }

  session.folders[id] = sessionFolder;
  session.updated_at = now.toISOString();

  return { added: true, id, session };
}

export function findFolderByPath(session: CurrentSession, folderPath: string): string | undefined {
  return Object.entries(session.folders).find(([, folder]) => folder.path === folderPath)?.[0];
}

export function ensureFolderInSession(session: CurrentSession, folderPath: string, now: Date): string {
  const existingId = findFolderByPath(session, folderPath);
  if (existingId) {
    session.updated_at = now.toISOString();
    return existingId;
  }

  const basename = path.basename(folderPath);
  const id = uniqueFolderId(session, slugify(basename, "folder"));
  session.folders[id] = {
    path: folderPath,
    name: titleFromSlug(id) || basename,
    kind: "app",
  };
  session.updated_at = now.toISOString();
  return id;
}

function uniqueFolderId(session: CurrentSession, id: string): string {
  if (!session.folders[id]) {
    return id;
  }

  let index = 2;

  while (session.folders[`${id}-${index}`]) {
    index += 1;
  }

  return `${id}-${index}`;
}
