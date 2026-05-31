import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { describe, expect, it, vi } from "vitest";
import { setCurrentArtifact, clearCurrentArtifact } from "../src/lib/artifact-context.js";
import { createChange } from "../src/lib/changes.js";
import { isFileBackedLane, isLaneName, laneNames } from "../src/lib/lane.js";
import { loadCurrentSession } from "../src/lib/session-state.js";

const execFileAsync = promisify(execFile);

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-it-lane-"));
}

async function initGit(cwd: string): Promise<void> {
  await execFileAsync("git", ["init"], { cwd });
  await execFileAsync("git", ["config", "user.email", "weave@example.com"], { cwd });
  await execFileAsync("git", ["config", "user.name", "Weave Test"], { cwd });
  await writeFile(path.join(cwd, "README.md"), "ok");
  await execFileAsync("git", ["add", "."], { cwd });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd });
}

function sessionPath(cwd: string): string {
  return path.join(cwd, ".session.yml");
}

const testNow = new Date(2026, 4, 22, 10, 0, 0);

async function newChange(cwd: string): Promise<{ changeRelativePath: string; statusPath: string }> {
  await initGit(cwd);
  const result = await createChange({
    cwd,
    title: "Test Lane Compat",
    type: "feat",
    now: testNow,
    randomId: () => "lcom",
    sessionPath: sessionPath(cwd),
  });
  const changeRelativePath = path.join("wiki", "changes", result.id);
  return {
    changeRelativePath,
    statusPath: path.join(cwd, changeRelativePath, "status.yml"),
  };
}

describe("lane name superset", () => {
  it("isLaneName accepts all five lane names", () => {
    expect(laneNames).toEqual(["exploration", "prd", "architecture", "implementation", "review"]);
    for (const name of laneNames) {
      expect(isLaneName(name)).toBe(true);
    }
  });

  it("isLaneName rejects unknown values", () => {
    expect(isLaneName("ship")).toBe(false);
    expect(isLaneName(undefined)).toBe(false);
    expect(isLaneName("")).toBe(false);
  });

  it("isFileBackedLane is true only for file-backed lanes", () => {
    expect(isFileBackedLane("exploration")).toBe(true);
    expect(isFileBackedLane("prd")).toBe(true);
    expect(isFileBackedLane("architecture")).toBe(true);
    expect(isFileBackedLane("implementation")).toBe(false);
    expect(isFileBackedLane("review")).toBe(false);
  });
});

describe("setCurrentArtifact widening", () => {
  it("file-backed lanes use the artifact filename for current_artifact.path", async () => {
    const cwd = await tempDir();
    const { changeRelativePath } = await newChange(cwd);

    const result = await setCurrentArtifact({ cwd, artifact: "prd", sessionPath: sessionPath(cwd) });

    expect(result.targets[0].artifact?.artifact).toBe("prd");
    expect(result.targets[0].artifact?.path).toBe(path.join(changeRelativePath, "prd.md"));
  });

  it("implementation lane uses the change folder root for current_artifact.path", async () => {
    const cwd = await tempDir();
    const { changeRelativePath } = await newChange(cwd);

    const result = await setCurrentArtifact({ cwd, artifact: "implementation", sessionPath: sessionPath(cwd) });

    expect(result.targets[0].artifact?.artifact).toBe("implementation");
    expect(result.targets[0].artifact?.path).toBe(changeRelativePath);
  });

  it("review lane uses the change folder root for current_artifact.path", async () => {
    const cwd = await tempDir();
    const { changeRelativePath } = await newChange(cwd);

    const result = await setCurrentArtifact({ cwd, artifact: "review", sessionPath: sessionPath(cwd) });

    expect(result.targets[0].artifact?.artifact).toBe("review");
    expect(result.targets[0].artifact?.path).toBe(changeRelativePath);
  });

  it("rejects an invalid lane with a clear error naming the accepted set", async () => {
    const cwd = await tempDir();
    await newChange(cwd);

    await expect(setCurrentArtifact({ cwd, artifact: "ship", sessionPath: sessionPath(cwd) })).rejects.toThrow(
      /exploration, prd, architecture, implementation, or review/,
    );
  });
});

describe("status.yml#stage mirror", () => {
  it("mirrors the lane to status.yml#stage on set", async () => {
    const cwd = await tempDir();
    const { statusPath } = await newChange(cwd);

    await setCurrentArtifact({ cwd, artifact: "implementation", sessionPath: sessionPath(cwd) });

    const status = YAML.parse(await readFile(statusPath, "utf8"));
    expect(status.stage).toBe("implementation");
  });

  it("mirror is skipped silently when status.yml does not exist", async () => {
    const cwd = await tempDir();
    const { statusPath } = await newChange(cwd);
    const { rm } = await import("node:fs/promises");
    await rm(statusPath);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      await expect(setCurrentArtifact({ cwd, artifact: "review", sessionPath: sessionPath(cwd) })).resolves.toBeDefined();
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("clearCurrentArtifact does not mutate status.yml#stage", async () => {
    const cwd = await tempDir();
    const { statusPath } = await newChange(cwd);

    await setCurrentArtifact({ cwd, artifact: "architecture", sessionPath: sessionPath(cwd) });
    const before = YAML.parse(await readFile(statusPath, "utf8")).stage;
    expect(before).toBe("architecture");

    await clearCurrentArtifact({ cwd, sessionPath: sessionPath(cwd) });

    const after = YAML.parse(await readFile(statusPath, "utf8")).stage;
    expect(after).toBe("architecture");
  });
});

describe("session-state backwards compatibility", () => {
  it("loadCurrentSession parses an older session file with artifact: exploration without erroring", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    await writeFile(
      session,
      YAML.stringify({
        version: 1,
        updated_at: "2026-01-01T00:00:00.000Z",
        folders: {
          legacy: {
            current_artifact: {
              artifact: "exploration",
              change_id: "260101-abcd-test",
              path: "wiki/changes/260101-abcd-test/exploration.md",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          },
        },
      }),
    );

    const loaded = await loadCurrentSession(session);

    expect(loaded?.folders.legacy?.current_artifact?.artifact).toBe("exploration");
  });
});
