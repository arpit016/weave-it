import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { createFeature, propagateFeature } from "../src/lib/features.js";

const execFileAsync = promisify(execFile);
const testNow = new Date(2026, 4, 22, 10, 0, 0);

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-it-features-"));
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function initGit(cwd: string): Promise<void> {
  await git(cwd, ["init"]);
}

describe("features", () => {
  it("requires a non-empty feature title", async () => {
    const cwd = await tempDir();

    await expect(createFeature({ cwd, title: "   " })).rejects.toThrow("Feature title is required");
  });

  it("creates a feature exploration and skips branch creation outside git", async () => {
    const cwd = await tempDir();

    const result = await createFeature({
      cwd,
      title: "Analytics of reviews",
      now: testNow,
      randomId: () => "f3q9",
    });
    const featurePath = path.join(cwd, "wiki", "features", "260522-f3q9-analytics-of-reviews");
    const status = YAML.parse(await readFile(path.join(featurePath, "status.yml"), "utf8"));
    const exploration = await readFile(path.join(featurePath, "exploration.md"), "utf8");

    expect(result.id).toBe("260522-f3q9-analytics-of-reviews");
    expect(result.branch).toBe("feature/260522-f3q9-analytics-of-reviews");
    expect(result.targets).toContainEqual(expect.objectContaining({ branchStatus: "skipped_not_git" }));
    expect(status).toMatchObject({
      id: "260522-f3q9-analytics-of-reviews",
      slug: "analytics-of-reviews",
      title: "Analytics of reviews",
      stage: "exploration",
      branch: "feature/260522-f3q9-analytics-of-reviews",
    });
    expect(exploration).toContain("# Analytics Of Reviews");
    expect(exploration).toContain("## PRD Readiness");
  });

  it("creates and checks out the feature branch in git repos", async () => {
    const cwd = await tempDir();
    await initGit(cwd);

    const result = await createFeature({
      cwd,
      title: "Feature workflow scaffold",
      now: testNow,
      randomId: () => "a7k2",
    });

    expect(result.targets).toContainEqual(expect.objectContaining({ branchStatus: "created" }));
    await expect(git(cwd, ["branch", "--show-current"])).resolves.toBe("feature/260522-a7k2-feature-workflow-scaffold");
  });

  it("creates the same feature id across selected targets", async () => {
    const root = await tempDir();
    const app = path.join(root, "app");
    const api = path.join(root, "api");
    await mkdir(app);
    await mkdir(api);

    const result = await createFeature({
      cwd: app,
      title: "Review analytics",
      targets: [app, api],
      now: testNow,
      randomId: () => "b8ff",
    });

    expect(result.targets).toHaveLength(2);
    await expect(stat(path.join(app, "wiki", "features", result.id, "exploration.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(api, "wiki", "features", result.id, "exploration.md"))).resolves.toMatchObject({});
  });

  it("retries generated ids instead of overwriting an existing feature folder", async () => {
    const cwd = await tempDir();
    const existing = path.join(cwd, "wiki", "features", "260522-f3q9-analytics-of-reviews");
    await mkdir(existing, { recursive: true });
    const ids = ["f3q9", "z9zz"];

    const result = await createFeature({
      cwd,
      title: "Analytics of reviews",
      now: testNow,
      randomId: () => ids.shift() ?? "z9zz",
    });

    expect(result.id).toBe("260522-z9zz-analytics-of-reviews");
    await expect(stat(path.join(cwd, "wiki", "features", result.id))).resolves.toMatchObject({});
  });

  it("propagates existing feature artifacts to another folder", async () => {
    const root = await tempDir();
    const source = path.join(root, "source");
    const target = path.join(root, "target");
    await mkdir(source);
    await mkdir(target);

    const created = await createFeature({
      cwd: source,
      title: "Feature workflow scaffold",
      now: testNow,
      randomId: () => "f3q9",
    });
    const propagated = await propagateFeature({
      cwd: source,
      featureId: created.id,
      from: source,
      to: [target],
    });

    expect(propagated.id).toBe(created.id);
    await expect(readFile(path.join(target, "wiki", "features", created.id, "exploration.md"), "utf8")).resolves.toContain(
      "# Feature Workflow Scaffold",
    );
    await expect(
      propagateFeature({
        cwd: source,
        featureId: created.id,
        from: source,
        to: [target],
      }),
    ).rejects.toThrow("Feature already exists");
  });
});
