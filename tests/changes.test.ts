import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { clearCurrentArtifact, currentArtifact, setCurrentArtifact } from "../src/lib/artifact-context.js";
import { createChange, currentChange, listChanges, progressChange, propagateChange, statusChange, switchChange } from "../src/lib/changes.js";

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
    const explorationFrontmatter = YAML.parse(exploration.split("---")[1]);

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
    expect(explorationFrontmatter).toMatchObject({
      artifact: "exploration",
      status: "draft",
      owner: "product",
      created_at: "2026-05-22",
      updated_at: "2026-05-22",
      reviewed_at: null,
      approved_at: null,
      approved_by: null,
      source: "discussion",
    });
    await expect(stat(path.join(changePath, "sessions"))).resolves.toMatchObject({});
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
    const appPath = await realpath(app);
    const apiPath = await realpath(api);
    const parsed = YAML.parse(await readFile(sessionPath(root), "utf8"));
    expect(Object.values(parsed.folders)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: appPath,
          current_artifact: expect.objectContaining({ artifact: "exploration", change_id: result.id }),
        }),
        expect.objectContaining({
          path: apiPath,
          current_artifact: expect.objectContaining({ artifact: "exploration", change_id: result.id }),
        }),
      ]),
    );
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
      current_artifact: {
        artifact: "exploration",
        change_id: result.id,
        path: path.join("wiki", "changes", result.id, "exploration.md"),
      },
    });
    expect(result.message).toContain("current");
  });

  it("sets, reads, and clears current artifact context", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const created = await createChange({
      cwd,
      title: "Artifact context commands",
      now: testNow,
      randomId: () => "c7tt",
      sessionPath: session,
    });

    const set = await setCurrentArtifact({ cwd, artifact: "prd", sessionPath: session, now: testNow });
    const current = await currentArtifact({ cwd, sessionPath: session, now: testNow });
    const cleared = await clearCurrentArtifact({ cwd, sessionPath: session, now: testNow });

    expect(set.targets[0]).toMatchObject({
      source: "session",
      current: true,
      artifact: {
        artifact: "prd",
        change_id: created.id,
        path: path.join("wiki", "changes", created.id, "prd.md"),
      },
    });
    expect(current.targets[0]).toMatchObject({
      source: "session",
      current: true,
      artifact: expect.objectContaining({ artifact: "prd" }),
    });
    expect(cleared.targets[0]).toMatchObject({
      source: "none",
      current: false,
      current_change: expect.objectContaining({ id: created.id }),
    });
  });

  it("rejects invalid artifact context names", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    await createChange({
      cwd,
      title: "Artifact context validation",
      now: testNow,
      randomId: () => "v8ld",
      sessionPath: session,
    });

    await expect(setCurrentArtifact({ cwd, artifact: "decision-log", sessionPath: session })).rejects.toThrow("Unsupported artifact");
  });

  it("reports no current artifact for older session files without artifact context", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const created = await createChange({
      cwd,
      title: "Backward compatible session",
      now: testNow,
      randomId: () => "d8yy",
      sessionPath: session,
    });
    const existing = YAML.parse(await readFile(session, "utf8"));
    const [folderId, folder] = Object.entries(existing.folders)[0] as [
      string,
      { path: string; name: string; kind: string },
    ];

    await writeFile(
      session,
      YAML.stringify({
        version: 1,
        updated_at: testNow.toISOString(),
        folders: {
          [folderId]: {
            path: folder.path,
            name: folder.name,
            kind: folder.kind,
            current_change: {
              id: created.id,
              path: path.join("wiki", "changes", created.id),
              branch: created.branch,
              updated_at: testNow.toISOString(),
            },
          },
        },
      }),
    );

    const result = await currentArtifact({ cwd, sessionPath: session, now: testNow });

    expect(result.targets[0]).toMatchObject({
      source: "none",
      current: false,
      current_change: expect.objectContaining({ id: created.id }),
    });
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

  it("clears stale artifact context when switching to another change", async () => {
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
    await setCurrentArtifact({ cwd, artifact: "architecture", sessionPath: session, now: testNow });
    await commitAll(cwd, "second change");

    await switchChange({ cwd, change: first.id, sessionPath: session, now: testNow });
    const parsed = YAML.parse(await readFile(session, "utf8"));
    const folder = Object.values(parsed.folders)[0] as { current_artifact?: unknown };

    expect(second.id).toBe("260522-b222-second-change");
    expect(folder.current_artifact).toBeUndefined();
  });

  it("preserves valid artifact context when switching to the same change", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    await initGit(cwd);
    const created = await createChange({
      cwd,
      title: "Preserve artifact context",
      now: testNow,
      randomId: () => "p111",
      sessionPath: session,
    });
    await setCurrentArtifact({ cwd, artifact: "prd", sessionPath: session, now: testNow });
    await commitAll(cwd, "preserve artifact context");

    await switchChange({ cwd, change: created.id, sessionPath: session, now: testNow });
    const parsed = YAML.parse(await readFile(session, "utf8"));
    const folder = Object.values(parsed.folders)[0] as { current_artifact?: unknown };

    expect(folder.current_artifact).toMatchObject({
      artifact: "prd",
      change_id: created.id,
      path: path.join("wiki", "changes", created.id, "prd.md"),
    });
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

  it("records lifecycle progress and downstream stale lanes", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const created = await createChange({
      cwd,
      title: "Lifecycle state",
      now: testNow,
      randomId: () => "l111",
      sessionPath: session,
    });
    const changePath = path.join(cwd, "wiki", "changes", created.id);
    await writeFile(path.join(changePath, "prd.md"), "# PRD\n\nSubstantive PRD.\n");
    await writeFile(path.join(changePath, "architecture.md"), "# Architecture\n\nSubstantive architecture.\n");
    await writeFile(path.join(changePath, "tasks.md"), "# Tasks\n\n- [ ] Build it.\n");

    const progressed = await progressChange({
      cwd,
      stage: "exploration",
      sessionPath: session,
      now: testNow,
    });
    const status = YAML.parse(await readFile(path.join(changePath, "status.yml"), "utf8"));

    expect(progressed.change).toMatchObject({
      id: created.id,
      stage: "issues",
      stale: {
        prd: { invalidated_by: "exploration", invalidated_at: testNow.toISOString() },
        architecture: { invalidated_by: "exploration", invalidated_at: testNow.toISOString() },
        issues: { invalidated_by: "exploration", invalidated_at: testNow.toISOString() },
      },
    });
    expect(status).toMatchObject({
      stage: "issues",
      stale: {
        prd: { invalidated_by: "exploration", invalidated_at: testNow.toISOString() },
        architecture: { invalidated_by: "exploration", invalidated_at: testNow.toISOString() },
        issues: { invalidated_by: "exploration", invalidated_at: testNow.toISOString() },
      },
    });
  });

  it("clears only the refreshed stale lane and keeps stage from regressing", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const created = await createChange({
      cwd,
      title: "Refresh lifecycle state",
      now: testNow,
      randomId: () => "l222",
      sessionPath: session,
    });
    const changePath = path.join(cwd, "wiki", "changes", created.id);
    await writeFile(path.join(changePath, "prd.md"), "# PRD\n\nSubstantive PRD.\n");
    await writeFile(path.join(changePath, "architecture.md"), "# Architecture\n\nSubstantive architecture.\n");
    await writeFile(path.join(changePath, "tasks.md"), "# Tasks\n\n- [ ] Build it.\n");

    await progressChange({ cwd, stage: "prd", sessionPath: session, now: testNow });
    const refreshed = await progressChange({
      cwd,
      stage: "architecture",
      sessionPath: session,
      now: new Date(2026, 4, 22, 11, 0, 0),
    });
    const status = await statusChange({ cwd, sessionPath: session });

    expect(refreshed.change.stage).toBe("issues");
    expect(refreshed.change.stale.prd).toBeUndefined();
    expect(refreshed.change.stale.architecture).toBeUndefined();
    expect(refreshed.change.stale.issues).toMatchObject({ invalidated_by: "architecture" });
    expect(status.message).toContain("Stage: issues");
    expect(status.message).toContain("Stale: issues (invalidated by architecture)");
  });
});
