import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { ChangeCommandError, currentChange, type ChangeSummary, type CurrentChangeTargetResult } from "./changes.js";
import { pathExists } from "./files.js";
import { currentBranch, findGitRoot } from "./git.js";
import {
  commit,
  defaultBaseBranch,
  getDirtyFiles,
  getRemoteUrl,
  hasUpstream,
  parseGithubRepo,
  push,
  stageFiles,
  stashPop,
  stashPush,
  type CommitResult,
} from "./git-ops.js";
import {
  createPr,
  findPrForBranch,
  ghAuthOk,
  ghAvailable,
  markPrReady,
} from "./gh.js";
import { partitionDirty } from "./lane-scope.js";
import { isLaneName, type LaneName } from "./lane.js";
import {
  defaultSessionPath,
  loadCurrentSession,
  type CurrentSession,
} from "./session-state.js";

export type LaneSource = "flag" | "artifact_current" | "inferred";

export type PrAction =
  | "opened_draft"
  | "opened_ready"
  | "promoted_to_ready"
  | "existing"
  | "skipped_no_gh"
  | "skipped_unauth"
  | "skipped_non_github"
  | "skipped_no_remote"
  | "error";

export type CommitSkipReason = "no_in_scope_changes" | "guard_blocked" | "hook_failed";

export type PreconditionReason =
  | "no_active_change"
  | "wrong_branch"
  | "not_git_repo"
  | "change_corrupt";

export interface ShipPreconditionResult {
  ok: boolean;
  reason?: PreconditionReason;
  expected?: string;
  actual?: string;
}

export interface ShipGuardResult {
  ok: boolean;
  leaked_files: string[];
}

export interface ShipCommitInfo {
  sha?: string;
  skipped: boolean;
  reason?: CommitSkipReason;
}

export interface ShipPushInfo {
  pushed: boolean;
  set_upstream: boolean;
  error?: string;
}

export interface ShipPrInfo {
  url?: string;
  action: PrAction;
  error?: string;
}

export interface ShipStashInfo {
  used: boolean;
  restored: boolean;
  ref?: string;
  conflict?: string;
}

export interface ShipTargetResult {
  target_path: string;
  target_id?: string;
  change_id: string;
  branch: string;
  lane_used: LaneName;
  lane_source: LaneSource;
  precondition: ShipPreconditionResult;
  guard: ShipGuardResult;
  staged_files: string[];
  foreign_knowledge_files: string[];
  commit: ShipCommitInfo;
  push: ShipPushInfo;
  pr: ShipPrInfo;
  stash: ShipStashInfo;
  exit_code: number;
}

export interface ShipResult {
  status: "ok" | "error";
  targets: ShipTargetResult[];
  message: string;
}

export interface ShipOptions {
  cwd: string;
  lane?: LaneName;
  draft?: boolean;
  ready?: boolean;
  stash?: boolean;
  messageBody?: string;
  prBodyExtra?: string;
  target?: string;
  sessionPath?: string;
  now?: Date;
}

export class ShipPreconditionError extends Error {
  constructor(public readonly reason: PreconditionReason, message: string, public readonly details?: Record<string, string>) {
    super(message);
  }
}

export const SHIP_EXIT_OK = 0;
export const SHIP_EXIT_PRECONDITION = 2;
export const SHIP_EXIT_GUARD_OR_HOOK_OR_GH = 3;
export const SHIP_EXIT_PUSH = 4;
export const SHIP_EXIT_UNEXPECTED = 1;

export async function ship(options: ShipOptions): Promise<ShipResult> {
  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const session = await loadCurrentSession(sessionPath);
  let primaryResult;
  try {
    primaryResult = await currentChange({ cwd: options.cwd, target: options.target, sessionPath });
  } catch (error) {
    return {
      status: "error",
      targets: [],
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const primaryTargets = primaryResult.targets;
  const anchorChangeId = primaryTargets.find((t) => t.current?.id)?.current?.id;

  const allTargets: typeof primaryTargets = [...primaryTargets];
  if (anchorChangeId && options.target !== "all" && session) {
    try {
      const all = await currentChange({ cwd: options.cwd, target: "all", sessionPath });
      const seen = new Set(primaryTargets.map((t) => t.path));
      for (const target of all.targets) {
        if (target.current?.id === anchorChangeId && !seen.has(target.path)) {
          allTargets.push(target);
          seen.add(target.path);
        }
      }
    } catch {
      // best effort: stick with primary target if `all` resolution fails
    }
  }

  const targets: ShipTargetResult[] = [];
  for (const target of allTargets) {
    const result = await shipOneTarget({
      session,
      target,
      options,
    });
    targets.push(result);
  }

  const anyError = targets.some((t) => t.exit_code !== 0);
  return {
    status: anyError ? "error" : "ok",
    targets,
    message: formatShipMessage(targets),
  };
}

interface SingleTargetContext {
  session: CurrentSession | undefined;
  target: CurrentChangeTargetResult;
  options: ShipOptions;
}

async function shipOneTarget(ctx: SingleTargetContext): Promise<ShipTargetResult> {
  const result = await shipOneTargetInner(ctx);
  if (result.stash.used && !result.stash.restored) {
    const popResult = await stashPop(ctx.target.path);
    result.stash = {
      used: true,
      restored: popResult.ok,
      ref: result.stash.ref,
      conflict: popResult.ok ? undefined : popResult.conflict,
    };
  }
  return result;
}

async function shipOneTargetInner(ctx: SingleTargetContext): Promise<ShipTargetResult> {
  const { target, options, session } = ctx;
  const baseResult: ShipTargetResult = {
    target_path: target.path,
    target_id: target.id,
    change_id: target.current?.id ?? "",
    branch: target.current?.branch ?? "",
    lane_used: "exploration",
    lane_source: "inferred",
    precondition: { ok: true },
    guard: { ok: true, leaked_files: [] },
    staged_files: [],
    foreign_knowledge_files: [],
    commit: { skipped: true, reason: "no_in_scope_changes" },
    push: { pushed: false, set_upstream: false },
    pr: { action: "error" },
    stash: { used: false, restored: false },
    exit_code: SHIP_EXIT_OK,
  };

  const gitRoot = await findGitRoot(target.path);
  if (!gitRoot) {
    baseResult.precondition = { ok: false, reason: "not_git_repo" };
    baseResult.exit_code = SHIP_EXIT_PRECONDITION;
    return baseResult;
  }

  if (!target.current) {
    baseResult.precondition = { ok: false, reason: "no_active_change" };
    baseResult.exit_code = SHIP_EXIT_PRECONDITION;
    return baseResult;
  }

  const branchOnDisk = await currentBranch(target.path);
  if (!branchOnDisk || branchOnDisk !== target.current.branch) {
    baseResult.precondition = {
      ok: false,
      reason: "wrong_branch",
      expected: target.current.branch,
      actual: branchOnDisk ?? "",
    };
    baseResult.exit_code = SHIP_EXIT_PRECONDITION;
    return baseResult;
  }

  const changeRelativePath = target.current.path;
  const changeFolderAbs = path.join(target.path, changeRelativePath);

  if (!(await pathExists(path.join(changeFolderAbs, "status.yml")))) {
    baseResult.precondition = { ok: false, reason: "change_corrupt" };
    baseResult.exit_code = SHIP_EXIT_PRECONDITION;
    return baseResult;
  }

  const lane = await resolveLane({
    flag: options.lane,
    session,
    targetPath: target.path,
    changeId: target.current.id,
    changeFolderAbs,
  });

  baseResult.lane_used = lane.lane;
  baseResult.lane_source = lane.source;

  const dirty = await getDirtyFiles(target.path);
  const partition = partitionDirty(
    dirty.map((f) => f.path),
    lane.lane,
    { changeRelativePath },
  );

  baseResult.foreign_knowledge_files = partition.foreignKnowledge;

  if (partition.leaked.length > 0) {
    if (!options.stash) {
      baseResult.guard = { ok: false, leaked_files: partition.leaked };
      baseResult.commit = { skipped: true, reason: "guard_blocked" };
      baseResult.exit_code = SHIP_EXIT_GUARD_OR_HOOK_OR_GH;
      return baseResult;
    }

    const stashResult = await stashPush(
      partition.leaked,
      `weave-ship: stashed leaked files for ${target.current.id}`,
      target.path,
    );
    if (!stashResult.ok) {
      baseResult.guard = { ok: false, leaked_files: partition.leaked };
      baseResult.commit = { skipped: true, reason: "guard_blocked" };
      baseResult.exit_code = SHIP_EXIT_GUARD_OR_HOOK_OR_GH;
      baseResult.stash = { used: true, restored: false, conflict: stashResult.error };
      return baseResult;
    }
    baseResult.stash = { used: true, restored: false, ref: stashResult.ref };
    baseResult.guard = { ok: true, leaked_files: [] };
  }

  const filesToStage = [...partition.inScope, ...partition.foreignKnowledge];

  if (filesToStage.length === 0) {
    baseResult.commit = { skipped: true, reason: "no_in_scope_changes" };
    const existingPr = await tryFindPrForBranch(target.current.branch, target.path);
    if (existingPr) {
      if (existingPr.isDraft && shouldPromoteToReady(lane.lane, options)) {
        const ready = await markPrReady({ branch: target.current.branch }, target.path);
        if (ready.ok) {
          baseResult.pr = { url: existingPr.url, action: "promoted_to_ready" };
        } else {
          baseResult.pr = { url: existingPr.url, action: "existing", error: ready.errorMessage };
        }
      } else {
        baseResult.pr = { url: existingPr.url, action: "existing" };
      }
      return baseResult;
    }
    return baseResult;
  }

  baseResult.staged_files = filesToStage;
  if (partition.foreignKnowledge.length > 0) {
    process.stderr.write(
      `weave: warning: bundling ${partition.foreignKnowledge.length} foreign knowledge file(s) with this ship:\n` +
        partition.foreignKnowledge.map((f) => `  - ${f}\n`).join(""),
    );
  }
  await stageFiles(filesToStage, target.path);

  const subject = await buildCommitSubject({
    target,
    lane: lane.lane,
    change: target.current,
    changeFolderAbs,
  });
  const body = await buildCommitBody({
    stagedFiles: filesToStage,
    foreignKnowledge: partition.foreignKnowledge,
    changeFolderAbs,
    lane: lane.lane,
    extra: options.messageBody,
  });

  let commitResult: CommitResult = await commit({ subject, body }, target.path);
  if (!commitResult.ok) {
    const dirtyAfter = await getDirtyFiles(target.path);
    const trackedFiles = new Set(filesToStage);
    const hookTouched = dirtyAfter.some((f) => trackedFiles.has(f.path));
    if (hookTouched) {
      await stageFiles(filesToStage, target.path);
      commitResult = await commit({ subject, body }, target.path);
    }
  }
  if (!commitResult.ok) {
    baseResult.commit = { skipped: true, reason: "hook_failed" };
    baseResult.exit_code = SHIP_EXIT_GUARD_OR_HOOK_OR_GH;
    baseResult.pr = { action: "error", error: commitResult.errorMessage };
    return baseResult;
  }

  baseResult.commit = { sha: commitResult.sha, skipped: false };

  const upstream = await hasUpstream(target.path);
  const pushResult = await push({ setUpstream: !upstream }, target.path);
  baseResult.push = {
    pushed: pushResult.pushed,
    set_upstream: pushResult.setUpstream,
    error: pushResult.error,
  };
  if (!pushResult.pushed) {
    baseResult.exit_code = SHIP_EXIT_PUSH;
    baseResult.pr = { action: "error", error: pushResult.error };
    return baseResult;
  }

  baseResult.pr = await ensurePr({
    target,
    changeFolderAbs,
    lane: lane.lane,
    options,
  });
  if (baseResult.pr.action === "error") {
    baseResult.exit_code = SHIP_EXIT_GUARD_OR_HOOK_OR_GH;
  }

  return baseResult;
}

interface ResolveLaneArgs {
  flag?: LaneName;
  session: CurrentSession | undefined;
  targetPath: string;
  changeId: string;
  changeFolderAbs: string;
}

interface ResolvedLane {
  lane: LaneName;
  source: LaneSource;
}

export async function inferLaneFromArtifacts(changeFolderAbs: string): Promise<LaneName> {
  if (await hasMeaningfulFile(path.join(changeFolderAbs, "tasks.md"), 200)) {
    return "implementation";
  }
  if (await pathExists(path.join(changeFolderAbs, "architecture.md"))) {
    return "architecture";
  }
  if (await pathExists(path.join(changeFolderAbs, "prd.md"))) {
    return "prd";
  }
  return "exploration";
}

async function hasMeaningfulFile(filePath: string, minSize: number): Promise<boolean> {
  if (!(await pathExists(filePath))) {
    return false;
  }
  try {
    const content = await readFile(filePath, "utf8");
    const stripped = content.replace(/^---[\s\S]*?---\s*/m, "").trim();
    return stripped.length >= minSize;
  } catch {
    return false;
  }
}

async function resolveLane(args: ResolveLaneArgs): Promise<ResolvedLane> {
  if (args.flag && isLaneName(args.flag)) {
    return { lane: args.flag, source: "flag" };
  }

  const folderId = args.session ? findFolderIdForPath(args.session, args.targetPath) : undefined;
  const sessionLane =
    folderId && args.session?.folders[folderId]?.current_artifact?.change_id === args.changeId
      ? args.session.folders[folderId]?.current_artifact?.artifact
      : undefined;
  if (sessionLane && isLaneName(sessionLane)) {
    return { lane: sessionLane, source: "artifact_current" };
  }

  const inferred = await inferLaneFromArtifacts(args.changeFolderAbs);
  return { lane: inferred, source: "inferred" };
}

function findFolderIdForPath(session: CurrentSession, targetPath: string): string | undefined {
  for (const [id, folder] of Object.entries(session.folders)) {
    if (folder.path === targetPath) {
      return id;
    }
  }
  return undefined;
}

interface CommitSubjectArgs {
  target: SingleTargetContext["target"];
  lane: LaneName;
  change: ChangeSummary;
  changeFolderAbs: string;
}

async function buildCommitSubject(args: CommitSubjectArgs): Promise<string> {
  return `${args.change.type}(${args.change.id}): ${args.lane} - ${args.change.title}`;
}

interface CommitBodyArgs {
  stagedFiles: string[];
  foreignKnowledge: string[];
  changeFolderAbs: string;
  lane: LaneName;
  extra?: string;
}

async function buildCommitBody(args: CommitBodyArgs): Promise<string> {
  const sections: string[] = [];

  const filesSection = ["Files:", ...args.stagedFiles.map((f) => `  - ${f}`)].join("\n");
  sections.push(filesSection);

  const summary = await readLatestSessionSummary(args.changeFolderAbs, args.lane);
  if (summary) {
    sections.push(`Summary:\n${summary}`);
  }

  if (args.foreignKnowledge.length > 0) {
    sections.push(
      ["Foreign knowledge files included:", ...args.foreignKnowledge.map((f) => `  - ${f}`)].join("\n"),
    );
  }

  if (args.extra && args.extra.trim().length > 0) {
    sections.push(args.extra.trim());
  }

  return sections.join("\n\n");
}

async function readLatestSessionSummary(changeFolderAbs: string, lane: LaneName): Promise<string | undefined> {
  const sessionsDir = path.join(changeFolderAbs, "sessions");
  if (!(await pathExists(sessionsDir))) {
    return undefined;
  }

  const entries = await readdir(sessionsDir).catch(() => [] as string[]);
  const candidates = entries
    .filter((name) => name.endsWith(".md"))
    .filter((name) => name.includes(`-${lane}.`) || name.includes(`-${lane}-`))
    .sort()
    .reverse();

  for (const name of candidates) {
    const summary = await extractSessionSummary(path.join(sessionsDir, name));
    if (summary) {
      return summary;
    }
  }

  const fallback = entries.filter((name) => name.endsWith(".md")).sort().reverse();
  for (const name of fallback) {
    const summary = await extractSessionSummary(path.join(sessionsDir, name));
    if (summary) {
      return summary;
    }
  }

  return undefined;
}

async function extractSessionSummary(filePath: string): Promise<string | undefined> {
  try {
    const text = await readFile(filePath, "utf8");
    const match = text.match(/^##\s+Summary\s*\n([\s\S]*?)(?:\n## |\n*$)/m);
    if (!match) {
      return undefined;
    }
    const body = match[1].trim();
    return body.length > 0 ? body : undefined;
  } catch {
    return undefined;
  }
}

interface EnsurePrArgs {
  target: SingleTargetContext["target"];
  changeFolderAbs: string;
  lane: LaneName;
  options: ShipOptions;
}

async function ensurePr(args: EnsurePrArgs): Promise<ShipPrInfo> {
  const remote = await getRemoteUrl(args.target.path);
  if (!remote) {
    return { action: "skipped_no_remote" };
  }
  if (!parseGithubRepo(remote)) {
    return { action: "skipped_non_github" };
  }
  if (!(await ghAvailable())) {
    return { action: "skipped_no_gh" };
  }
  if (!(await ghAuthOk(args.target.path))) {
    return { action: "skipped_unauth" };
  }

  const branch = args.target.current?.branch ?? "";
  if (!branch) {
    return { action: "error", error: "Active change has no branch" };
  }

  const existing = await findPrForBranch(branch, args.target.path);
  if (existing) {
    if (existing.isDraft && shouldPromoteToReady(args.lane, args.options)) {
      const ready = await markPrReady({ branch }, args.target.path);
      if (ready.ok) {
        return { action: "promoted_to_ready", url: existing.url };
      }
      return { action: "existing", url: existing.url, error: ready.errorMessage };
    }
    return { action: "existing", url: existing.url };
  }

  const base = await defaultBaseBranch(args.target.path);
  const draft = computeDraftDefault(args.lane, args.options);
  const title = await buildPrTitle(args.target.current!, args.lane);
  const body = await buildPrBody({
    target: args.target,
    changeFolderAbs: args.changeFolderAbs,
    lane: args.lane,
    extra: args.options.prBodyExtra,
  });

  const result = await createPr({ base, head: branch, title, body, draft }, args.target.path);
  if (!result.ok) {
    return { action: "error", error: result.errorMessage };
  }
  return { action: draft ? "opened_draft" : "opened_ready", url: result.url };
}

function computeDraftDefault(lane: LaneName, options: ShipOptions): boolean {
  if (options.draft) {
    return true;
  }
  if (options.ready) {
    return false;
  }
  return lane === "exploration" || lane === "prd" || lane === "architecture";
}

function shouldPromoteToReady(lane: LaneName, options: ShipOptions): boolean {
  if (options.draft) {
    return false;
  }
  if (options.ready) {
    return true;
  }
  return lane === "implementation" || lane === "review";
}

async function buildPrTitle(change: ChangeSummary, _lane: LaneName): Promise<string> {
  return `${change.type}: ${change.title}`;
}

interface PrBodyArgs {
  target: SingleTargetContext["target"];
  changeFolderAbs: string;
  lane: LaneName;
  extra?: string;
}

async function buildPrBody(args: PrBodyArgs): Promise<string> {
  const change = args.target.current!;
  const lines: string[] = [];
  lines.push(`## Weave change`);
  lines.push("");
  lines.push(`- Change: \`${change.id}\``);
  lines.push(`- Title: ${change.title}`);
  lines.push(`- Type: ${change.type}`);
  lines.push(`- Lane: ${args.lane}`);
  lines.push("");
  lines.push("## Artifacts");
  lines.push("");

  const reviewPointers = laneReviewPointer(args.lane);
  for (const artifact of ["exploration.md", "prd.md", "architecture.md", "tasks.md"]) {
    const exists = await pathExists(path.join(args.changeFolderAbs, artifact));
    if (exists) {
      lines.push(`- \`${path.join("wiki", "changes", change.id, artifact)}\``);
    }
  }
  lines.push("");
  lines.push("## How to review");
  lines.push("");
  lines.push(reviewPointers);

  if (args.extra && args.extra.trim().length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(args.extra.trim());
  }

  return lines.join("\n");
}

function laneReviewPointer(lane: LaneName): string {
  switch (lane) {
    case "exploration":
      return "Read `exploration.md`. Skim sessions for decision history.";
    case "prd":
      return "Read `prd.md` first. Cross-check the open questions and acceptance criteria.";
    case "architecture":
      return "Read `architecture.md`. Verify decisions, tradeoffs, and integration points.";
    case "implementation":
      return "Read `tasks.md`, then the diff. Confirm acceptance criteria are met for each landed slice.";
    case "review":
      return "Read the diff against the architecture and tasks list. Confirm the rollout/observability story.";
  }
}

async function tryFindPrForBranch(
  branch: string,
  cwd: string,
): Promise<{ url: string; isDraft: boolean } | undefined> {
  if (!(await ghAvailable())) {
    return undefined;
  }
  if (!(await ghAuthOk(cwd))) {
    return undefined;
  }
  const existing = await findPrForBranch(branch, cwd);
  if (existing) {
    return { url: existing.url, isDraft: existing.isDraft };
  }
  return undefined;
}

function formatShipMessage(targets: ShipTargetResult[]): string {
  if (targets.length === 0) {
    return "weave ship: nothing to ship.";
  }
  return targets
    .map((target) => {
      const lines: string[] = [];
      lines.push(`Target: ${target.target_path}`);
      if (!target.precondition.ok) {
        lines.push(`  Precondition: ${target.precondition.reason ?? "failed"}`);
        if (target.precondition.expected) {
          lines.push(`    expected branch: ${target.precondition.expected}`);
        }
        if (target.precondition.actual) {
          lines.push(`    actual branch:   ${target.precondition.actual}`);
        }
        return lines.join("\n");
      }

      lines.push(`  Lane: ${target.lane_used} (source: ${target.lane_source})`);
      if (target.guard.leaked_files.length > 0) {
        lines.push(`  Guard: blocked - ${target.guard.leaked_files.length} leaked file(s)`);
        for (const file of target.guard.leaked_files) {
          lines.push(`    - ${file}`);
        }
      }
      if (target.commit.sha) {
        lines.push(`  Commit: ${target.commit.sha.slice(0, 12)}`);
      } else if (target.commit.skipped && target.commit.reason) {
        lines.push(`  Commit: skipped (${target.commit.reason})`);
      }
      if (target.push.pushed) {
        lines.push(`  Push: ok${target.push.set_upstream ? " (set upstream)" : ""}`);
      } else if (target.push.error) {
        lines.push(`  Push: failed - ${target.push.error}`);
      }
      if (target.pr.url) {
        lines.push(`  PR: ${target.pr.action} - ${target.pr.url}`);
      } else if (target.pr.action.startsWith("skipped")) {
        lines.push(`  PR: ${target.pr.action}`);
      } else if (target.pr.action === "error" && target.pr.error) {
        lines.push(`  PR: error - ${target.pr.error}`);
      }
      if (target.foreign_knowledge_files.length > 0) {
        lines.push(`  Foreign knowledge: ${target.foreign_knowledge_files.length} file(s) bundled`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export class ShipError extends Error {}

export { ChangeCommandError };
