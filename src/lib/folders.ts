import path from "node:path";
import { realpath } from "node:fs/promises";
import { ensureDirectory } from "./files.js";
import { findGitRoot, getGitRemote } from "./git.js";
import { slugify, titleFromSlug } from "./ids.js";

export type ResolvedFolder = {
  id: string;
  path: string;
  name: string;
  kind: string;
  gitRemote?: string;
};

export async function resolveFolder(input: {
  cwd: string;
  targetPath?: string;
  id?: string;
  kind?: string;
}): Promise<ResolvedFolder> {
  const candidate = input.targetPath ? path.resolve(input.cwd, input.targetPath) : input.cwd;
  await ensureDirectory(candidate);

  const gitRoot = await findGitRoot(candidate);
  const folderPath = await realpath(gitRoot ?? candidate);
  const basename = path.basename(folderPath);
  const id = input.id ?? slugify(basename, "folder");
  const gitRemote = gitRoot ? await getGitRemote(folderPath) : undefined;

  return {
    id,
    path: folderPath,
    name: titleFromSlug(id) || basename,
    kind: input.kind ?? "app",
    gitRemote,
  };
}
