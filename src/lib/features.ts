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

export interface FeatureTargetResult {
  path: string;
  featurePath: string;
  branch: string;
  branchStatus: BranchStatus;
}

export interface FeatureOperationResult {
  status: "ok";
  id: string;
  slug: string;
  title: string;
  branch: string;
  targets: FeatureTargetResult[];
  message: string;
}

export interface CreateFeatureOptions {
  cwd: string;
  title: string;
  slug?: string;
  targets?: string[];
  now?: Date;
  randomId?: () => string;
  sessionPath?: string;
}

export interface PropagateFeatureOptions {
  cwd: string;
  featureId: string;
  from?: string;
  to: string[];
  now?: Date;
  sessionPath?: string;
}

interface FeatureTarget {
  path: string;
}

interface ExistingFeatureMetadata {
  id: string;
  slug: string;
  title: string;
  branch: string;
}

export async function createFeature(options: CreateFeatureOptions): Promise<FeatureOperationResult> {
  const now = options.now ?? new Date();
  const title = options.title.trim();
  if (!title) {
    throw new Error("Feature title is required");
  }

  const targets = await resolveTargets(options.cwd, options.targets, options.sessionPath);
  const slug = normalizeFeatureSlug(options.slug ?? title);
  const id = await generateFeatureId(targets, slug, now, options.randomId ?? randomFeatureIdPart);
  const branch = featureBranch(id);

  await assertFeatureMissing(targets, id);

  const results: FeatureTargetResult[] = [];
  for (const target of targets) {
    const branchStatus = await ensureFeatureBranch(target.path, branch);
    await ensureWeaveScaffold({ folder: { path: target.path } });
    const featurePath = featureDir(target.path, id);
    await mkdir(featurePath, { recursive: false });
    await writeFile(path.join(featurePath, "status.yml"), statusTemplate({ id, slug, title, branch, now }));
    await writeFile(path.join(featurePath, "exploration.md"), explorationTemplate(title, title));
    results.push({ path: target.path, featurePath, branch, branchStatus });
  }

  return summarizeFeatureOperation({ id, slug, title, branch, targets: results, verb: "Created" });
}

export async function propagateFeature(options: PropagateFeatureOptions): Promise<FeatureOperationResult> {
  const source = await resolveTarget(options.cwd, options.from ?? options.cwd, options.sessionPath);
  const sourceFeaturePath = featureDir(source.path, options.featureId);
  if (!(await pathExists(sourceFeaturePath))) {
    throw new Error(`Feature not found: ${path.relative(options.cwd, sourceFeaturePath)}`);
  }

  const targets = await resolveTargets(options.cwd, options.to, options.sessionPath);
  await assertFeatureMissing(targets, options.featureId);

  const metadata = await readExistingFeatureMetadata(sourceFeaturePath, options.featureId);
  const results: FeatureTargetResult[] = [];
  for (const target of targets) {
    const branchStatus = await ensureFeatureBranch(target.path, metadata.branch);
    await ensureWeaveScaffold({ folder: { path: target.path } });
    const targetFeaturePath = featureDir(target.path, options.featureId);
    await cp(sourceFeaturePath, targetFeaturePath, { recursive: true, errorOnExist: true, force: false });
    results.push({ path: target.path, featurePath: targetFeaturePath, branch: metadata.branch, branchStatus });
  }

  return summarizeFeatureOperation({
    id: metadata.id,
    slug: metadata.slug,
    title: metadata.title,
    branch: metadata.branch,
    targets: results,
    verb: "Propagated",
  });
}

function normalizeFeatureSlug(value: string): string {
  const slug = slugify(value, "feature");
  return slug.split("-").filter(Boolean).slice(0, 6).join("-") || "feature";
}

async function generateFeatureId(
  targets: FeatureTarget[],
  slug: string,
  now: Date,
  randomId: () => string,
): Promise<string> {
  const date = formatDatePrefix(now);
  for (let index = 0; index < 20; index += 1) {
    const id = `${date}-${randomId()}-${slug}`;
    const exists = await Promise.all(targets.map((target) => pathExists(featureDir(target.path, id))));
    if (!exists.some(Boolean)) {
      return id;
    }
  }

  throw new Error("Could not generate a unique feature id");
}

function formatDatePrefix(now: Date): string {
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function randomFeatureIdPart(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes, (byte) => idChars[byte % idChars.length]).join("");
}

function featureBranch(featureId: string): string {
  return `feature/${featureId}`;
}

function featureDir(root: string, featureId: string): string {
  return path.join(root, "wiki", "features", featureId);
}

async function assertFeatureMissing(targets: FeatureTarget[], featureId: string): Promise<void> {
  const existing: string[] = [];
  for (const target of targets) {
    const targetFeaturePath = featureDir(target.path, featureId);
    if (await pathExists(targetFeaturePath)) {
      existing.push(targetFeaturePath);
    }
  }

  if (existing.length > 0) {
    throw new Error(`Feature already exists:\n${existing.map((item) => `  ${item}`).join("\n")}`);
  }
}

async function resolveTargets(cwd: string, values: string[] | undefined, sessionPath?: string): Promise<FeatureTarget[]> {
  const targetValues = values && values.length > 0 ? values : [cwd];
  const targets = await Promise.all(targetValues.map((value) => resolveTarget(cwd, value, sessionPath)));
  const deduped = new Map(targets.map((target) => [target.path, target]));
  return [...deduped.values()];
}

async function resolveTarget(cwd: string, value: string, sessionPath?: string): Promise<FeatureTarget> {
  const session = await loadCurrentSession(sessionPath ?? defaultSessionPath());
  const sessionFolder = session?.folders[value];
  const resolved = await realpath(sessionFolder?.path ?? path.resolve(cwd, value));
  return { path: resolved };
}

function statusTemplate(input: { id: string; slug: string; title: string; branch: string; now: Date }): string {
  return YAML.stringify({
    version: 1,
    id: input.id,
    slug: input.slug,
    title: input.title,
    stage: "exploration",
    branch: input.branch,
    created_at: input.now.toISOString(),
    updated_at: input.now.toISOString(),
  });
}

function explorationTemplate(title: string, topic: string): string {
  return `# ${titleFromSlug(slugify(title, "feature")) || title}

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

async function readExistingFeatureMetadata(featurePath: string, fallbackId: string): Promise<ExistingFeatureMetadata> {
  const statusPath = path.join(featurePath, "status.yml");
  const parsed = YAML.parse(await readFile(statusPath, "utf8")) as Partial<ExistingFeatureMetadata>;
  const id = parsed.id ?? fallbackId;
  const slug = parsed.slug ?? id.split("-").slice(2).join("-");
  const title = parsed.title ?? titleFromSlug(slug);
  const branch = parsed.branch ?? featureBranch(id);
  return { id, slug, title, branch };
}

async function ensureFeatureBranch(cwd: string, branch: string): Promise<BranchStatus> {
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

function summarizeFeatureOperation(input: {
  id: string;
  slug: string;
  title: string;
  branch: string;
  targets: FeatureTargetResult[];
  verb: string;
}): FeatureOperationResult {
  const lines = [
    `${input.verb} feature: ${input.id}`,
    "",
    `Title: ${input.title}`,
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
