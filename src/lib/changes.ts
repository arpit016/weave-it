import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { artifactFileName, artifactFrontmatter, type ArtifactName } from "./artifact-metadata.js";
import { pathExists } from "./files.js";
import { findGitRoot } from "./git.js";
import { slugify, titleFromSlug } from "./ids.js";
import {
  clearCurrentArtifactForPath,
  defaultSessionPath,
  findFolderByPath,
  loadCurrentSession,
  saveCurrentSession,
  setCurrentArtifactForPath,
  setCurrentChangeForPath,
  type CurrentSession,
  type SessionCurrentChange,
} from "./session-state.js";
import { ensureWeaveScaffold } from "./weave-scaffold.js";

const execFileAsync = promisify(execFile);
const idChars = "abcdefghijklmnopqrstuvwxyz0123456789";

export type BranchStatus = "created" | "checked_out" | "already_active" | "skipped_not_git";
export type ChangeType = "feat" | "fix" | "refactor" | "docs" | "test" | "ci" | "chore";
export type BranchMatch = "match" | "mismatch" | "not_git" | "unknown";
export type CurrentSource = "session" | "inferred_saved" | "none";

export const changeTypes: ChangeType[] = ["feat", "fix", "refactor", "docs", "test", "ci", "chore"];

export class ChangeCommandError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface ChangeTargetResult {
  path: string;
  changePath: string;
  branch: string;
  branchStatus: BranchStatus;
  current: boolean;
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

export interface ChangeSummary {
  id: string;
  slug: string;
  title: string;
  type: ChangeType;
  stage: string;
  branch: string;
  path: string;
  changePath: string;
  created_at?: string;
  updated_at?: string;
  active: boolean;
}

export interface ChangeTargetSummary {
  id?: string;
  name?: string;
  path: string;
  changes: ChangeSummary[];
}

export interface ChangeListResult {
  status: "ok";
  targets: ChangeTargetSummary[];
  message: string;
}

export interface CurrentChangeTargetResult {
  id?: string;
  name?: string;
  path: string;
  source: CurrentSource;
  saved: boolean;
  current?: ChangeSummary;
  branch?: string;
  branchMatch: BranchMatch;
  mismatch?: ChangeMismatch;
}

export interface CurrentChangeResult {
  status: "ok";
  targets: CurrentChangeTargetResult[];
  message: string;
}

export interface ChangeMismatch {
  session: SessionCurrentChange;
  branch: ChangeSummary;
}

export interface StatusChangeTargetResult {
  id?: string;
  name?: string;
  path: string;
  active: boolean;
  source: CurrentSource | "explicit";
  saved: boolean;
  change?: ChangeSummary;
  branch?: string;
  branchMatch: BranchMatch;
  mismatch?: ChangeMismatch;
}

export interface StatusChangeResult {
  status: "ok";
  targets: StatusChangeTargetResult[];
  message: string;
}

export interface SwitchChangeResult {
  status: "ok";
  change: ChangeSummary;
  branchStatus: BranchStatus;
  target: {
    id?: string;
    name?: string;
    path: string;
  };
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

export interface ListChangesOptions {
  cwd: string;
  target?: string;
  sessionPath?: string;
}

export interface CurrentChangeOptions {
  cwd: string;
  target?: string;
  now?: Date;
  sessionPath?: string;
}

export interface StatusChangeOptions {
  cwd: string;
  change?: string;
  target?: string;
  now?: Date;
  sessionPath?: string;
}

export interface SwitchChangeOptions {
  cwd: string;
  change: string;
  now?: Date;
  sessionPath?: string;
}

interface ChangeTarget {
  id?: string;
  name?: string;
  path: string;
}

interface ExistingChangeMetadata {
  id: string;
  slug: string;
  title: string;
  type: ChangeType;
  branch: string;
}

interface ChangeStatusMetadata extends ExistingChangeMetadata {
  stage: string;
  created_at?: string;
  updated_at?: string;
}

export async function createChange(options: CreateChangeOptions): Promise<ChangeOperationResult> {
  const now = options.now ?? new Date();
  const title = options.title.trim();
  if (!title) {
    throw new ChangeCommandError("missing_title", "Change title is required");
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
    await mkdir(path.join(changePath, "sessions"));
    await writeFile(path.join(changePath, "status.yml"), statusTemplate({ id, slug, title, type, branch, now }));
    await writeFile(path.join(changePath, "exploration.md"), explorationTemplate(title, title, now));
    results.push({ path: target.path, changePath, branch, branchStatus, current: true });
  }

  await saveCurrentForTargets(
    options.sessionPath,
    results.map((target) => ({
      root: target.path,
      changeId: id,
      changePath: target.changePath,
      branch,
    })),
    now,
  );

  return summarizeChangeOperation({ id, slug, title, type, branch, targets: results, verb: "Created" });
}

export async function propagateChange(options: PropagateChangeOptions): Promise<ChangeOperationResult> {
  const now = options.now ?? new Date();
  const source = await resolveTarget(options.cwd, options.from ?? options.cwd, options.sessionPath);
  const sourceChangePath = changeDir(source.path, options.changeId);
  if (!(await pathExists(sourceChangePath))) {
    throw new ChangeCommandError("change_not_found", `Change not found: ${path.relative(options.cwd, sourceChangePath)}`);
  }

  const targets = await resolveTargets(options.cwd, options.to, options.sessionPath);
  await assertChangeMissing(targets, options.changeId);
  await assertCleanGitTargets(targets);

  const metadata = await readExistingChangeMetadata(sourceChangePath, options.changeId);
  const results: ChangeTargetResult[] = [];
  for (const target of targets) {
    const branchStatus = await ensureChangeBranch(target.path, metadata.branch);
    await ensureWeaveScaffold({ folder: { path: target.path } });
    const targetChangePath = changeDir(target.path, options.changeId);
    await cp(sourceChangePath, targetChangePath, { recursive: true, errorOnExist: true, force: false });
    results.push({ path: target.path, changePath: targetChangePath, branch: metadata.branch, branchStatus, current: true });
  }

  await saveCurrentForTargets(
    options.sessionPath,
    results.map((target) => ({
      root: target.path,
      changeId: metadata.id,
      changePath: target.changePath,
      branch: metadata.branch,
    })),
    now,
  );

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

export async function listChanges(options: ListChangesOptions): Promise<ChangeListResult> {
  const session = await loadCurrentSession(options.sessionPath ?? defaultSessionPath());
  const targets = await resolveQueryTargets(options.cwd, options.target, options.sessionPath);
  const summaries: ChangeTargetSummary[] = [];

  for (const target of targets) {
    const activeId = activeChangeForTarget(session, target)?.id;
    const changes = await readChanges(target.path, activeId);
    summaries.push({ id: target.id, name: target.name, path: target.path, changes });
  }

  return {
    status: "ok",
    targets: summaries,
    message: formatListMessage(summaries),
  };
}

export async function currentChange(options: CurrentChangeOptions): Promise<CurrentChangeResult> {
  const now = options.now ?? new Date();
  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const session = await loadOrCreateSession(sessionPath, now);
  const targets = await resolveQueryTargets(options.cwd, options.target, options.sessionPath);
  const results: CurrentChangeTargetResult[] = [];
  let mutated = false;

  for (const target of targets) {
    const context = await currentContextForTarget(session, target, now, { saveInferred: true });
    mutated ||= context.saved;
    results.push(context);
  }

  if (mutated) {
    await saveCurrentSession(session, sessionPath);
  }

  return {
    status: "ok",
    targets: results,
    message: formatCurrentMessage(results),
  };
}

export async function statusChange(options: StatusChangeOptions): Promise<StatusChangeResult> {
  const now = options.now ?? new Date();
  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const session = await loadOrCreateSession(sessionPath, now);
  const targets = await resolveQueryTargets(options.cwd, options.target, options.sessionPath);
  const results: StatusChangeTargetResult[] = [];
  let mutated = false;

  for (const target of targets) {
    if (options.change) {
      const changes = await readChanges(target.path, activeChangeForTarget(session, target)?.id);
      const change = resolveChangeReference(changes, options.change);
      const branch = await currentBranch(target.path);
      results.push({
        id: target.id,
        name: target.name,
        path: target.path,
        active: change.active,
        source: "explicit",
        saved: false,
        change,
        branch,
        branchMatch: branchMatch(branch, change.branch, await findGitRoot(target.path)),
      });
      continue;
    }

    const context = await currentContextForTarget(session, target, now, { saveInferred: true });
    mutated ||= context.saved;
    results.push({
      id: context.id,
      name: context.name,
      path: context.path,
      active: Boolean(context.current),
      source: context.source,
      saved: context.saved,
      change: context.current,
      branch: context.branch,
      branchMatch: context.branchMatch,
      mismatch: context.mismatch,
    });
  }

  if (mutated) {
    await saveCurrentSession(session, sessionPath);
  }

  return {
    status: "ok",
    targets: results,
    message: formatStatusMessage(results),
  };
}

export async function switchChange(options: SwitchChangeOptions): Promise<SwitchChangeResult> {
  const now = options.now ?? new Date();
  const target = await resolveTarget(options.cwd, options.cwd, options.sessionPath);
  await assertCleanGitTargets([target]);

  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const session = await loadOrCreateSession(sessionPath, now);
  const changes = await readChanges(target.path, activeChangeForTarget(session, target)?.id);
  const change = resolveChangeReference(changes, options.change);
  const branchStatus = await ensureChangeBranch(target.path, change.branch);

  setCurrentChangeForPath(
    session,
    target.path,
    { id: change.id, path: change.path, branch: change.branch },
    now,
  );
  const activeArtifact = activeArtifactForTarget(session, target);
  if (activeArtifact && activeArtifact.change_id !== change.id) {
    clearCurrentArtifactForPath(session, target.path, now);
  }
  await saveCurrentSession(session, sessionPath);

  return {
    status: "ok",
    change: { ...change, active: true },
    branchStatus,
    target: { id: target.id, name: target.name, path: target.path },
    message: [
      `Switched change: ${change.id}`,
      "",
      `Title: ${change.title}`,
      `Type: ${change.type}`,
      `Stage: ${change.stage}`,
      `Branch: ${change.branch} (${formatBranchStatus(branchStatus)})`,
      `Path: ${change.path}`,
      "Current: yes",
    ].join("\n"),
  };
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

  throw new ChangeCommandError("id_collision", "Could not generate a unique change id");
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
    throw new ChangeCommandError(
      "change_exists",
      `Change already exists:\n${existing.map((item) => `  ${item}`).join("\n")}`,
      { existing },
    );
  }
}

async function resolveTargets(cwd: string, values: string[] | undefined, sessionPath?: string): Promise<ChangeTarget[]> {
  const targetValues = values && values.length > 0 ? values : [cwd];
  const targets = await Promise.all(targetValues.map((value) => resolveTarget(cwd, value, sessionPath)));
  const deduped = new Map(targets.map((target) => [target.path, target]));
  return [...deduped.values()];
}

async function resolveQueryTargets(cwd: string, value: string | undefined, sessionPath?: string): Promise<ChangeTarget[]> {
  if (value === "all") {
    const session = await loadCurrentSession(sessionPath ?? defaultSessionPath());
    return Object.entries(session?.folders ?? {}).map(([id, folder]) => ({
      id,
      name: folder.name,
      path: folder.path,
    }));
  }

  return [await resolveTarget(cwd, value ?? cwd, sessionPath)];
}

async function resolveTarget(cwd: string, value: string, sessionPath?: string): Promise<ChangeTarget> {
  const session = await loadCurrentSession(sessionPath ?? defaultSessionPath());
  const sessionFolder = session?.folders[value];
  const candidate = sessionFolder?.path ?? path.resolve(cwd, value);
  const resolved = await realpath(candidate);
  const sessionMatch = session ? findFolderByPath(session, resolved) : undefined;
  const matchedFolder = sessionMatch ? session?.folders[sessionMatch] : undefined;
  return {
    id: sessionFolder ? value : sessionMatch,
    name: sessionFolder?.name ?? matchedFolder?.name,
    path: resolved,
  };
}

async function readChanges(root: string, activeId?: string): Promise<ChangeSummary[]> {
  const changesRoot = path.join(root, "wiki", "changes");
  const entries = await readdir(changesRoot, { withFileTypes: true }).catch((error: unknown) => {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  });

  const changes = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const changePath = path.join(changesRoot, entry.name);
        const metadata = await readChangeMetadata(changePath, entry.name);
        return {
          ...metadata,
          path: path.join("wiki", "changes", metadata.id),
          changePath,
          active: metadata.id === activeId,
        };
      }),
  );

  return changes.sort(compareChangesNewestFirst);
}

async function readChangeMetadata(changePath: string, fallbackId: string): Promise<ChangeStatusMetadata> {
  const statusPath = path.join(changePath, "status.yml");
  const parsed = (await pathExists(statusPath))
    ? (YAML.parse(await readFile(statusPath, "utf8")) as Partial<ChangeStatusMetadata> | null)
    : {};
  const id = parsed?.id ?? fallbackId;
  const slug = parsed?.slug ?? id.split("-").slice(2).join("-");
  const title = parsed?.title ?? titleFromSlug(slug);
  const type = isChangeType(parsed?.type) ? parsed.type : "feat";
  const branch = parsed?.branch ?? changeBranch(id);
  const stage = parsed?.stage ?? "exploration";
  return {
    id,
    slug,
    title,
    type,
    stage,
    branch,
    created_at: parsed?.created_at,
    updated_at: parsed?.updated_at,
  };
}

function compareChangesNewestFirst(left: ChangeSummary, right: ChangeSummary): number {
  const leftTime = left.created_at ?? left.id;
  const rightTime = right.created_at ?? right.id;
  return rightTime.localeCompare(leftTime);
}

function resolveChangeReference(changes: ChangeSummary[], value: string): ChangeSummary {
  const ref = value.trim().toLowerCase();
  const matches = changes.filter((change) => {
    const token = change.id.split("-")[1];
    return (
      change.id.toLowerCase() === ref ||
      token === ref ||
      change.slug.toLowerCase().includes(ref) ||
      change.title.toLowerCase().includes(ref)
    );
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length === 0) {
    throw new ChangeCommandError("change_not_found", `No matching change found: ${value}`);
  }

  throw new ChangeCommandError(
    "ambiguous_change",
    `Ambiguous change reference: ${value}\n${matches.map((change) => `  ${change.id} - ${change.title}`).join("\n")}`,
    { candidates: matches.map((change) => ({ id: change.id, title: change.title, type: change.type, stage: change.stage })) },
  );
}

async function currentContextForTarget(
  session: CurrentSession,
  target: ChangeTarget,
  now: Date,
  options: { saveInferred: boolean },
): Promise<CurrentChangeTargetResult> {
  const saved = activeChangeForTarget(session, target);
  const changes = await readChanges(target.path, saved?.id);
  const branch = await currentBranch(target.path);
  const inferred = branch ? inferChangeFromBranch(changes, branch) : undefined;

  if (saved && inferred && saved.id !== inferred.id) {
    const savedChange = changes.find((change) => change.id === saved.id);
    return {
      id: target.id,
      name: target.name,
      path: target.path,
      source: "session",
      saved: false,
      current: savedChange ? { ...savedChange, active: true } : undefined,
      branch,
      branchMatch: "mismatch",
      mismatch: { session: saved, branch: inferred },
    };
  }

  if (saved) {
    const current = changes.find((change) => change.id === saved.id);
    return {
      id: target.id,
      name: target.name,
      path: target.path,
      source: "session",
      saved: false,
      current: current ? { ...current, active: true } : undefined,
      branch,
      branchMatch: current ? branchMatch(branch, current.branch, await findGitRoot(target.path)) : "unknown",
    };
  }

  if (inferred && options.saveInferred) {
    setCurrentChangeForPath(session, target.path, { id: inferred.id, path: inferred.path, branch: inferred.branch }, now);
    return {
      id: target.id,
      name: target.name,
      path: target.path,
      source: "inferred_saved",
      saved: true,
      current: { ...inferred, active: true },
      branch,
      branchMatch: "match",
    };
  }

  return {
    id: target.id,
    name: target.name,
    path: target.path,
    source: "none",
    saved: false,
    branch,
    branchMatch: branch ? "unknown" : (await findGitRoot(target.path)) ? "unknown" : "not_git",
  };
}

function activeChangeForTarget(session: CurrentSession | undefined, target: ChangeTarget): SessionCurrentChange | undefined {
  const id = target.id ?? (session ? findFolderByPath(session, target.path) : undefined);
  return id ? session?.folders[id]?.current_change : undefined;
}

function activeArtifactForTarget(session: CurrentSession | undefined, target: ChangeTarget) {
  const id = target.id ?? (session ? findFolderByPath(session, target.path) : undefined);
  return id ? session?.folders[id]?.current_artifact : undefined;
}

function inferChangeFromBranch(changes: ChangeSummary[], branch: string): ChangeSummary | undefined {
  if (!branch.startsWith("change/")) {
    return undefined;
  }

  const id = branch.slice("change/".length);
  return changes.find((change) => change.id === id);
}

async function saveCurrentForTargets(
  sessionPath: string | undefined,
  updates: Array<{ root: string; changeId: string; changePath: string; branch: string }>,
  now: Date,
): Promise<void> {
  const pathToSession = sessionPath ?? defaultSessionPath();
  const session = await loadOrCreateSession(pathToSession, now);
  for (const update of updates) {
    const changeRelativePath = path.relative(update.root, update.changePath);
    setCurrentChangeForPath(
      session,
      update.root,
      {
        id: update.changeId,
        path: changeRelativePath,
        branch: update.branch,
      },
      now,
    );
    setCurrentArtifactForPath(
      session,
      update.root,
      {
        artifact: "exploration",
        change_id: update.changeId,
        path: artifactPath(changeRelativePath, "exploration"),
      },
      now,
    );
  }
  await saveCurrentSession(session, pathToSession);
}

function artifactPath(changePath: string, artifact: ArtifactName): string {
  return path.join(changePath, artifactFileName(artifact));
}

async function loadOrCreateSession(sessionPath: string, now: Date): Promise<CurrentSession> {
  return (
    (await loadCurrentSession(sessionPath)) ?? {
      version: 1,
      updated_at: now.toISOString(),
      folders: {},
    }
  );
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

function explorationTemplate(title: string, topic: string, now: Date): string {
  return `${artifactFrontmatter({ artifact: "exploration", now })}# ${titleFromSlug(slugify(title, "change")) || title}

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
  const parsed = await readChangeMetadata(changePath, fallbackId);
  return {
    id: parsed.id,
    slug: parsed.slug,
    title: parsed.title,
    type: parsed.type,
    branch: parsed.branch,
  };
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

async function assertCleanGitTargets(targets: ChangeTarget[]): Promise<void> {
  for (const target of targets) {
    const gitRoot = await findGitRoot(target.path);
    if (!gitRoot) {
      continue;
    }

    const dirty = await git(["status", "--porcelain"], gitRoot);
    if (dirty) {
      throw new ChangeCommandError("dirty_worktree", `Uncommitted changes in ${target.path}. Commit, stash, or clean them before switching change context.`, {
        path: target.path,
      });
    }
  }
}

async function currentBranch(cwd: string): Promise<string | undefined> {
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) {
    return undefined;
  }

  return git(["branch", "--show-current"], gitRoot);
}

function branchMatch(branch: string | undefined, expected: string, gitRoot: string | undefined): BranchMatch {
  if (!gitRoot) {
    return "not_git";
  }
  if (!branch) {
    return "unknown";
  }
  return branch === expected ? "match" : "mismatch";
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
    ...input.targets.map((target) => `  ${target.path} (${formatBranchStatus(target.branchStatus)}, current)`),
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

function formatListMessage(targets: ChangeTargetSummary[]): string {
  if (targets.length === 0) {
    return "No workspace folders found.";
  }

  return targets
    .map((target) => {
      const lines = [`Changes in ${target.name ?? target.path}`];
      if (target.changes.length === 0) {
        lines.push("  No changes found.");
      } else {
        lines.push(
          ...target.changes.map((change) => `${change.active ? "*" : " "} ${change.id}  ${change.type}  ${change.stage}  ${change.title}`),
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatCurrentMessage(targets: CurrentChangeTargetResult[]): string {
  if (targets.length === 0) {
    return "No workspace folders found.";
  }

  return targets.map(formatCurrentTarget).join("\n\n");
}

function formatCurrentTarget(target: CurrentChangeTargetResult): string {
  const heading = target.name ? `${target.name} (${target.path})` : target.path;
  if (!target.current) {
    if (target.mismatch) {
      return [
        `Current change in ${heading}: mismatch`,
        `Session: ${target.mismatch.session.id}`,
        `Branch: ${target.mismatch.branch.id}`,
        `Resolve with: weave change switch ${target.mismatch.branch.id}`,
      ].join("\n");
    }
    return `Current change in ${heading}: none`;
  }

  return [
    `Current change in ${heading}: ${target.current.id}`,
    `Title: ${target.current.title}`,
    `Type: ${target.current.type}`,
    `Stage: ${target.current.stage}`,
    `Branch: ${target.current.branch}`,
    `Path: ${target.current.path}`,
    `Source: ${formatCurrentSource(target.source)}`,
  ].join("\n");
}

function formatStatusMessage(targets: StatusChangeTargetResult[]): string {
  if (targets.length === 0) {
    return "No workspace folders found.";
  }

  return targets.map(formatStatusTarget).join("\n\n");
}

function formatStatusTarget(target: StatusChangeTargetResult): string {
  const heading = target.name ? `${target.name} (${target.path})` : target.path;
  if (target.mismatch) {
    return [
      `Status in ${heading}: mismatch`,
      `Session: ${target.mismatch.session.id}`,
      `Branch: ${target.mismatch.branch.id}`,
      `Resolve with: weave change switch ${target.mismatch.branch.id}`,
    ].join("\n");
  }

  if (!target.change) {
    return `Status in ${heading}: no active change`;
  }

  return [
    `Status in ${heading}: ${target.change.id}`,
    `Title: ${target.change.title}`,
    `Type: ${target.change.type}`,
    `Stage: ${target.change.stage}`,
    `Branch: ${target.change.branch}`,
    `Path: ${target.change.path}`,
    `Active: ${target.active ? "yes" : "no"}`,
    `Branch match: ${target.branchMatch}`,
    `Source: ${formatCurrentSource(target.source)}`,
  ].join("\n");
}

function formatCurrentSource(source: CurrentSource | "explicit"): string {
  switch (source) {
    case "inferred_saved":
      return "inferred from branch and saved";
    case "session":
      return "session";
    case "explicit":
      return "explicit";
    case "none":
      return "none";
  }
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

function isChangeType(value: unknown): value is ChangeType {
  return typeof value === "string" && (changeTypes as string[]).includes(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
