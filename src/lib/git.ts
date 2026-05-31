import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function git(args: string[], cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    const value = stdout.trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export async function gitRequired(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

export async function findGitRoot(cwd: string): Promise<string | undefined> {
  return git(["rev-parse", "--show-toplevel"], cwd);
}

export async function getGitRemote(cwd: string): Promise<string | undefined> {
  return git(["config", "--get", "remote.origin.url"], cwd);
}

export async function currentBranch(cwd: string): Promise<string | undefined> {
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    return undefined;
  }

  return git(["branch", "--show-current"], gitRoot);
}
