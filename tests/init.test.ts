import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { addFolder } from "../src/lib/add-folder.js";
import { initWorkspace } from "../src/lib/init-workspace.js";
import { loadCurrentSession } from "../src/lib/session-state.js";
import { showWorkspace } from "../src/lib/show-workspace.js";

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-it-"));
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
    expect(result.wikiDir).toBe(path.join(resolvedCwd, "wiki"));
    expect(result.metadataDir).toBe(path.join(resolvedCwd, ".weave"));
    await expect(stat(path.join(cwd, "wiki", "changes"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, "wiki", "knowledge", "domains"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, "wiki", "knowledge", "shared"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".weave", "sync.yml"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, "weave"))).rejects.toThrow();
    await expect(stat(path.join(cwd, ".weave", "local.yml"))).rejects.toThrow();

    const sync = YAML.parse(await readFile(path.join(cwd, ".weave", "sync.yml"), "utf8"));
    const knowledge = await readFile(path.join(cwd, "wiki", "knowledge", "index.md"), "utf8");
    const knowledgeReadme = await readFile(path.join(cwd, "wiki", "knowledge", "README.md"), "utf8");
    const domainsReadme = await readFile(path.join(cwd, "wiki", "knowledge", "domains", "README.md"), "utf8");
    const sharedReadme = await readFile(path.join(cwd, "wiki", "knowledge", "shared", "README.md"), "utf8");
    const session = await loadCurrentSession(sessionPath);

    expect(sync.documents["knowledge.index"].path).toBe("wiki/knowledge/index.md");
    expect(sync.documents["knowledge.index"].status).toBe("synced");
    expect(Object.keys(sync.documents)).toEqual(["knowledge.index"]);
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
    await mkdir(path.join(wikiDir, "domains"), { recursive: true });
    await mkdir(path.join(wikiDir, "shared"), { recursive: true });
    await mkdir(metadataDir, { recursive: true });
    await writeFile(knowledgeFile, "existing wiki\n");
    await writeFile(knowledgeReadme, "existing knowledge readme\n");
    await writeFile(domainsReadme, "existing domains readme\n");
    await writeFile(sharedReadme, "existing shared readme\n");
    await writeFile(syncFile, "existing: true\n");

    const result = await initWorkspace({ cwd, interactive: false, yes: true, sessionPath });

    expect(result.status).toBe("initialized");
    await expect(readFile(knowledgeFile, "utf8")).resolves.toBe("existing wiki\n");
    await expect(readFile(knowledgeReadme, "utf8")).resolves.toBe("existing knowledge readme\n");
    await expect(readFile(domainsReadme, "utf8")).resolves.toBe("existing domains readme\n");
    await expect(readFile(sharedReadme, "utf8")).resolves.toBe("existing shared readme\n");
    await expect(readFile(syncFile, "utf8")).resolves.toBe("existing: true\n");
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
});
