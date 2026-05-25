import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { createChange, currentChange, listChanges, propagateChange, statusChange, switchChange } from "../src/lib/changes.js";

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

async function commitAll(cwd: string, message: string): Promise<void> {
  await git(cwd, ["add", "."]);
  await git(cwd, ["-c", "user.name=Weave Test", "-c", "user.email=weave@example.com", "commit", "-m", message]);
}

function sessionPath(cwd: string): string {
  return path.join(cwd, ".session.yml");
}

describe("changes", () => {
  it("requires a non-empty change title", async () => {
    const cwd = await tempDir();

    await expect(createChange({ cwd, title: "   ", sessionPath: sessionPath(cwd) })).rejects.toThrow("Change title is required");
  });

  it("creates a change exploration and skips branch creation outside git", async () => {
    const cwd = await tempDir();

    const result = await createChange({
      cwd,
      title: "Analytics of reviews",
      type: "fix",
      now: testNow,
      randomId: () => "f3q9",
      sessionPath: sessionPath(cwd),
    });
    const changePath = path.join(cwd, "wiki", "changes", "260522-f3q9-analytics-of-reviews");
    const status = YAML.parse(await readFile(path.join(changePath, "status.yml"), "utf8"));
    const exploration = await readFile(path.join(changePath, "exploration.md"), "utf8");

    expect(result.id).toBe("260522-f3q9-analytics-of-reviews");
    expect(result.type).toBe("fix");
    expect(result.branch).toBe("change/260522-f3q9-analytics-of-reviews");
    expect(result.targets).toContainEqual(expect.objectContaining({ branchStatus: "skipped_not_git" }));
    expect(result.targets).toContainEqual(expect.objectContaining({ current: true }));
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
      sessionPath: sessionPath(cwd),
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
      sessionPath: sessionPath(cwd),
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
      sessionPath: sessionPath(root),
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
      sessionPath: sessionPath(cwd),
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
      sessionPath: sessionPath(root),
    });
    const propagated = await propagateChange({
      cwd: source,
      changeId: created.id,
      from: source,
      to: [target],
      sessionPath: sessionPath(root),
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
        sessionPath: sessionPath(root),
      }),
    ).rejects.toThrow("Change already exists");
  });

  it("records created changes as current in the local session", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);

    const result = await createChange({
      cwd,
      title: "Active change commands",
      now: testNow,
      randomId: () => "w3ye",
      sessionPath: session,
    });
    const parsed = YAML.parse(await readFile(session, "utf8"));

    expect(Object.values(parsed.folders)[0]).toMatchObject({
      current_change: {
      id: result.id,
      path: path.join("wiki", "changes", result.id),
      branch: result.branch,
      },
    });
    expect(result.message).toContain("current");
  });

  it("lists changes with the active marker", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const created = await createChange({
      cwd,
      title: "Active change commands",
      now: testNow,
      randomId: () => "w3ye",
      sessionPath: session,
    });

    const result = await listChanges({ cwd, sessionPath: session });

    expect(result.targets[0].changes).toContainEqual(expect.objectContaining({ id: created.id, active: true }));
    expect(result.message).toContain(`* ${created.id}`);
  });

  it("shows current changes from session state", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const created = await createChange({
      cwd,
      title: "Active change commands",
      now: testNow,
      randomId: () => "w3ye",
      sessionPath: session,
    });

    const result = await currentChange({ cwd, sessionPath: session });

    expect(result.targets[0]).toMatchObject({
      source: "session",
      current: expect.objectContaining({ id: created.id }),
    });
  });

  it("self-heals current changes from matching branches", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    await initGit(cwd);
    const created = await createChange({
      cwd,
      title: "Active change commands",
      now: testNow,
      randomId: () => "w3ye",
      sessionPath: session,
    });
    await writeFile(session, YAML.stringify({ version: 1, updated_at: testNow.toISOString(), folders: {} }));

    const result = await currentChange({ cwd, sessionPath: session, now: testNow });
    const parsed = YAML.parse(await readFile(session, "utf8"));

    expect(result.targets[0]).toMatchObject({
      source: "inferred_saved",
      saved: true,
      current: expect.objectContaining({ id: created.id }),
    });
    expect(Object.values(parsed.folders)[0]).toMatchObject({
      current_change: expect.objectContaining({ id: created.id }),
    });
  });

  it("switches to existing changes by token and blocks dirty worktrees", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    await initGit(cwd);
    const first = await createChange({
      cwd,
      title: "First change",
      now: testNow,
      randomId: () => "a111",
      sessionPath: session,
    });
    await commitAll(cwd, "first change");
    const second = await createChange({
      cwd,
      title: "Second change",
      now: testNow,
      randomId: () => "b222",
      sessionPath: session,
    });
    await commitAll(cwd, "second change");

    const switched = await switchChange({ cwd, change: "a111", sessionPath: session, now: testNow });
    await writeFile(path.join(cwd, "dirty.txt"), "dirty\n");

    await expect(switchChange({ cwd, change: second.id, sessionPath: session })).rejects.toThrow("Uncommitted changes");
    expect(switched.change.id).toBe(first.id);
    await expect(git(cwd, ["branch", "--show-current"])).resolves.toBe(first.branch);
  });

  it("reports status for explicit changes without activating them", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const created = await createChange({
      cwd,
      title: "Active change commands",
      now: testNow,
      randomId: () => "w3ye",
      sessionPath: session,
    });

    const result = await statusChange({ cwd, change: created.id, sessionPath: session });

    expect(result.targets[0]).toMatchObject({
      source: "explicit",
      change: expect.objectContaining({ id: created.id }),
      active: true,
    });
  });
});
