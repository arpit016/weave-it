import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { createChange } from "../src/lib/changes.js";
import { prepareTasks } from "../src/lib/task-prepare.js";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(__dirname, "..");
const cliEntry = path.resolve(projectRoot, "src", "cli.ts");
const tsxBinary = path.resolve(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");

async function rawTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-task-prepare-"));
}

async function writeWorkspaceMetadata(cwd: string, mode: "repo" | "workspace", repos: Record<string, { path: string; kind?: string }> = {}): Promise<void> {
  await mkdir(path.join(cwd, ".weave"), { recursive: true });
  await writeFile(
    path.join(cwd, ".weave", "workspace.yml"),
    YAML.stringify({
      version: 1,
      mode,
      name: path.basename(cwd),
      repos: Object.fromEntries(Object.entries(repos).map(([id, entry]) => [id, { path: entry.path, kind: entry.kind ?? "app" }])),
    }),
  );
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function initGit(cwd: string): Promise<void> {
  await git(cwd, ["init"]);
  await git(cwd, ["config", "user.name", "Weave Test"]);
  await git(cwd, ["config", "user.email", "weave@example.com"]);
  await writeFile(path.join(cwd, "README.md"), "initial\n");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "initial"]);
}

async function createRepoModeChange(cwd: string): Promise<{ id: string; branch: string; changePath: string; sessionPath: string }> {
  await writeWorkspaceMetadata(cwd, "repo");
  const sessionPath = path.join(cwd, ".session.yml");
  const created = await createChange({ cwd, title: "Task prepare", now: new Date("2026-06-07T10:00:00.000Z"), randomId: () => "prep", sessionPath });
  const changePath = path.join(cwd, "wiki", "changes", created.id);
  return { id: created.id, branch: created.branch, changePath, sessionPath };
}

async function createWorkspaceChange(workspace: string): Promise<{ id: string; branch: string; changePath: string; sessionPath: string }> {
  await writeWorkspaceMetadata(workspace, "workspace", {
    api: { path: "api" },
    web: { path: "web" },
    docs: { path: "docs", kind: "docs" },
  });
  await mkdir(path.join(workspace, "api"), { recursive: true });
  await mkdir(path.join(workspace, "web"), { recursive: true });
  await mkdir(path.join(workspace, "docs"), { recursive: true });
  const sessionPath = path.join(workspace, ".session.yml");
  const created = await createChange({ cwd: workspace, title: "Workspace prepare", now: new Date("2026-06-07T10:00:00.000Z"), randomId: () => "work", sessionPath });
  const changePath = path.join(workspace, "wiki", "changes", created.id);
  return { id: created.id, branch: created.branch, changePath, sessionPath };
}

async function readStatus(changePath: string): Promise<Record<string, unknown>> {
  return YAML.parse(await readFile(path.join(changePath, "status.yml"), "utf8")) as Record<string, unknown>;
}

describe("task prepare", () => {
  it("records repo-mode root readiness and preserves prepared_at", async () => {
    const cwd = await rawTempDir();
    const change = await createRepoModeChange(cwd);

    const first = await prepareTasks({ cwd, now: new Date("2026-06-07T10:01:00.000Z"), sessionPath: change.sessionPath });
    const second = await prepareTasks({ cwd, now: new Date("2026-06-07T10:02:00.000Z"), sessionPath: change.sessionPath });
    const status = await readStatus(change.changePath);

    expect(first.status).toBe("ok");
    expect(second.repos[0]).toMatchObject({ id: "root", branch_status: "skipped_not_git", state: "skipped" });
    expect(status.execution).toMatchObject({
      version: 1,
      branch: change.branch,
      repos: {
        root: {
          path: ".",
          mode: "repo",
          branch_status: "skipped_not_git",
          prepared_at: "2026-06-07T10:01:00.000Z",
          verified_at: "2026-06-07T10:02:00.000Z",
        },
      },
    });
  });

  it("blocks repo-mode prepare when the artifact root branch differs", async () => {
    const cwd = await rawTempDir();
    await writeWorkspaceMetadata(cwd, "repo");
    await initGit(cwd);
    const change = await createRepoModeChange(cwd);
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-m", "change"]);
    await git(cwd, ["checkout", "-b", "other"]);

    const result = await prepareTasks({ cwd, sessionPath: change.sessionPath });

    expect(result.status).toBe("blocked");
    expect(result.blockers[0].reason).toContain(`expected ${change.branch}`);
  });

  it("prepares all registered workspace repos and skips non-git folders without tasks.md", async () => {
    const workspace = await rawTempDir();
    const change = await createWorkspaceChange(workspace);
    const api = path.join(workspace, "api");
    const web = path.join(workspace, "web");
    await initGit(api);
    await initGit(web);
    const webBaseBranch = await git(web, ["branch", "--show-current"]);
    await git(web, ["checkout", "-b", change.branch]);
    await git(web, ["checkout", webBaseBranch]);

    const result = await prepareTasks({ cwd: workspace, now: new Date("2026-06-07T10:03:00.000Z"), sessionPath: change.sessionPath });
    const status = await readStatus(change.changePath);

    expect(result.status).toBe("ok");
    expect(result.repos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "api", branch_status: "created", state: "prepared" }),
        expect.objectContaining({ id: "web", branch_status: "checked_out", state: "prepared" }),
        expect.objectContaining({ id: "docs", branch_status: "skipped_not_git", state: "skipped" }),
      ]),
    );
    await expect(git(api, ["branch", "--show-current"])).resolves.toBe(change.branch);
    await expect(git(web, ["branch", "--show-current"])).resolves.toBe(change.branch);
    expect(status.execution).toMatchObject({
      branch: change.branch,
      repos: {
        api: { path: "api", mode: "workspace", branch_status: "created" },
        web: { path: "web", mode: "workspace", branch_status: "checked_out" },
        docs: { path: "docs", mode: "workspace", branch_status: "skipped_not_git" },
      },
    });
  });

  it("preserves execution repo prepared_at across repeated workspace readiness checks", async () => {
    const workspace = await rawTempDir();
    const change = await createWorkspaceChange(workspace);
    await initGit(path.join(workspace, "api"));

    await prepareTasks({ cwd: workspace, now: new Date("2026-06-07T10:04:00.000Z"), sessionPath: change.sessionPath });
    await prepareTasks({ cwd: workspace, now: new Date("2026-06-07T10:05:00.000Z"), sessionPath: change.sessionPath });
    const status = await readStatus(change.changePath);

    expect(status.execution).toMatchObject({
      repos: {
        api: { path: "api", prepared_at: "2026-06-07T10:04:00.000Z", verified_at: "2026-06-07T10:05:00.000Z" },
        docs: { path: "docs", prepared_at: "2026-06-07T10:04:00.000Z", verified_at: "2026-06-07T10:05:00.000Z" },
      },
    });
  });

  it("blocks workspace prepare for missing registered repo paths", async () => {
    const workspace = await rawTempDir();
    await writeWorkspaceMetadata(workspace, "workspace", {
      missing: { path: "missing" },
    });
    const sessionPath = path.join(workspace, ".session.yml");
    const created = await createChange({ cwd: workspace, title: "Bad repo metadata", now: new Date("2026-06-07T10:00:00.000Z"), randomId: () => "badm", sessionPath });

    const result = await prepareTasks({ cwd: workspace, sessionPath });

    expect(result.status).toBe("blocked");
    expect(result.blockers).toContainEqual({ target: "missing", reason: "Registered repo path does not exist: missing" });
    expect(created.id).toBeDefined();
  });

  it("blocks workspace implementation repo actions when the artifact root branch differs", async () => {
    const workspace = await rawTempDir();
    await writeWorkspaceMetadata(workspace, "workspace", { api: { path: "api" } });
    await mkdir(path.join(workspace, "api"), { recursive: true });
    await initGit(workspace);
    const sessionPath = path.join(workspace, ".session.yml");
    const created = await createChange({ cwd: workspace, title: "Workspace root mismatch", now: new Date("2026-06-07T10:00:00.000Z"), randomId: () => "wmix", sessionPath });
    await git(workspace, ["add", "."]);
    await git(workspace, ["commit", "-m", "change"]);
    await git(workspace, ["checkout", "-b", "other"]);
    const api = path.join(workspace, "api");
    await initGit(api);
    const apiBaseBranch = await git(api, ["branch", "--show-current"]);

    const result = await prepareTasks({ cwd: workspace, sessionPath });

    expect(result.status).toBe("blocked");
    expect(result.blockers[0].reason).toContain(`expected ${created.branch}`);
    await expect(git(api, ["branch", "--show-current"])).resolves.toBe(apiBaseBranch);
  });

  it("blocks detached HEAD implementation repos", async () => {
    const workspace = await rawTempDir();
    const change = await createWorkspaceChange(workspace);
    const api = path.join(workspace, "api");
    await initGit(api);
    await git(api, ["checkout", "--detach", "HEAD"]);

    const result = await prepareTasks({ cwd: workspace, sessionPath: change.sessionPath });

    expect(result.status).toBe("blocked");
    expect(result.blockers).toContainEqual({ target: "api", reason: "Repo is in detached HEAD or has no current branch." });
  });

  it("refreshes selected repos when execution.branch is stale", async () => {
    const workspace = await rawTempDir();
    const change = await createWorkspaceChange(workspace);
    const api = path.join(workspace, "api");
    await initGit(api);
    await prepareTasks({ cwd: workspace, now: new Date("2026-06-07T10:06:00.000Z"), sessionPath: change.sessionPath });
    const statusPath = path.join(change.changePath, "status.yml");
    const status = YAML.parse(await readFile(statusPath, "utf8"));
    status.branch = "change/new-readiness-branch";
    await writeFile(statusPath, YAML.stringify(status));

    await prepareTasks({ cwd: workspace, now: new Date("2026-06-07T10:07:00.000Z"), sessionPath: change.sessionPath });
    const nextStatus = await readStatus(change.changePath);

    expect(nextStatus.execution).toMatchObject({
      branch: "change/new-readiness-branch",
      repos: {
        api: { branch: "change/new-readiness-branch", prepared_at: "2026-06-07T10:07:00.000Z" },
        web: { branch: "change/new-readiness-branch", prepared_at: "2026-06-07T10:07:00.000Z" },
        docs: { branch: "change/new-readiness-branch", prepared_at: "2026-06-07T10:07:00.000Z" },
      },
    });
    await expect(git(api, ["branch", "--show-current"])).resolves.toBe("change/new-readiness-branch");
  });

  it("blocks all workspace branch movement when one selected repo is dirty on another branch", async () => {
    const workspace = await rawTempDir();
    const change = await createWorkspaceChange(workspace);
    const api = path.join(workspace, "api");
    const web = path.join(workspace, "web");
    await initGit(api);
    await initGit(web);
    const apiBaseBranch = await git(api, ["branch", "--show-current"]);
    await writeFile(path.join(web, "dirty.txt"), "dirty\n");

    const result = await prepareTasks({ cwd: workspace, sessionPath: change.sessionPath });

    expect(result.status).toBe("blocked");
    expect(result.blockers[0].reason).toContain("uncommitted changes");
    await expect(git(api, ["branch", "--show-current"])).resolves.toBe(apiBaseBranch);
  });

  it("allows dirty workspace repos already on the expected branch", async () => {
    const workspace = await rawTempDir();
    const change = await createWorkspaceChange(workspace);
    const api = path.join(workspace, "api");
    await initGit(api);
    await git(api, ["checkout", "-b", change.branch]);
    await writeFile(path.join(api, "dirty.txt"), "dirty\n");

    const result = await prepareTasks({ cwd: workspace, sessionPath: change.sessionPath });

    expect(result.status).toBe("ok");
    expect(result.repos[0]).toMatchObject({ id: "api", branch_status: "already_active" });
  });

  it("exposes deterministic CLI help without task selectors", () => {
    const cwd = os.tmpdir();
    const help = spawnSync(process.execPath, [tsxBinary, cliEntry, "task", "prepare", "--help"], { cwd, encoding: "utf8" });

    expect(help.status).toBe(0);
    expect(help.stdout).toContain("--json");
    expect(help.stdout).not.toContain("--scope <scope>");
    expect(help.stdout).not.toContain("--all");
  });
});
