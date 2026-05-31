import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GhSkipReason =
  | "no_gh"
  | "no_remote"
  | "non_github"
  | "unauth";

export interface GhStatus {
  available: boolean;
  authenticated: boolean;
  reason?: GhSkipReason;
}

export async function ghAvailable(): Promise<boolean> {
  try {
    await execFileAsync("gh", ["--version"], { env: process.env });
    return true;
  } catch {
    return false;
  }
}

export async function ghAuthOk(cwd: string): Promise<boolean> {
  try {
    await execFileAsync("gh", ["auth", "status"], { cwd, env: process.env });
    return true;
  } catch {
    return false;
  }
}

export interface GhPr {
  url: string;
  number: number;
  isDraft: boolean;
  state: string;
}

export async function findPrForBranch(branch: string, cwd: string): Promise<GhPr | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "gh",
      ["pr", "view", branch, "--json", "url,number,isDraft,state"],
      { cwd, env: process.env },
    );
    const parsed = JSON.parse(stdout) as Partial<GhPr>;
    if (!parsed.url || typeof parsed.number !== "number") {
      return undefined;
    }
    return {
      url: parsed.url,
      number: parsed.number,
      isDraft: Boolean(parsed.isDraft),
      state: typeof parsed.state === "string" ? parsed.state : "OPEN",
    };
  } catch {
    return undefined;
  }
}

export interface CreatePrOptions {
  base: string;
  head: string;
  title: string;
  body: string;
  draft: boolean;
}

export interface CreatePrResult {
  ok: boolean;
  url?: string;
  errorMessage?: string;
}

export async function createPr(opts: CreatePrOptions, cwd: string): Promise<CreatePrResult> {
  const args = ["pr", "create", "--base", opts.base, "--head", opts.head, "--title", opts.title, "--body", opts.body];
  if (opts.draft) {
    args.push("--draft");
  }
  try {
    const { stdout } = await execFileAsync("gh", args, { cwd, env: process.env });
    const url = (stdout || "").trim().split(/\s+/).pop();
    if (!url || !/^https?:\/\//.test(url)) {
      return { ok: false, errorMessage: `gh pr create returned unexpected output: ${stdout}` };
    }
    return { ok: true, url };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      ok: false,
      errorMessage: (err.stderr && err.stderr.trim()) || err.message || "gh pr create failed",
    };
  }
}

export interface MarkReadyOptions {
  branch: string;
}

export interface MarkReadyResult {
  ok: boolean;
  errorMessage?: string;
}

export async function markPrReady(opts: MarkReadyOptions, cwd: string): Promise<MarkReadyResult> {
  try {
    await execFileAsync("gh", ["pr", "ready", opts.branch], { cwd, env: process.env });
    return { ok: true };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return {
      ok: false,
      errorMessage: (err.stderr && err.stderr.trim()) || err.message || "gh pr ready failed",
    };
  }
}
