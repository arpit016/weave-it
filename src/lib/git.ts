import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(args: string[], cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, env: gitEnv() });
    const value = stdout.trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? "Weave",
    GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? "weave@example.invalid",
    GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? "Weave",
    GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? "weave@example.invalid",
  };
}

export async function findGitRoot(cwd: string): Promise<string | undefined> {
  return git(["rev-parse", "--show-toplevel"], cwd);
}

export async function currentBranch(cwd: string): Promise<string | undefined> {
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    return undefined;
  }

  return git(["branch", "--show-current"], gitRoot);
}

export async function isWorktreeDirty(cwd: string): Promise<boolean> {
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    return false;
  }

  return Boolean(await git(["status", "--porcelain"], gitRoot));
}

export async function branchExists(cwd: string, branch: string): Promise<boolean> {
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    return false;
  }

  return Boolean(await git(["rev-parse", "--verify", `refs/heads/${branch}`], gitRoot));
}

export async function checkoutBranch(cwd: string, branch: string): Promise<void> {
  const gitRoot = await findGitRoot(cwd);
  await runGitRequired(["checkout", branch], gitRoot ?? cwd);
}

export async function createBranch(cwd: string, branch: string): Promise<void> {
  const gitRoot = await findGitRoot(cwd);
  await runGitRequired(["checkout", "-b", branch], gitRoot ?? cwd);
}

export async function currentHead(cwd: string): Promise<string | undefined> {
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    return undefined;
  }

  return git(["rev-parse", "HEAD"], gitRoot);
}

export async function getGitRemote(cwd: string): Promise<string | undefined> {
  return git(["config", "--get", "remote.origin.url"], cwd);
}

export async function runGitRequired(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd, env: gitEnv() });
}

export async function cloneRepo(url: string, destinationDir: string, cwd: string): Promise<void> {
  await runGitRequired(["clone", "--", url, destinationDir], cwd);
}
