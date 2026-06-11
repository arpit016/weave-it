import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { activeChangeContext, ChangeCommandError } from "./changes.js";
import { pathExists } from "./files.js";
import {
  branchExists,
  checkoutBranch,
  createBranch,
  currentBranch,
  currentHead,
  findGitRoot,
  isWorktreeDirty,
} from "./git.js";
import { readWorkspaceMetadata } from "./workspace-repos.js";

export type PrepareStatus = "ok" | "blocked";
export type PrepareBranchStatus = "created" | "checked_out" | "already_active" | "skipped_not_git";
export type PrepareRepoState = "prepared" | "skipped";

export type PrepareOptions = {
  cwd: string;
  now?: Date;
  sessionPath?: string;
};

export type PrepareRepoResult = {
  id: string;
  path: string;
  mode: "repo" | "workspace";
  state: PrepareRepoState;
  branch_status: PrepareBranchStatus;
  branch: string;
  prepared_head?: string;
};

export type PrepareBlocker = {
  target: string;
  reason: string;
};

export type PrepareResult = {
  status: PrepareStatus;
  change: { id: string; branch: string; path: string };
  mode: "repo" | "workspace";
  repos: PrepareRepoResult[];
  blockers: PrepareBlocker[];
  message: string;
};

type RepoTarget = {
  id: string;
  absolutePath: string;
  relativePath: string;
  mode: "repo" | "workspace";
};

type RepoPlan = RepoTarget & {
  state: PrepareRepoState;
  branchStatus: PrepareBranchStatus;
};

export async function prepareTasks(options: PrepareOptions): Promise<PrepareResult> {
  const now = options.now ?? new Date();
  const context = await activeChangeContext({ cwd: options.cwd, now, sessionPath: options.sessionPath });
  const branch = context.change.branch;

  const blockers: PrepareBlocker[] = [];
  const artifactRootBlocker = await artifactRootBranchBlocker(context.target.path, branch);
  if (artifactRootBlocker) {
    blockers.push(artifactRootBlocker);
  }

  const targets = context.mode === "repo"
    ? repoModeTargets(context.target.path)
    : await workspaceModeTargets(context.target.path, blockers);

  const plans = blockers.length === 0 ? await preflightTargets(targets, branch, blockers) : [];
  if (blockers.length > 0) {
    return result({ status: "blocked", context, repos: [], blockers });
  }

  const repos = await applyPlans(plans, branch);
  if (repos.length > 0) {
    await writeExecutionState(context.change.changePath, branch, repos, now);
  }

  return result({ status: "ok", context, repos, blockers: [] });
}

function repoModeTargets(rootPath: string): RepoTarget[] {
  return [{ id: "root", absolutePath: rootPath, relativePath: ".", mode: "repo" }];
}

async function workspaceModeTargets(rootPath: string, blockers: PrepareBlocker[]): Promise<RepoTarget[]> {
  const metadata = await readWorkspaceMetadata(rootPath);
  if (!metadata) {
    blockers.push({ target: rootPath, reason: "Workspace metadata is missing or invalid." });
    return [];
  }

  const targets: RepoTarget[] = [];
  for (const [repoId, entry] of Object.entries(metadata.repos)) {
    const absolutePath = path.join(rootPath, entry.path);
    if (!(await pathExists(absolutePath))) {
      blockers.push({ target: repoId, reason: `Registered repo path does not exist: ${entry.path}` });
      continue;
    }
    targets.push({ id: repoId, absolutePath, relativePath: entry.path, mode: "workspace" });
  }

  return targets;
}

async function artifactRootBranchBlocker(rootPath: string, branch: string): Promise<PrepareBlocker | undefined> {
  const gitRoot = await findGitRoot(rootPath);
  if (!gitRoot) {
    return undefined;
  }
  const current = await currentBranch(rootPath);
  if (!current) {
    return { target: rootPath, reason: "Artifact root is in detached HEAD or has no current branch." };
  }
  if (current !== branch) {
    return { target: rootPath, reason: `Artifact root branch is ${current}; expected ${branch}.` };
  }
  return undefined;
}

async function preflightTargets(targets: RepoTarget[], branch: string, blockers: PrepareBlocker[]): Promise<RepoPlan[]> {
  const plans: RepoPlan[] = [];
  for (const target of targets) {
    const gitRoot = await findGitRoot(target.absolutePath);
    if (!gitRoot) {
      plans.push({ ...target, state: "skipped", branchStatus: "skipped_not_git" });
      continue;
    }

    const current = await currentBranch(target.absolutePath);
    if (!current) {
      blockers.push({ target: target.id, reason: "Repo is in detached HEAD or has no current branch." });
      continue;
    }

    if (current === branch) {
      plans.push({ ...target, state: "prepared", branchStatus: "already_active" });
      continue;
    }

    if (await isWorktreeDirty(target.absolutePath)) {
      blockers.push({ target: target.id, reason: `Repo has uncommitted changes on ${current}; expected ${branch}.` });
      continue;
    }

    plans.push({
      ...target,
      state: "prepared",
      branchStatus: (await branchExists(target.absolutePath, branch)) ? "checked_out" : "created",
    });
  }
  return blockers.length > 0 ? [] : plans;
}

async function applyPlans(plans: RepoPlan[], branch: string): Promise<PrepareRepoResult[]> {
  const repos: PrepareRepoResult[] = [];
  for (const plan of plans) {
    if (plan.branchStatus === "checked_out") {
      await checkoutBranch(plan.absolutePath, branch);
    } else if (plan.branchStatus === "created") {
      await createBranch(plan.absolutePath, branch);
    }

    const head = plan.state === "prepared" ? await currentHead(plan.absolutePath) : undefined;
    repos.push({
      id: plan.id,
      path: plan.relativePath,
      mode: plan.mode,
      state: plan.state,
      branch_status: plan.branchStatus,
      branch,
      ...(head ? { prepared_head: head } : {}),
    });
  }
  return repos;
}

async function writeExecutionState(changePath: string, branch: string, repos: PrepareRepoResult[], now: Date): Promise<void> {
  const statusPath = path.join(changePath, "status.yml");
  const raw = YAML.parse(await readFile(statusPath, "utf8")) as Record<string, unknown>;
  const existingExecution = isRecord(raw.execution) ? raw.execution : undefined;
  const existingBranch = typeof existingExecution?.branch === "string" ? existingExecution.branch : undefined;
  const preserveExisting = existingBranch === branch && isRecord(existingExecution?.repos);
  const existingRepos = preserveExisting ? existingExecution?.repos as Record<string, unknown> : {};
  const nextRepos: Record<string, unknown> = { ...existingRepos };
  const timestamp = now.toISOString();

  for (const repo of repos) {
    const existing = isRecord(nextRepos[repo.id]) ? nextRepos[repo.id] as Record<string, unknown> : undefined;
    const existingPreparedAt = existing?.branch === branch && typeof existing.prepared_at === "string" ? existing.prepared_at : undefined;
    nextRepos[repo.id] = {
      path: repo.path,
      mode: repo.mode,
      branch: repo.branch,
      state: repo.state,
      branch_status: repo.branch_status,
      ...(repo.prepared_head ? { prepared_head: repo.prepared_head } : {}),
      prepared_at: existingPreparedAt ?? timestamp,
      verified_at: timestamp,
    };
  }

  raw.execution = {
    version: 1,
    branch,
    repos: nextRepos,
  };
  raw.updated_at = timestamp;
  await writeFile(statusPath, YAML.stringify(raw));
}

function result(input: {
  status: PrepareStatus;
  context: Awaited<ReturnType<typeof activeChangeContext>>;
  repos: PrepareRepoResult[];
  blockers: PrepareBlocker[];
}): PrepareResult {
  const value: PrepareResult = {
    status: input.status,
    change: { id: input.context.change.id, branch: input.context.change.branch, path: input.context.change.path },
    mode: input.context.mode,
    repos: input.repos,
    blockers: input.blockers,
    message: "",
  };
  value.message = formatPrepareMessage(value);
  return value;
}

function formatPrepareMessage(result: PrepareResult): string {
  const lines = [
    `Task prepare: ${result.change.id}`,
    `Branch: ${result.change.branch}`,
    `Mode: ${result.mode}`,
    `Status: ${result.status}`,
  ];
  if (result.repos.length > 0) {
    lines.push("", "Repos:", ...result.repos.map((repo) => `  ${repo.id}  ${repo.branch_status}  ${repo.path}`));
  }
  if (result.blockers.length > 0) {
    lines.push("", "Blockers:", ...result.blockers.map((blocker) => `  ${blocker.target}: ${blocker.reason}`));
  }
  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
