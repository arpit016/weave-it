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
  it("initializes repo weave scaffold and starts a current session", async () => {
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
    await expect(stat(path.join(cwd, "weave", "features"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, "weave", "workspace.yaml"))).rejects.toThrow();

    const local = YAML.parse(await readFile(path.join(cwd, "weave", "local.yml"), "utf8"));
    const sync = YAML.parse(await readFile(path.join(cwd, "weave", "sync.yml"), "utf8"));
    const knowledge = await readFile(path.join(cwd, "weave", "knowledge", "index.md"), "utf8");
    const session = await loadCurrentSession(sessionPath);

    expect(local).toMatchObject({
      version: 1,
      folder: {
        id: "frontend",
        name: "Frontend",
        kind: "app",
      },
      created_at: "2026-05-17T10:00:00.000Z",
    });
    expect(sync.documents["knowledge.index"].path).toBe("weave/knowledge/index.md");
    expect(sync.documents["knowledge.index"].status).toBe("synced");
    expect(knowledge).toContain("# Product Knowledge");
    expect(session?.folders.frontend).toMatchObject({
      path: resolvedCwd,
      name: "Frontend",
      kind: "app",
    });
  });

  it("does not overwrite existing weave files when init runs again", async () => {
    const cwd = await tempDir();
    const sessionPath = path.join(cwd, ".cache", "current-session.yml");
    const weaveDir = path.join(cwd, "weave");
    const localFile = path.join(weaveDir, "local.yml");
    await mkdir(weaveDir, { recursive: true });
    await writeFile(localFile, "existing: true\n");

    const result = await initWorkspace({ cwd, interactive: false, yes: true, sessionPath });

    expect(result.status).toBe("initialized");
    await expect(readFile(localFile, "utf8")).resolves.toBe("existing: true\n");
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
    await expect(stat(path.join(backend, "weave", "knowledge", "index.md"))).resolves.toMatchObject({});
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
        weave: path.join(resolvedCwd, "weave"),
      },
    ]);
  });
});
