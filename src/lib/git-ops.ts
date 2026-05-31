import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findGitRoot, getGitRemote, git, gitRequired } from "./git.js";

const execFileAsync = promisify(execFile);

async function gitRaw(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

export interface DirtyFile {
  path: string;
  index: string;
  worktree: string;
  staged: boolean;
  unstaged: boolean;
}

export async function getDirtyFiles(cwd: string): Promise<DirtyFile[]> {
  const root = await findGitRoot(cwd);
  if (!root) {
    return [];
  }

  const out = await gitRaw(["status", "--porcelain", "-z", "--untracked-files=all"], root);
  if (out.length === 0) {
    return [];
  }

  const records = out.split("\0").filter((entry) => entry.length > 0);
  const files: DirtyFile[] = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const xy = record.slice(0, 2);
    const file = record.slice(3);
    const x = xy[0] ?? " ";
    const y = xy[1] ?? " ";
    if ((x === "R" || x === "C") && i + 1 < records.length) {
      const newPath = file;
      const oldPath = records[i + 1];
      i += 1;
      files.push({ path: newPath, index: x, worktree: y, staged: true, unstaged: y !== " " && y !== "?" });
      void oldPath;
      continue;
    }
    files.push({
      path: file,
      index: x,
      worktree: y,
      staged: x !== " " && x !== "?",
      unstaged: y !== " " && y !== "?" || x === "?",
    });
  }
  return files;
}

export async function stageFiles(files: string[], cwd: string): Promise<void> {
  if (files.length === 0) {
    return;
  }
  const root = await findGitRoot(cwd);
  if (!root) {
    throw new Error("Not a git repository");
  }
  await execFileAsync("git", ["add", "--", ...files], { cwd: root });
}

export interface CommitOptions {
  subject: string;
  body?: string;
}

export interface CommitResult {
  ok: boolean;
  sha?: string;
  hookFailed?: boolean;
  hookModifiedFiles?: boolean;
  errorMessage?: string;
}

export async function commit(opts: CommitOptions, cwd: string): Promise<CommitResult> {
  const root = await findGitRoot(cwd);
  if (!root) {
    return { ok: false, errorMessage: "Not a git repository" };
  }

  const args = ["commit", "-m", opts.subject];
  if (opts.body && opts.body.trim().length > 0) {
    args.push("-m", opts.body);
  }

  try {
    await execFileAsync("git", args, { cwd: root });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      ok: false,
      hookFailed: true,
      errorMessage: (err.stderr && err.stderr.trim()) || err.message || "git commit failed",
    };
  }

  const sha = await git(["rev-parse", "HEAD"], root);
  return { ok: true, sha };
}

export interface PushOptions {
  setUpstream: boolean;
}

export interface PushResult {
  pushed: boolean;
  setUpstream: boolean;
  error?: string;
}

export async function push(opts: PushOptions, cwd: string): Promise<PushResult> {
  const root = await findGitRoot(cwd);
  if (!root) {
    return { pushed: false, setUpstream: false, error: "Not a git repository" };
  }

  const args = opts.setUpstream ? ["push", "-u", "origin", "HEAD"] : ["push"];
  try {
    await execFileAsync("git", args, { cwd: root });
    return { pushed: true, setUpstream: opts.setUpstream };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      pushed: false,
      setUpstream: opts.setUpstream,
      error: (err.stderr && err.stderr.trim()) || err.message || "git push failed",
    };
  }
}

export interface StashPushResult {
  ok: boolean;
  ref?: string;
  error?: string;
}

export async function stashPush(files: string[], message: string, cwd: string): Promise<StashPushResult> {
  if (files.length === 0) {
    return { ok: true };
  }
  const root = await findGitRoot(cwd);
  if (!root) {
    return { ok: false, error: "Not a git repository" };
  }
  try {
    await execFileAsync(
      "git",
      ["stash", "push", "--include-untracked", "-m", message, "--", ...files],
      { cwd: root },
    );
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return { ok: false, error: (err.stderr && err.stderr.trim()) || err.message || "git stash failed" };
  }
  const ref = await git(["rev-parse", "stash@{0}"], root);
  return { ok: true, ref };
}

export interface StashPopResult {
  ok: boolean;
  conflict?: string;
}

export async function stashPop(cwd: string): Promise<StashPopResult> {
  const root = await findGitRoot(cwd);
  if (!root) {
    return { ok: false, conflict: "Not a git repository" };
  }
  try {
    await execFileAsync("git", ["stash", "pop"], { cwd: root });
    return { ok: true };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      ok: false,
      conflict: (err.stderr && err.stderr.trim()) || err.message || "stash pop failed",
    };
  }
}

export async function hasUpstream(cwd: string): Promise<boolean> {
  const root = await findGitRoot(cwd);
  if (!root) {
    return false;
  }
  const upstream = await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], root);
  return Boolean(upstream);
}

export async function defaultBaseBranch(cwd: string): Promise<string> {
  const root = await findGitRoot(cwd);
  if (!root) {
    return "main";
  }

  const headRef = await git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], root);
  if (headRef) {
    const trimmed = headRef.replace(/^origin\//, "");
    if (trimmed) {
      return trimmed;
    }
  }

  for (const candidate of ["main", "master"]) {
    const ref = await git(["rev-parse", "--verify", `refs/remotes/origin/${candidate}`], root);
    if (ref) {
      return candidate;
    }
    const local = await git(["rev-parse", "--verify", `refs/heads/${candidate}`], root);
    if (local) {
      return candidate;
    }
  }
  return "main";
}

export async function compareUrl(branch: string, base: string, cwd: string): Promise<string | undefined> {
  const remote = await getRemoteUrl(cwd);
  if (!remote) {
    return undefined;
  }
  const repo = parseGithubRepo(remote);
  if (!repo) {
    return undefined;
  }
  return `https://github.com/${repo.owner}/${repo.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(branch)}?expand=1`;
}

export async function getRemoteUrl(cwd: string): Promise<string | undefined> {
  const root = await findGitRoot(cwd);
  if (!root) {
    return undefined;
  }
  return getGitRemote(root);
}

export interface GithubRepo {
  owner: string;
  repo: string;
}

export function parseGithubRepo(url: string): GithubRepo | undefined {
  const httpsMatch = url.match(/^https?:\/\/(?:[^@/]+@)?github\.com\/([^/]+)\/([^/.]+)(?:\.git)?\/?$/i);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  const sshMatch = url.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  const gitProtocolMatch = url.match(/^git:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?\/?$/i);
  if (gitProtocolMatch) {
    return { owner: gitProtocolMatch[1], repo: gitProtocolMatch[2] };
  }

  return undefined;
}

export async function gitRev(args: string[], cwd: string): Promise<string | undefined> {
  const root = await findGitRoot(cwd);
  if (!root) {
    return undefined;
  }
  return git(args, root);
}

export { gitRequired };
