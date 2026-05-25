import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { pathExists } from "./files.js";
import { findGitRoot } from "./git.js";
import { slugify, titleFromSlug } from "./ids.js";
import { defaultSessionPath, loadCurrentSession } from "./session-state.js";
import { ensureWeaveScaffold } from "./weave-scaffold.js";

const execFileAsync = promisify(execFile);
const idChars = "abcdefghijklmnopqrstuvwxyz0123456789";

export type BranchStatus = "created" | "checked_out" | "already_active" | "skipped_not_git";
export type ChangeType = "feat" | "fix" | "refactor" | "docs" | "test" | "ci" | "chore";

export const changeTypes: ChangeType[] = ["feat", "fix", "refactor", "docs", "test", "ci", "chore"];

export interface ChangeTargetResult {
  path: string;
  changePath: string;
  branch: string;
  branchStatus: BranchStatus;
}

export interface ChangeOperationResult {
  status: "ok";
  id: string;
  slug: string;
  title: string;
  type: ChangeType;
  branch: string;
  targets: ChangeTargetResult[];
  message: string;
}

export interface CreateChangeOptions {
  cwd: string;
  title: string;
  type?: ChangeType;
  slug?: string;
  targets?: string[];
  now?: Date;
  randomId?: () => string;
  sessionPath?: string;
}

export interface PropagateChangeOptions {
  cwd: string;
  changeId: string;
  from?: string;
  to: string[];
  now?: Date;
  sessionPath?: string;
}

interface ChangeTarget {
  path: string;
}

interface ExistingChangeMetadata {
  id: string;
  slug: string;
  title: string;
  type: ChangeType;
  branch: string;
}

export async function createChange(options: CreateChangeOptions): Promise<ChangeOperationResult> {
  const now = options.now ?? new Date();
  const title = options.title.trim();
  if (!title) {
    throw new Error("Change title is required");
  }

  const targets = await resolveTargets(options.cwd, options.targets, options.sessionPath);
  const type = options.type ?? "feat";
  const slug = normalizeChangeSlug(options.slug ?? title);
  const id = await generateChangeId(targets, slug, now, options.randomId ?? randomChangeIdPart);
  const branch = changeBranch(id);

  await assertChangeMissing(targets, id);

  const results: ChangeTargetResult[] = [];
  for (const target of targets) {
    const branchStatus = await ensureChangeBranch(target.path, branch);
    await ensureWeaveScaffold({ folder: { path: target.path } });
    const changePath = changeDir(target.path, id);
    await mkdir(changePath, { recursive: false });
    await writeFile(path.join(changePath, "status.yml"), statusTemplate({ id, slug, title, type, branch, now }));
    await writeFile(path.join(changePath, "exploration.md"), explorationTemplate(title, title));
    results.push({ path: target.path, changePath, branch, branchStatus });
  }

  return summarizeChangeOperation({ id, slug, title, type, branch, targets: results, verb: "Created" });
}

export async function propagateChange(options: PropagateChangeOptions): Promise<ChangeOperationResult> {
  const source = await resolveTarget(options.cwd, options.from ?? options.cwd, options.sessionPath);
  const sourceChangePath = changeDir(source.path, options.changeId);
  if (!(await pathExists(sourceChangePath))) {
    throw new Error(`Change not found: ${path.relative(options.cwd, sourceChangePath)}`);
  }

  const targets = await resolveTargets(options.cwd, options.to, options.sessionPath);
  await assertChangeMissing(targets, options.changeId);

  const metadata = await readExistingChangeMetadata(sourceChangePath, options.changeId);
  const results: ChangeTargetResult[] = [];
  for (const target of targets) {
    const branchStatus = await ensureChangeBranch(target.path, metadata.branch);
    await ensureWeaveScaffold({ folder: { path: target.path } });
    const targetChangePath = changeDir(target.path, options.changeId);
    await cp(sourceChangePath, targetChangePath, { recursive: true, errorOnExist: true, force: false });
    results.push({ path: target.path, changePath: targetChangePath, branch: metadata.branch, branchStatus });
  }

  return summarizeChangeOperation({
    id: metadata.id,
    slug: metadata.slug,
    title: metadata.title,
    type: metadata.type,
    branch: metadata.branch,
    targets: results,
    verb: "Propagated",
  });
}

function normalizeChangeSlug(value: string): string {
  const slug = slugify(value, "change");
  return slug.split("-").filter(Boolean).slice(0, 6).join("-") || "change";
}

async function generateChangeId(
  targets: ChangeTarget[],
  slug: string,
  now: Date,
  randomId: () => string,
): Promise<string> {
  const date = formatDatePrefix(now);
  for (let index = 0; index < 20; index += 1) {
    const id = `${date}-${randomId()}-${slug}`;
    const exists = await Promise.all(targets.map((target) => pathExists(changeDir(target.path, id))));
    if (!exists.some(Boolean)) {
      return id;
    }
  }

  throw new Error("Could not generate a unique change id");
}

function formatDatePrefix(now: Date): string {
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function randomChangeIdPart(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes, (byte) => idChars[byte % idChars.length]).join("");
}

function changeBranch(changeId: string): string {
  return `change/${changeId}`;
}

function changeDir(root: string, changeId: string): string {
  return path.join(root, "wiki", "changes", changeId);
}

async function assertChangeMissing(targets: ChangeTarget[], changeId: string): Promise<void> {
  const existing: string[] = [];
  for (const target of targets) {
    const targetChangePath = changeDir(target.path, changeId);
    if (await pathExists(targetChangePath)) {
      existing.push(targetChangePath);
    }
  }

  if (existing.length > 0) {
    throw new Error(`Change already exists:\n${existing.map((item) => `  ${item}`).join("\n")}`);
  }
}

async function resolveTargets(cwd: string, values: string[] | undefined, sessionPath?: string): Promise<ChangeTarget[]> {
  const targetValues = values && values.length > 0 ? values : [cwd];
  const targets = await Promise.all(targetValues.map((value) => resolveTarget(cwd, value, sessionPath)));
  const deduped = new Map(targets.map((target) => [target.path, target]));
  return [...deduped.values()];
}

async function resolveTarget(cwd: string, value: string, sessionPath?: string): Promise<ChangeTarget> {
  const session = await loadCurrentSession(sessionPath ?? defaultSessionPath());
  const sessionFolder = session?.folders[value];
  const resolved = await realpath(sessionFolder?.path ?? path.resolve(cwd, value));
  return { path: resolved };
}

function statusTemplate(input: { id: string; slug: string; title: string; type: ChangeType; branch: string; now: Date }): string {
  return YAML.stringify({
    version: 1,
    id: input.id,
    slug: input.slug,
    title: input.title,
    type: input.type,
    stage: "exploration",
    branch: input.branch,
    created_at: input.now.toISOString(),
    updated_at: input.now.toISOString(),
  });
}

function explorationTemplate(title: string, topic: string): string {
  return `# ${titleFromSlug(slugify(title, "change")) || title}

## Topic

${topic}

## Current Understanding

## Open Questions

## Decisions

## Scenarios

## Existing Behavior

## PRD Readiness

Not ready
`;
}

async function readExistingChangeMetadata(changePath: string, fallbackId: string): Promise<ExistingChangeMetadata> {
  const statusPath = path.join(changePath, "status.yml");
  const parsed = YAML.parse(await readFile(statusPath, "utf8")) as Partial<ExistingChangeMetadata>;
  const id = parsed.id ?? fallbackId;
  const slug = parsed.slug ?? id.split("-").slice(2).join("-");
  const title = parsed.title ?? titleFromSlug(slug);
  const type = parsed.type ?? "feat";
  const branch = parsed.branch ?? changeBranch(id);
  return { id, slug, title, type, branch };
}

async function ensureChangeBranch(cwd: string, branch: string): Promise<BranchStatus> {
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    return "skipped_not_git";
  }

  const current = await git(["branch", "--show-current"], gitRoot);
  if (current === branch) {
    return "already_active";
  }

  const exists = await git(["rev-parse", "--verify", `refs/heads/${branch}`], gitRoot);
  if (exists) {
    await gitRequired(["checkout", branch], gitRoot);
    return "checked_out";
  }

  await gitRequired(["checkout", "-b", branch], gitRoot);
  return "created";
}

async function git(args: string[], cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    const value = stdout.trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

async function gitRequired(args: string[], cwd: string): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

function summarizeChangeOperation(input: {
  id: string;
  slug: string;
  title: string;
  type: ChangeType;
  branch: string;
  targets: ChangeTargetResult[];
  verb: string;
}): ChangeOperationResult {
  const lines = [
    `${input.verb} change: ${input.id}`,
    "",
    `Title: ${input.title}`,
    `Type: ${input.type}`,
    `Branch: ${input.branch}`,
    "",
    "Targets:",
    ...input.targets.map((target) => `  ${target.path} (${formatBranchStatus(target.branchStatus)})`),
  ];

  return {
    status: "ok",
    id: input.id,
    slug: input.slug,
    title: input.title,
    type: input.type,
    branch: input.branch,
    targets: input.targets,
    message: lines.join("\n"),
  };
}

function formatBranchStatus(status: BranchStatus): string {
  switch (status) {
    case "already_active":
      return "branch already active";
    case "checked_out":
      return "branch checked out";
    case "created":
      return "branch created";
    case "skipped_not_git":
      return "branch skipped: not a git repo";
  }
}
