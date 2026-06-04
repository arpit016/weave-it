import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeNewFile(path: string, contents: string): Promise<void> {
  await writeFile(path, contents, { flag: "wx" });
}

export async function writeFileIfMissing(path: string, contents: string): Promise<boolean> {
  if (await pathExists(path)) {
    return false;
  }

  await writeNewFile(path, contents);
  return true;
}

export async function writeFileAtomic(path: string, contents: string): Promise<void> {
  const tempPath = `${path}.${process.pid}.tmp`;
  await writeFile(tempPath, contents);
  await rename(tempPath, path);
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function createDirExclusive(path: string): Promise<void> {
  await mkdir(path, { recursive: false });
}

export async function ensureDirectory(path: string): Promise<void> {
  const value = await stat(path);

  if (!value.isDirectory()) {
    throw new Error(`Expected a directory: ${path}`);
  }
}

export async function isDirectoryEmpty(path: string): Promise<boolean> {
  const entries = await readdir(path);
  return entries.length === 0;
}

export async function movePath(source: string, target: string): Promise<void> {
  await rename(source, target);
}

export async function readJsonCache<T>(path: string): Promise<T | null> {
  try {
    const contents = await readFile(path, "utf8");
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
}

export async function writeJsonCache<T>(path: string, data: T): Promise<boolean> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFileAtomic(path, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}
