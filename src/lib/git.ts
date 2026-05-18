import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(args: string[], cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    const value = stdout.trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function findGitRoot(cwd: string): Promise<string | undefined> {
  return git(["rev-parse", "--show-toplevel"], cwd);
}

export async function getGitRemote(cwd: string): Promise<string | undefined> {
  return git(["config", "--get", "remote.origin.url"], cwd);
}
