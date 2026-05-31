import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { currentBranch, findGitRoot, getGitRemote, git, gitRequired } from "../src/lib/git.js";

const execFileAsync = promisify(execFile);

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-it-git-"));
}

async function initRepo(cwd: string): Promise<void> {
  await execFileAsync("git", ["init", "-b", "main"], { cwd });
  await execFileAsync("git", ["config", "user.email", "weave@example.com"], { cwd });
  await execFileAsync("git", ["config", "user.name", "Weave Test"], { cwd });
}

describe("git", () => {
  it("git() returns trimmed stdout for a successful command", async () => {
    const cwd = await tempDir();
    await initRepo(cwd);

    const root = await git(["rev-parse", "--show-toplevel"], cwd);

    expect(root).toBeDefined();
    expect(root).not.toMatch(/\n$/);
  });

  it("git() returns undefined on failure", async () => {
    const cwd = await tempDir();

    const result = await git(["rev-parse", "--show-toplevel"], cwd);

    expect(result).toBeUndefined();
  });

  it("git() returns undefined when stdout is empty", async () => {
    const cwd = await tempDir();
    await initRepo(cwd);

    const result = await git(["config", "--get", "nonexistent.key"], cwd);

    expect(result).toBeUndefined();
  });

  it("gitRequired() returns trimmed stdout", async () => {
    const cwd = await tempDir();
    await initRepo(cwd);

    const result = await gitRequired(["rev-parse", "--show-toplevel"], cwd);

    expect(result).not.toMatch(/\n$/);
    expect(result.length).toBeGreaterThan(0);
  });

  it("gitRequired() throws on non-zero exit", async () => {
    const cwd = await tempDir();

    await expect(gitRequired(["rev-parse", "--show-toplevel"], cwd)).rejects.toThrow();
  });

  it("findGitRoot() returns the repo toplevel", async () => {
    const cwd = await tempDir();
    await initRepo(cwd);

    const root = await findGitRoot(cwd);

    expect(root).toBeDefined();
  });

  it("findGitRoot() returns undefined outside a git repo", async () => {
    const cwd = await tempDir();

    const root = await findGitRoot(cwd);

    expect(root).toBeUndefined();
  });

  it("getGitRemote() returns the configured origin url", async () => {
    const cwd = await tempDir();
    await initRepo(cwd);
    await execFileAsync("git", ["remote", "add", "origin", "https://example.com/test.git"], { cwd });

    const remote = await getGitRemote(cwd);

    expect(remote).toBe("https://example.com/test.git");
  });

  it("getGitRemote() returns undefined when no origin is configured", async () => {
    const cwd = await tempDir();
    await initRepo(cwd);

    const remote = await getGitRemote(cwd);

    expect(remote).toBeUndefined();
  });

  it("currentBranch() returns the active branch name", async () => {
    const cwd = await tempDir();
    await initRepo(cwd);
    await writeFile(path.join(cwd, "file.txt"), "hi");
    await execFileAsync("git", ["add", "."], { cwd });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd });

    const branch = await currentBranch(cwd);

    expect(branch).toBe("main");
  });

  it("currentBranch() returns undefined outside a git repo", async () => {
    const cwd = await tempDir();

    const branch = await currentBranch(cwd);

    expect(branch).toBeUndefined();
  });
});
