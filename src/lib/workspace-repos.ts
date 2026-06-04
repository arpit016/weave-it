import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { realpath } from "node:fs/promises";
import YAML from "yaml";
import { pathExists } from "./files.js";
import { slugify } from "./ids.js";

const GIT_URL_PATTERN = /^(git@|https?:\/\/|ssh:\/\/|git:\/\/|file:\/\/)/i;

export type WorkspaceRepoEntry = {
  path: string;
  kind: string;
  remote?: string;
};

export type WorkspaceMetadata = {
  version?: number;
  mode?: string;
  name?: string;
  repos: Record<string, WorkspaceRepoEntry>;
};

export function isGitUrl(input: string): boolean {
  return GIT_URL_PATTERN.test(input.trim());
}

export function repoNameFromUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  const lastSegment = trimmed.split("/").pop() ?? trimmed;
  const withoutGit = lastSegment.replace(/\.git$/i, "");
  return withoutGit || "repo";
}

export async function isInsideWorkspace(workspacePath: string, candidatePath: string): Promise<boolean> {
  const resolvedWorkspace = await realpath(workspacePath);
  const resolvedCandidate = await realpath(candidatePath);
  const relative = path.relative(resolvedWorkspace, resolvedCandidate);

  if (relative === "") {
    return true;
  }

  if (path.isAbsolute(relative)) {
    return false;
  }

  return !relative.startsWith(`..${path.sep}`) && relative !== "..";
}

export function relativeRepoPath(workspacePath: string, repoAbsolutePath: string): string {
  const relative = path.relative(workspacePath, repoAbsolutePath);
  return relative.split(path.sep).join("/");
}

export function gitignoreEntryForRelativePath(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join("/").replace(/^\/+/, "").replace(/\/+$/, "");
  return `/${normalized}/`;
}

export async function readWorkspaceMetadata(workspacePath: string): Promise<WorkspaceMetadata | undefined> {
  const workspaceYmlPath = path.join(workspacePath, ".weave", "workspace.yml");
  if (!(await pathExists(workspaceYmlPath))) {
    return undefined;
  }

  try {
    const parsed = YAML.parse(await readFile(workspaceYmlPath, "utf8")) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    const repos = parseRepos(parsed.repos);
    return {
      version: typeof parsed.version === "number" ? parsed.version : undefined,
      mode: typeof parsed.mode === "string" ? parsed.mode : undefined,
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      repos,
    };
  } catch {
    return undefined;
  }
}

function parseRepos(value: unknown): Record<string, WorkspaceRepoEntry> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const repos: Record<string, WorkspaceRepoEntry> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const repoPath = typeof record.path === "string" ? record.path : undefined;
    const kind = typeof record.kind === "string" ? record.kind : undefined;
    if (!repoPath || !kind) {
      continue;
    }
    repos[id] = {
      path: repoPath,
      kind,
      ...(typeof record.remote === "string" ? { remote: record.remote } : {}),
    };
  }
  return repos;
}

export function findRegisteredRepoByPath(
  metadata: WorkspaceMetadata,
  relativePath: string,
): string | undefined {
  const normalized = normalizeRepoPath(relativePath);
  return Object.entries(metadata.repos).find(([, entry]) => normalizeRepoPath(entry.path) === normalized)?.[0];
}

function normalizeRepoPath(repoPath: string): string {
  return repoPath.split(path.sep).join("/").replace(/^\/+/, "").replace(/\/+$/, "");
}

export async function appendGitignoreEntry(workspacePath: string, relativePath: string): Promise<void> {
  const gitignorePath = path.join(workspacePath, ".gitignore");
  const entry = gitignoreEntryForRelativePath(relativePath);
  const existing = (await pathExists(gitignorePath)) ? await readFile(gitignorePath, "utf8") : "";
  const lines = existing.split("\n");

  if (lines.some((line) => line.trim() === entry.trim())) {
    return;
  }

  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  const prefix = existing.length > 0 ? separator : "";
  await writeFile(gitignorePath, `${existing}${prefix}${entry}\n`);
}

export async function registerRepoInWorkspaceMetadata(
  workspacePath: string,
  input: { id: string; relativePath: string; kind: string; remote?: string },
): Promise<void> {
  const workspaceYmlPath = path.join(workspacePath, ".weave", "workspace.yml");
  const metadata = (await readWorkspaceMetadata(workspacePath)) ?? {
    version: 1,
    mode: "workspace",
    name: path.basename(workspacePath),
    repos: {},
  };

  const normalizedPath = normalizeRepoPath(input.relativePath);
  const existing = metadata.repos[input.id];
  if (existing && normalizeRepoPath(existing.path) !== normalizedPath) {
    throw new Error(
      `Workspace repo id "${input.id}" is already registered for a different path (${existing.path}). Pass --id with a different value.`,
    );
  }

  const collision = Object.entries(metadata.repos).find(
    ([id, entry]) => id !== input.id && normalizeRepoPath(entry.path) === normalizedPath,
  );
  if (collision) {
    throw new Error(`Path is already registered in workspace as "${collision[0]}".`);
  }

  metadata.repos[input.id] = {
    path: normalizedPath,
    kind: input.kind,
    ...(input.remote ? { remote: input.remote } : {}),
  };

  await writeFile(
    workspaceYmlPath,
    YAML.stringify({
      version: metadata.version ?? 1,
      mode: metadata.mode ?? "workspace",
      name: metadata.name ?? path.basename(workspacePath),
      repos: metadata.repos,
    }),
  );
}

export type RegisterRepoIntoWorkspaceInput = {
  workspacePath: string;
  id: string;
  relativePath: string;
  kind: string;
  remote?: string;
};

export type RegisterRepoIntoWorkspaceResult = {
  id: string;
  relativePath: string;
};

export async function registerRepoIntoWorkspace(
  input: RegisterRepoIntoWorkspaceInput,
): Promise<RegisterRepoIntoWorkspaceResult> {
  await appendGitignoreEntry(input.workspacePath, input.relativePath);
  await registerRepoInWorkspaceMetadata(input.workspacePath, {
    id: input.id,
    relativePath: input.relativePath,
    kind: input.kind,
    remote: input.remote,
  });

  return {
    id: input.id,
    relativePath: input.relativePath,
  };
}

export function defaultRepoId(relativePath: string, explicitId?: string): string {
  if (explicitId) {
    return explicitId;
  }
  const basename = path.basename(relativePath.split("/").join(path.sep));
  return slugify(basename, "repo");
}

export function workspaceGitignoreBaseTemplate(): string {
  return [".DS_Store", "node_modules/"].join("\n") + "\n";
}

export function listReposForDisplay(metadata: WorkspaceMetadata): Array<{
  id: string;
  path: string;
  kind: string;
  remote?: string;
}> {
  return Object.entries(metadata.repos).map(([id, entry]) => ({
    id,
    path: entry.path,
    kind: entry.kind,
    ...(entry.remote ? { remote: entry.remote } : {}),
  }));
}
