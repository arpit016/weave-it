import { constants } from "node:fs";
import { access, mkdir, rename, stat, writeFile } from "node:fs/promises";

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

export async function ensureDirectory(path: string): Promise<void> {
  const value = await stat(path);

  if (!value.isDirectory()) {
    throw new Error(`Expected a directory: ${path}`);
  }
}
