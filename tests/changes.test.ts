import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { createChange, propagateChange } from "../src/lib/changes.js";

const execFileAsync = promisify(execFile);
const testNow = new Date(2026, 4, 22, 10, 0, 0);

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-it-changes-"));
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function initGit(cwd: string): Promise<void> {
  await git(cwd, ["init"]);
}

describe("changes", () => {
  it("requires a non-empty change title", async () => {
    const cwd = await tempDir();

    await expect(createChange({ cwd, title: "   " })).rejects.toThrow("Change title is required");
  });

  it("creates a change exploration and skips branch creation outside git", async () => {
    const cwd = await tempDir();

    const result = await createChange({
      cwd,
      title: "Analytics of reviews",
      type: "fix",
      now: testNow,
      randomId: () => "f3q9",
    });
    const changePath = path.join(cwd, "wiki", "changes", "260522-f3q9-analytics-of-reviews");
    const status = YAML.parse(await readFile(path.join(changePath, "status.yml"), "utf8"));
    const exploration = await readFile(path.join(changePath, "exploration.md"), "utf8");

    expect(result.id).toBe("260522-f3q9-analytics-of-reviews");
    expect(result.type).toBe("fix");
    expect(result.branch).toBe("change/260522-f3q9-analytics-of-reviews");
    expect(result.targets).toContainEqual(expect.objectContaining({ branchStatus: "skipped_not_git" }));
    expect(status).toMatchObject({
      id: "260522-f3q9-analytics-of-reviews",
      slug: "analytics-of-reviews",
      title: "Analytics of reviews",
      type: "fix",
      stage: "exploration",
      branch: "change/260522-f3q9-analytics-of-reviews",
    });
    expect(exploration).toContain("# Analytics Of Reviews");
    expect(exploration).toContain("## PRD Readiness");
  });

  it("defaults change type to feat", async () => {
    const cwd = await tempDir();

    const result = await createChange({
      cwd,
      title: "Analytics of reviews",
      now: testNow,
      randomId: () => "k9x2",
    });

    const status = YAML.parse(await readFile(path.join(cwd, "wiki", "changes", result.id, "status.yml"), "utf8"));
    expect(result.type).toBe("feat");
    expect(status.type).toBe("feat");
  });

  it("creates and checks out the change branch in git repos", async () => {
    const cwd = await tempDir();
    await initGit(cwd);

    const result = await createChange({
      cwd,
      title: "Change workflow scaffold",
      now: testNow,
      randomId: () => "a7k2",
    });

    expect(result.targets).toContainEqual(expect.objectContaining({ branchStatus: "created" }));
    await expect(git(cwd, ["branch", "--show-current"])).resolves.toBe("change/260522-a7k2-change-workflow-scaffold");
  });

  it("creates the same change id across selected targets", async () => {
    const root = await tempDir();
    const app = path.join(root, "app");
    const api = path.join(root, "api");
    await mkdir(app);
    await mkdir(api);

    const result = await createChange({
      cwd: app,
      title: "Review analytics",
      targets: [app, api],
      now: testNow,
      randomId: () => "b8ff",
    });

    expect(result.targets).toHaveLength(2);
    await expect(stat(path.join(app, "wiki", "changes", result.id, "exploration.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(api, "wiki", "changes", result.id, "exploration.md"))).resolves.toMatchObject({});
  });

  it("retries generated ids instead of overwriting an existing change folder", async () => {
    const cwd = await tempDir();
    const existing = path.join(cwd, "wiki", "changes", "260522-f3q9-analytics-of-reviews");
    await mkdir(existing, { recursive: true });
    const ids = ["f3q9", "z9zz"];

    const result = await createChange({
      cwd,
      title: "Analytics of reviews",
      now: testNow,
      randomId: () => ids.shift() ?? "z9zz",
    });

    expect(result.id).toBe("260522-z9zz-analytics-of-reviews");
    await expect(stat(path.join(cwd, "wiki", "changes", result.id))).resolves.toMatchObject({});
  });

  it("propagates existing change artifacts to another folder", async () => {
    const root = await tempDir();
    const source = path.join(root, "source");
    const target = path.join(root, "target");
    await mkdir(source);
    await mkdir(target);

    const created = await createChange({
      cwd: source,
      title: "Change workflow scaffold",
      now: testNow,
      randomId: () => "f3q9",
    });
    const propagated = await propagateChange({
      cwd: source,
      changeId: created.id,
      from: source,
      to: [target],
    });

    expect(propagated.id).toBe(created.id);
    await expect(readFile(path.join(target, "wiki", "changes", created.id, "exploration.md"), "utf8")).resolves.toContain(
      "# Change Workflow Scaffold",
    );
    await expect(
      propagateChange({
        cwd: source,
        changeId: created.id,
        from: source,
        to: [target],
      }),
    ).rejects.toThrow("Change already exists");
  });
});
