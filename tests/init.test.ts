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
    await expect(stat(path.join(cwd, ".weave", "architecture-considerations.md"))).resolves.toMatchObject({});
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
    const architectureConsiderations = await readFile(path.join(cwd, ".weave", "architecture-considerations.md"), "utf8");
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
    expect(architectureConsiderations).toContain("# Architecture Considerations");
    expect(architectureConsiderations).toContain("This file is user-owned. Weave creates it once and never overwrites it.");
    expect(architectureConsiderations).toContain("## Patterns To Avoid");
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
    const architectureConsiderations = path.join(metadataDir, "architecture-considerations.md");
    const workspaceFile = path.join(metadataDir, "workspace.yml");
    await mkdir(path.join(wikiDir, "domains"), { recursive: true });
    await mkdir(path.join(wikiDir, "shared"), { recursive: true });
    await mkdir(metadataDir, { recursive: true });
    await writeFile(knowledgeFile, "existing wiki\n");
    await writeFile(knowledgeReadme, "existing knowledge readme\n");
    await writeFile(domainsReadme, "existing domains readme\n");
    await writeFile(sharedReadme, "existing shared readme\n");
    await writeFile(syncFile, "existing: true\n");
    await writeFile(architectureConsiderations, "existing architecture notes\n");
    await writeFile(workspaceFile, "existing: true\n");

    const result = await initWorkspace({ cwd, interactive: false, yes: true, sessionPath });

    expect(result.status).toBe("initialized");
    await expect(readFile(knowledgeFile, "utf8")).resolves.toBe("existing wiki\n");
    await expect(readFile(knowledgeReadme, "utf8")).resolves.toBe("existing knowledge readme\n");
    await expect(readFile(domainsReadme, "utf8")).resolves.toBe("existing domains readme\n");
    await expect(readFile(sharedReadme, "utf8")).resolves.toBe("existing shared readme\n");
    await expect(readFile(syncFile, "utf8")).resolves.toBe("existing: true\n");
    await expect(readFile(architectureConsiderations, "utf8")).resolves.toBe("existing architecture notes\n");
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
    await expect(stat(path.join(workspacePath, ".weave", "architecture-considerations.md"))).resolves.toMatchObject({});
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
    await expect(stat(path.join(backend, ".weave", "architecture-considerations.md"))).resolves.toMatchObject({});
  });

  it("prints current session as JSON for agents in repo mode", async () => {
    const cwd = await tempDir();
    const resolvedCwd = await realpath(cwd);
    const sessionPath = path.join(cwd, ".cache", "current-session.yml");
    await initWorkspace({ cwd, interactive: false, yes: true, folderId: "frontend", sessionPath });

    const outsidePath = await tempDir();
    const result = await showWorkspace({ cwd: outsidePath, json: true, sessionPath });
    const output = JSON.parse(result.message);

    expect(result.status).toBe("ok");
    expect(output.session.status).toBe("active");
    expect(output.workspace).toBeNull();
    expect(output.repos).toEqual([]);
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

  it("prints workspace view as JSON when cwd is inside a workspace", async () => {
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

    const result = await showWorkspace({ cwd: workspacePath, json: true, sessionPath });
    const output = JSON.parse(result.message);
    const resolvedWorkspacePath = await realpath(workspacePath);

    expect(result.status).toBe("ok");
    expect(output.workspace).toEqual({
      name: "platform",
      path: resolvedWorkspacePath,
      mode: "workspace",
    });
    expect(output.repos).toEqual([]);
    expect(output.folders).toEqual([]);
    expect(output.session.status).toBe("active");
  });

  it("prints workspace view from a subdirectory of the workspace", async () => {
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

    const nested = path.join(workspacePath, "wiki", "changes");
    await mkdir(nested, { recursive: true });
    const result = await showWorkspace({ cwd: nested, json: true, sessionPath });
    const output = JSON.parse(result.message);
    const resolvedWorkspacePath = await realpath(workspacePath);

    expect(output.workspace?.path).toBe(resolvedWorkspacePath);
    expect(output.repos).toEqual([]);
  });

  it("prints workspace view in workspace mode without an active session", async () => {
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

    const isolatedSessionPath = path.join(root, ".cache", "no-session.yml");
    const result = await showWorkspace({ cwd: workspacePath, json: true, sessionPath: isolatedSessionPath });
    const output = JSON.parse(result.message);
    const resolvedWorkspacePath = await realpath(workspacePath);

    expect(result.status).toBe("ok");
    expect(output.session).toBeNull();
    expect(output.workspace).toEqual({
      name: "platform",
      path: resolvedWorkspacePath,
      mode: "workspace",
    });
    expect(output.repos).toEqual([]);
  });

  it("returns no_session in repo mode when no session exists", async () => {
    const outsidePath = await tempDir();
    const isolatedSessionPath = path.join(outsidePath, ".cache", "no-session.yml");

    const result = await showWorkspace({ cwd: outsidePath, json: true, sessionPath: isolatedSessionPath });
    const output = JSON.parse(result.message);

    expect(result.status).toBe("no_session");
    expect(output.session).toBeNull();
    expect(output.workspace).toBeNull();
    expect(output.folders).toEqual([]);
  });

  it("shows adopted repo in weave workspace after init", async () => {
    const root = await tempDir();
    const repo = path.join(root, "app-repo");
    const workspacePath = path.join(root, "peoplebox-platform");
    const sessionPath = path.join(root, ".cache", "current-session.yml");
    await mkdir(repo, { recursive: true });
    await git(repo, ["init"]);
    await git(repo, ["remote", "add", "origin", "git@example.com:peoplebox/app-repo.git"]);

    await initWorkspace({
      cwd: repo,
      mode: "workspace",
      workspaceName: "peoplebox-platform",
      interactive: false,
      yes: true,
      sessionPath,
    });

    const result = await showWorkspace({ cwd: workspacePath, json: true, sessionPath });
    const output = JSON.parse(result.message);
    const resolvedWorkspacePath = await realpath(workspacePath);

    expect(output.workspace).toEqual({
      name: "peoplebox-platform",
      path: resolvedWorkspacePath,
      mode: "workspace",
    });
    expect(output.repos).toEqual([
      {
        id: "app-repo",
        path: "app-repo",
        kind: "app",
        availability: "present",
        remote: "git@example.com:peoplebox/app-repo.git",
      },
    ]);
    expect(result.text).toContain("Repos:");
    expect(result.text).toContain("app-repo");
    expect(result.text).toContain("present");
  });

  it("shows missing registered workspace repos without throwing", async () => {
    const root = await tempDir();
    const workspacePath = path.join(root, "platform");
    const presentRepo = path.join(workspacePath, "present-app");
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
    await mkdir(presentRepo, { recursive: true });
    await writeFile(
      path.join(workspacePath, ".weave", "workspace.yml"),
      YAML.stringify({
        version: 1,
        mode: "workspace",
        name: "platform",
        repos: {
          "present-app": {
            path: "present-app",
            kind: "app",
          },
          "missing-api": {
            path: "missing-api",
            kind: "api",
            remote: "git@example.com:peoplebox/missing-api.git",
          },
        },
      }),
    );

    const result = await showWorkspace({ cwd: workspacePath, json: true, sessionPath });
    const output = JSON.parse(result.message);

    expect(output.repos).toEqual([
      {
        id: "present-app",
        path: "present-app",
        kind: "app",
        availability: "present",
      },
      {
        id: "missing-api",
        path: "missing-api",
        kind: "api",
        availability: "missing",
        remote: "git@example.com:peoplebox/missing-api.git",
      },
    ]);
    expect(result.text).toContain("present-app");
    expect(result.text).toContain("present");
    expect(result.text).toContain("missing-api");
    expect(result.text).toContain("missing");
  });

  it("registers an in-workspace path via weave add in workspace mode", async () => {
    const root = await tempDir();
    const workspacePath = path.join(root, "platform");
    const billing = path.join(workspacePath, "billing");
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

    await mkdir(billing, { recursive: true });
    await git(billing, ["init"]);
    await git(billing, ["remote", "add", "origin", "git@example.com:peoplebox/billing.git"]);

    const added = await addFolder({
      cwd: workspacePath,
      targetPath: "./billing",
      folderKind: "app",
      sessionPath,
    });

    const workspace = YAML.parse(await readFile(path.join(workspacePath, ".weave", "workspace.yml"), "utf8"));
    const gitignore = await readFile(path.join(workspacePath, ".gitignore"), "utf8");
    const session = await loadCurrentSession(sessionPath);

    expect(added.status).toBe("added");
    expect(workspace.repos.billing).toMatchObject({
      path: "billing",
      kind: "app",
      remote: "git@example.com:peoplebox/billing.git",
    });
    expect(gitignore).toContain("/billing/");
    expect(Object.keys(session?.folders ?? {})).toEqual(["platform"]);
  });

  it("registers a non-git in-workspace folder without remote", async () => {
    const root = await tempDir();
    const workspacePath = path.join(root, "platform");
    const notes = path.join(workspacePath, "shared-notes");
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

    await mkdir(notes);

    const added = await addFolder({ cwd: workspacePath, targetPath: "./shared-notes", sessionPath });
    const workspace = YAML.parse(await readFile(path.join(workspacePath, ".weave", "workspace.yml"), "utf8"));

    expect(added.status).toBe("added");
    expect(workspace.repos["shared-notes"]).toMatchObject({
      path: "shared-notes",
      kind: "app",
    });
    expect(workspace.repos["shared-notes"].remote).toBeUndefined();
  });

  it("adopts an outside folder into the workspace via weave add", async () => {
    const root = await tempDir();
    const workspacePath = path.join(root, "platform");
    const external = path.join(root, "external-tooling");
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

    await mkdir(external, { recursive: true });
    await git(external, ["init"]);
    await writeFile(path.join(external, "marker.txt"), "keep\n");

    const added = await addFolder({ cwd: workspacePath, targetPath: "../external-tooling", sessionPath });
    const workspace = YAML.parse(await readFile(path.join(workspacePath, ".weave", "workspace.yml"), "utf8"));
    const movedPath = path.join(workspacePath, "external-tooling");

    expect(added.status).toBe("added");
    await expect(stat(external)).rejects.toThrow();
    await expect(readFile(path.join(movedPath, "marker.txt"), "utf8")).resolves.toBe("keep\n");
    expect(workspace.repos["external-tooling"]).toMatchObject({
      path: "external-tooling",
      kind: "app",
    });
  });

  it("clones and registers a repo by git URL via weave add", async () => {
    const root = await tempDir();
    const workspacePath = path.join(root, "platform");
    const source = path.join(root, "source-repo");
    const bare = path.join(root, "billing.git");
    const sessionPath = path.join(root, ".cache", "current-session.yml");

    await mkdir(source, { recursive: true });
    await git(source, ["init"]);
    await writeFile(path.join(source, "README.md"), "# billing\n");
    await git(source, ["add", "README.md"]);
    await git(source, ["commit", "-m", "init"]);
    await git(source, ["clone", "--bare", source, bare]);

    await initWorkspace({
      cwd: root,
      mode: "workspace",
      workspaceName: "platform",
      workspacePath,
      interactive: false,
      yes: true,
      sessionPath,
    });

    const bareUrl = (await realpath(bare)).replace(/\\/g, "/");
    const fileUrl = `file://${bareUrl}`;

    const added = await addFolder({
      cwd: workspacePath,
      targetPath: fileUrl,
      sessionPath,
    });

    const workspace = YAML.parse(await readFile(path.join(workspacePath, ".weave", "workspace.yml"), "utf8"));
    const gitignore = await readFile(path.join(workspacePath, ".gitignore"), "utf8");

    expect(added.status).toBe("added");
    await expect(stat(path.join(workspacePath, "billing"))).resolves.toMatchObject({});
    expect(workspace.repos.billing).toMatchObject({
      path: "billing",
      kind: "app",
      remote: fileUrl,
    });
    expect(gitignore).toContain("/billing/");
  });

  it("treats duplicate workspace add as already registered", async () => {
    const root = await tempDir();
    const workspacePath = path.join(root, "platform");
    const billing = path.join(workspacePath, "billing");
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
    await mkdir(billing);

    const first = await addFolder({ cwd: workspacePath, targetPath: "./billing", sessionPath });
    const second = await addFolder({
      cwd: workspacePath,
      targetPath: "./billing",
      folderId: "billing-copy",
      sessionPath,
    });

    expect(first.status).toBe("added");
    expect(second.status).toBe("already_exists");
  });

  it("refuses git URL weave add when destination already exists", async () => {
    const root = await tempDir();
    const workspacePath = path.join(root, "platform");
    const source = path.join(root, "source-repo");
    const bare = path.join(root, "billing.git");
    const billingDir = path.join(workspacePath, "billing");
    const sessionPath = path.join(root, ".cache", "current-session.yml");

    await mkdir(source, { recursive: true });
    await git(source, ["init"]);
    await writeFile(path.join(source, "README.md"), "# billing\n");
    await git(source, ["add", "README.md"]);
    await git(source, ["commit", "-m", "init"]);
    await git(source, ["clone", "--bare", source, bare]);

    await initWorkspace({
      cwd: root,
      mode: "workspace",
      workspaceName: "platform",
      workspacePath,
      interactive: false,
      yes: true,
      sessionPath,
    });
    await mkdir(billingDir);

    const bareUrl = (await realpath(bare)).replace(/\\/g, "/");
    const fileUrl = `file://${bareUrl}`;

    await expect(addFolder({ cwd: workspacePath, targetPath: fileUrl, sessionPath })).rejects.toThrow(
      /Destination already exists/,
    );
  });

  it("degrades gracefully to repo mode when workspace.yml is malformed", async () => {
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

    await writeFile(path.join(workspacePath, ".weave", "workspace.yml"), ":\n");

    const result = await showWorkspace({ cwd: workspacePath, json: true, sessionPath });
    const output = JSON.parse(result.message);

    expect(result.status).toBe("ok");
    expect(output.workspace).toBeNull();
    expect(output.repos).toEqual([]);
    expect(result.text).toContain("Folders:");
  });
});
