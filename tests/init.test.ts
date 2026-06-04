import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { addFolder } from "../src/lib/add-folder.js";
import { initWorkspace } from "../src/lib/init-workspace.js";
import { loadCurrentSession } from "../src/lib/session-state.js";
import { showWorkspace } from "../src/lib/show-workspace.js";

const execFileAsync = promisify(execFile);

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-it-"));
}

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Weave Test",
      GIT_AUTHOR_EMAIL: "weave-test@example.invalid",
      GIT_COMMITTER_NAME: "Weave Test",
      GIT_COMMITTER_EMAIL: "weave-test@example.invalid",
    },
  });
}

describe("current session workflow", () => {
  it("initializes repo wiki scaffold and starts a current session", async () => {
    const cwd = await tempDir();
    const resolvedCwd = await realpath(cwd);
    const sessionPath = path.join(cwd, ".cache", "current-session.yml");

    const result = await initWorkspace({
      cwd,
      interactive: false,
      yes: true,
      folderId: "frontend",
      folderKind: "app",
      now: new Date("2026-05-17T10:00:00.000Z"),
      sessionPath,
    });

    expect(result.status).toBe("initialized");
    expect(result.mode).toBe("repo");
    expect(result.wikiDir).toBe(path.join(resolvedCwd, "wiki"));
    expect(result.metadataDir).toBe(path.join(resolvedCwd, ".weave"));
    await expect(stat(path.join(cwd, "wiki", "changes"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, "wiki", "knowledge", "domains"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, "wiki", "knowledge", "shared"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".weave", "sync.yml"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".weave", "workspace.yml"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".git"))).rejects.toThrow();
    await expect(stat(path.join(cwd, "weave"))).rejects.toThrow();
    await expect(stat(path.join(cwd, ".weave", "local.yml"))).rejects.toThrow();

    const sync = YAML.parse(await readFile(path.join(cwd, ".weave", "sync.yml"), "utf8"));
    const workspace = YAML.parse(await readFile(path.join(cwd, ".weave", "workspace.yml"), "utf8"));
    const knowledge = await readFile(path.join(cwd, "wiki", "knowledge", "index.md"), "utf8");
    const knowledgeReadme = await readFile(path.join(cwd, "wiki", "knowledge", "README.md"), "utf8");
    const domainsReadme = await readFile(path.join(cwd, "wiki", "knowledge", "domains", "README.md"), "utf8");
    const sharedReadme = await readFile(path.join(cwd, "wiki", "knowledge", "shared", "README.md"), "utf8");
    const session = await loadCurrentSession(sessionPath);

    expect(sync.documents["knowledge.index"].path).toBe("wiki/knowledge/index.md");
    expect(sync.documents["knowledge.index"].status).toBe("synced");
    expect(Object.keys(sync.documents)).toEqual(["knowledge.index"]);
    expect(workspace).toMatchObject({
      version: 1,
      mode: "repo",
      name: "Frontend",
      repos: {},
    });
    expect(knowledge).toContain("# Product Knowledge");
    expect(knowledgeReadme).toContain("domains/");
    expect(knowledgeReadme).toContain("features/");
    expect(knowledgeReadme).toContain("domain-wide/");
    expect(knowledgeReadme).toContain("shared/");
    expect(knowledgeReadme).toContain("behavior.md");
    expect(knowledgeReadme).toContain("knowledge-delta.md");
    expect(domainsReadme).toContain("# Domains");
    expect(sharedReadme).toContain("# Shared Behavior");
    expect(session?.folders.frontend).toMatchObject({
      path: resolvedCwd,
      name: "Frontend",
      kind: "app",
    });
  });

  it("does not overwrite existing wiki and metadata files when init runs again", async () => {
    const cwd = await tempDir();
    const sessionPath = path.join(cwd, ".cache", "current-session.yml");
    const wikiDir = path.join(cwd, "wiki", "knowledge");
    const metadataDir = path.join(cwd, ".weave");
    const knowledgeFile = path.join(wikiDir, "index.md");
    const knowledgeReadme = path.join(wikiDir, "README.md");
    const domainsReadme = path.join(wikiDir, "domains", "README.md");
    const sharedReadme = path.join(wikiDir, "shared", "README.md");
    const syncFile = path.join(metadataDir, "sync.yml");
    const workspaceFile = path.join(metadataDir, "workspace.yml");
    await mkdir(path.join(wikiDir, "domains"), { recursive: true });
    await mkdir(path.join(wikiDir, "shared"), { recursive: true });
    await mkdir(metadataDir, { recursive: true });
    await writeFile(knowledgeFile, "existing wiki\n");
    await writeFile(knowledgeReadme, "existing knowledge readme\n");
    await writeFile(domainsReadme, "existing domains readme\n");
    await writeFile(sharedReadme, "existing shared readme\n");
    await writeFile(syncFile, "existing: true\n");
    await writeFile(workspaceFile, "existing: true\n");

    const result = await initWorkspace({ cwd, interactive: false, yes: true, sessionPath });

    expect(result.status).toBe("initialized");
    await expect(readFile(knowledgeFile, "utf8")).resolves.toBe("existing wiki\n");
    await expect(readFile(knowledgeReadme, "utf8")).resolves.toBe("existing knowledge readme\n");
    await expect(readFile(domainsReadme, "utf8")).resolves.toBe("existing domains readme\n");
    await expect(readFile(sharedReadme, "utf8")).resolves.toBe("existing shared readme\n");
    await expect(readFile(syncFile, "utf8")).resolves.toBe("existing: true\n");
    await expect(readFile(workspaceFile, "utf8")).resolves.toBe("existing: true\n");
  });

  it("initializes workspace mode outside a git repo", async () => {
    const root = await tempDir();
    const workspacePath = path.join(root, "platform");
    const sessionPath = path.join(root, ".cache", "current-session.yml");

    const result = await initWorkspace({
      cwd: root,
      mode: "workspace",
      workspaceName: "peoplebox-platform",
      workspacePath,
      interactive: false,
      yes: true,
      now: new Date("2026-05-17T10:00:00.000Z"),
      sessionPath,
    });

    const workspace = YAML.parse(await readFile(path.join(workspacePath, ".weave", "workspace.yml"), "utf8"));
    const session = await loadCurrentSession(sessionPath);

    expect(result.status).toBe("initialized");
    expect(result.mode).toBe("workspace");
    expect(result.commitCreated).toBe(true);
    await expect(stat(path.join(workspacePath, ".git"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspacePath, ".gitignore"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspacePath, "wiki", "changes"))).resolves.toMatchObject({});
    await expect(stat(path.join(workspacePath, ".weave", "sync.yml"))).resolves.toMatchObject({});
    expect(workspace).toMatchObject({
      version: 1,
      mode: "workspace",
      name: "peoplebox-platform",
      repos: {},
    });
    expect(session?.folders["peoplebox-platform"]).toMatchObject({
      path: await realpath(workspacePath),
      kind: "workspace",
    });
  });

  it("adopts the current git repo into workspace mode", async () => {
    const root = await tempDir();
    const repo = path.join(root, "app-repo");
    const nested = path.join(repo, "src");
    const workspacePath = path.join(root, "peoplebox-platform");
    const movedRepo = path.join(workspacePath, "app-repo");
    const sessionPath = path.join(root, ".cache", "current-session.yml");
    await mkdir(nested, { recursive: true });
    await git(repo, ["init"]);
    await git(repo, ["remote", "add", "origin", "git@example.com:peoplebox/app-repo.git"]);
    await writeFile(path.join(nested, "dirty.txt"), "not committed\n");

    const result = await initWorkspace({
      cwd: nested,
      mode: "workspace",
      workspaceName: "peoplebox-platform",
      interactive: false,
      yes: true,
      now: new Date("2026-05-17T10:00:00.000Z"),
      sessionPath,
    });

    const workspace = YAML.parse(await readFile(path.join(workspacePath, ".weave", "workspace.yml"), "utf8"));
    const gitignore = await readFile(path.join(workspacePath, ".gitignore"), "utf8");
    const session = await loadCurrentSession(sessionPath);
    const resolvedWorkspacePath = await realpath(workspacePath);

    expect(result.status).toBe("initialized");
    expect(result.folderPath).toBe(resolvedWorkspacePath);
    await expect(stat(repo)).rejects.toThrow();
    await expect(stat(path.join(movedRepo, ".git"))).resolves.toMatchObject({});
    await expect(readFile(path.join(movedRepo, "src", "dirty.txt"), "utf8")).resolves.toBe("not committed\n");
    expect(gitignore).toContain("/app-repo/");
    expect(workspace.repos["app-repo"]).toMatchObject({
      path: "app-repo",
      kind: "app",
      remote: "git@example.com:peoplebox/app-repo.git",
    });
    expect(session?.folders["peoplebox-platform"]).toMatchObject({
      path: resolvedWorkspacePath,
      kind: "workspace",
    });
  });

  it("refuses non-interactive adoption of the Weave source repo without an explicit workspace path", async () => {
    const root = await tempDir();
    const repo = path.join(root, "weave-it");
    await mkdir(repo);
    await git(repo, ["init"]);
    await writeFile(path.join(repo, "package.json"), '{"name":"weave-it"}\n');

    await expect(
      initWorkspace({
        cwd: repo,
        mode: "workspace",
        workspaceName: "demo-platform",
        interactive: false,
        yes: true,
        sessionPath: path.join(root, ".cache", "current-session.yml"),
      }),
    ).rejects.toThrow(/Refusing to adopt the Weave source repo/);

    await expect(stat(repo)).resolves.toMatchObject({});
  });

  it("refuses workspace adoption when the workspace path already exists", async () => {
    const root = await tempDir();
    const repo = path.join(root, "app-repo");
    const workspacePath = path.join(root, "peoplebox-platform");
    await mkdir(repo);
    await mkdir(workspacePath);
    await git(repo, ["init"]);

    await expect(
      initWorkspace({
        cwd: repo,
        mode: "workspace",
        workspaceName: "peoplebox-platform",
        interactive: false,
        yes: true,
        sessionPath: path.join(root, ".cache", "current-session.yml"),
      }),
    ).rejects.toThrow(/Workspace path already exists/);

    await expect(stat(repo)).resolves.toMatchObject({});
  });

  it("requires init before adding folders", async () => {
    const cwd = await tempDir();
    const backend = path.join(cwd, "backend");
    const sessionPath = path.join(cwd, ".cache", "current-session.yml");
    await mkdir(backend);

    const result = await addFolder({ cwd, targetPath: "backend", sessionPath });

    expect(result.status).toBe("no_session");
  });

  it("adds another folder to the current session and avoids duplicates", async () => {
    const root = await tempDir();
    const frontend = path.join(root, "frontend");
    const backend = path.join(root, "backend");
    const sessionPath = path.join(root, ".cache", "current-session.yml");
    await mkdir(frontend);
    await mkdir(backend);
    const resolvedBackend = await realpath(backend);

    await initWorkspace({
      cwd: frontend,
      interactive: false,
      yes: true,
      folderId: "frontend",
      sessionPath,
      now: new Date("2026-05-17T10:00:00.000Z"),
    });

    const added = await addFolder({
      cwd: frontend,
      targetPath: "../backend",
      folderId: "backend",
      folderKind: "api",
      sessionPath,
      now: new Date("2026-05-17T10:01:00.000Z"),
    });
    const duplicate = await addFolder({
      cwd: frontend,
      targetPath: "../backend/",
      folderId: "backend-copy",
      sessionPath,
      now: new Date("2026-05-17T10:02:00.000Z"),
    });
    const session = await loadCurrentSession(sessionPath);

    expect(added.status).toBe("added");
    expect(duplicate.status).toBe("already_exists");
    expect(Object.keys(session?.folders ?? {})).toEqual(["frontend", "backend"]);
    expect(session?.folders.backend).toMatchObject({
      path: resolvedBackend,
      kind: "api",
    });
    await expect(stat(path.join(backend, "wiki", "knowledge", "index.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(backend, ".weave", "sync.yml"))).resolves.toMatchObject({});
  });

  it("prints current session as JSON for agents", async () => {
    const cwd = await tempDir();
    const resolvedCwd = await realpath(cwd);
    const sessionPath = path.join(cwd, ".cache", "current-session.yml");
    await initWorkspace({ cwd, interactive: false, yes: true, folderId: "frontend", sessionPath });

    const result = await showWorkspace({ json: true, sessionPath });
    const output = JSON.parse(result.message);

    expect(result.status).toBe("ok");
    expect(output.session.status).toBe("active");
    expect(output.folders).toEqual([
      {
        id: "frontend",
        path: resolvedCwd,
        kind: "app",
        wiki: path.join(resolvedCwd, "wiki"),
        metadata: path.join(resolvedCwd, ".weave"),
      },
    ]);
  });

  it("prints workspace sessions as JSON for agents", async () => {
    const root = await tempDir();
    const workspacePath = path.join(root, "platform");
    const sessionPath = path.join(root, ".cache", "current-session.yml");
    await initWorkspace({
      cwd: root,
      mode: "workspace",
      workspaceName: "platform",
      workspacePath,
      interactive: false,
      yes: true,
      sessionPath,
    });

    const result = await showWorkspace({ json: true, sessionPath });
    const output = JSON.parse(result.message);
    const resolvedWorkspacePath = await realpath(workspacePath);

    expect(output.folders).toEqual([
      {
        id: "platform",
        path: resolvedWorkspacePath,
        kind: "workspace",
        wiki: path.join(resolvedWorkspacePath, "wiki"),
        metadata: path.join(resolvedWorkspacePath, ".weave"),
      },
    ]);
  });
});
