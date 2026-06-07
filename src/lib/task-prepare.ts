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
import { loadTasksForChange, deriveTaskRepoIds, selectTasks, type ParsedTask, type TaskSelector } from "./tasks.js";
import { readWorkspaceMetadata } from "./workspace-repos.js";

export type PrepareStatus = "ok" | "blocked";
export type PrepareBranchStatus = "created" | "checked_out" | "already_active" | "skipped_not_git";
export type PrepareRepoState = "prepared" | "skipped";

export type PrepareOptions = {
  cwd: string;
  selector: TaskSelector;
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
  selector: { type: "tasks" | "scope" | "all"; values?: string[]; value?: string };
  mode: "repo" | "workspace";
  tasks: Array<{ id: string; title: string; scope?: string }>;
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
  const tasks = await loadTasksForChange(context.change.changePath);
  const selection = selectTasks(tasks, options.selector);
  const selector = formatSelector(options.selector);
  const selectedTasks = selection.tasks.map((task) => ({ id: task.id, title: task.title, scope: task.scope }));

  const blockers: PrepareBlocker[] = [];
  const emptySelectionBlocker = selectionBlocker(selection.tasks.length, options.selector);
  if (emptySelectionBlocker) {
    blockers.push(emptySelectionBlocker);
  }

  const artifactRootBlocker = await artifactRootBranchBlocker(context.target.path, branch);
  if (artifactRootBlocker) {
    blockers.push(artifactRootBlocker);
  }

  const targets = context.mode === "repo"
    ? repoModeTargets(context.target.path, selection.tasks)
    : await workspaceModeTargets(context.target.path, selection.tasks, blockers);

  const plans = blockers.length === 0 ? await preflightTargets(targets, branch, blockers) : [];
  if (blockers.length > 0) {
    return result({ status: "blocked", context, selector, tasks: selectedTasks, repos: [], blockers });
  }

  const repos = await applyPlans(plans, branch);
  if (repos.length > 0) {
    await writeExecutionState(context.change.changePath, branch, repos, now);
  }

  return result({ status: "ok", context, selector, tasks: selectedTasks, repos, blockers: [] });
}

function repoModeTargets(rootPath: string, tasks: ParsedTask[]): RepoTarget[] {
  if (tasks.length === 0) {
    return [];
  }
  return [{ id: "root", absolutePath: rootPath, relativePath: ".", mode: "repo" }];
}

async function workspaceModeTargets(rootPath: string, tasks: ParsedTask[], blockers: PrepareBlocker[]): Promise<RepoTarget[]> {
  const metadata = await readWorkspaceMetadata(rootPath);
  if (!metadata) {
    blockers.push({ target: rootPath, reason: "Workspace metadata is missing or invalid." });
    return [];
  }

  const repoIds: string[] = [];
  for (const task of tasks) {
    const taskRepoIds = deriveTaskRepoIds(task).filter((repoId) => repoId.toLowerCase() !== "workspace");
    if (taskRepoIds.length === 0) {
      blockers.push({ target: task.id, reason: "Task has no concrete repo metadata for workspace prepare." });
      continue;
    }
    for (const repoId of taskRepoIds) {
      if (!repoIds.includes(repoId)) {
        repoIds.push(repoId);
      }
    }
  }

  const targets: RepoTarget[] = [];
  for (const repoId of repoIds) {
    const entry = metadata.repos[repoId];
    if (!entry) {
      blockers.push({ target: repoId, reason: "Task references a repo id that is not registered in workspace metadata." });
      continue;
    }
    const absolutePath = path.join(rootPath, entry.path);
    if (!(await pathExists(absolutePath))) {
      blockers.push({ target: repoId, reason: `Registered repo path does not exist: ${entry.path}` });
      continue;
    }
    targets.push({ id: repoId, absolutePath, relativePath: entry.path, mode: "workspace" });
  }

  return targets;
}

function selectionBlocker(taskCount: number, selector: TaskSelector): PrepareBlocker | undefined {
  if (taskCount > 0) {
    return undefined;
  }

  if (selector.type === "scope") {
    return { target: selector.scope, reason: "No tasks matched the requested scope." };
  }

  if (selector.type === "all") {
    return { target: "all", reason: "No T# tasks were found in tasks.md." };
  }

  return undefined;
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
  selector: PrepareResult["selector"];
  tasks: PrepareResult["tasks"];
  repos: PrepareRepoResult[];
  blockers: PrepareBlocker[];
}): PrepareResult {
  const value: PrepareResult = {
    status: input.status,
    change: { id: input.context.change.id, branch: input.context.change.branch, path: input.context.change.path },
    selector: input.selector,
    mode: input.context.mode,
    tasks: input.tasks,
    repos: input.repos,
    blockers: input.blockers,
    message: "",
  };
  value.message = formatPrepareMessage(value);
  return value;
}

function formatSelector(selector: TaskSelector): PrepareResult["selector"] {
  if (selector.type === "all") {
    return { type: "all" };
  }
  if (selector.type === "scope") {
    return { type: "scope", value: selector.scope };
  }
  return { type: "tasks", values: selector.ids };
}

function formatPrepareMessage(result: PrepareResult): string {
  const lines = [
    `Task prepare: ${result.change.id}`,
    `Branch: ${result.change.branch}`,
    `Mode: ${result.mode}`,
    `Status: ${result.status}`,
  ];
  if (result.tasks.length > 0) {
    lines.push(`Tasks: ${result.tasks.map((task) => task.id).join(", ")}`);
  }
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
