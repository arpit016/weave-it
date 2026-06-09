import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { clearChangeStaleness, createChange, progressChange } from "../src/lib/changes.js";

const testNow = new Date(2026, 4, 22, 10, 0, 0);

async function tempDir(): Promise<string> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "weave-stale-"));
  await writeWorkspaceMetadata(cwd);
  return cwd;
}

async function writeWorkspaceMetadata(cwd: string): Promise<void> {
  await mkdir(path.join(cwd, ".weave"), { recursive: true });
  await writeFile(
    path.join(cwd, ".weave", "workspace.yml"),
    YAML.stringify({
      version: 1,
      mode: "repo",
      name: path.basename(cwd),
      repos: {},
    }),
  );
}

function sessionPath(cwd: string): string {
  return path.join(cwd, ".session.yml");
}

async function setupChangeWithDownstream(cwd: string): Promise<string> {
  const session = sessionPath(cwd);
  const created = await createChange({
    cwd,
    title: "Stale flags",
    now: testNow,
    randomId: () => "sX01",
    sessionPath: session,
  });
  const changePath = path.join(cwd, "wiki", "changes", created.id);
  await writeFile(path.join(changePath, "prd.md"), "# PRD\n\nFirst draft.\n");
  await writeFile(path.join(changePath, "architecture.md"), "# Architecture\n\nFirst draft.\n");
  await writeFile(path.join(changePath, "tasks.md"), "# Tasks\n\n- [ ] One.\n");
  await progressChange({ cwd, stage: "architecture", sources: ["prd"], sessionPath: session, now: testNow });
  await progressChange({
    cwd,
    stage: "slices",
    sources: ["architecture"],
    sessionPath: session,
    now: new Date(2026, 4, 22, 10, 30, 0),
  });
  return changePath;
}

async function readStatus(changePath: string): Promise<{ stale?: Record<string, unknown> }> {
  return YAML.parse(await readFile(path.join(changePath, "status.yml"), "utf8"));
}

describe("progressChange staleness flags", () => {
  it("default propagation marks downstream lanes stale (regression baseline)", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const changePath = await setupChangeWithDownstream(cwd);

    await progressChange({
      cwd,
      stage: "prd",
      sources: ["exploration"],
      sessionPath: session,
      now: new Date(2026, 4, 22, 11, 0, 0),
    });

    const status = await readStatus(changePath);
    expect(status.stale).toMatchObject({
      architecture: { invalidated_by: "prd" },
      slices: { invalidated_by: "prd" },
    });
  });

  it("--no-invalidate suppresses all downstream stale propagation", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const changePath = await setupChangeWithDownstream(cwd);

    await progressChange({
      cwd,
      stage: "prd",
      sources: ["exploration"],
      sessionPath: session,
      now: new Date(2026, 4, 22, 11, 0, 0),
      noInvalidate: true,
    });

    const status = await readStatus(changePath);
    expect(status.stale ?? {}).toEqual({});
  });

  it("--invalidate marks only the named subset of downstream lanes stale", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const changePath = await setupChangeWithDownstream(cwd);

    await progressChange({
      cwd,
      stage: "prd",
      sources: ["exploration"],
      sessionPath: session,
      now: new Date(2026, 4, 22, 11, 0, 0),
      invalidateOnly: ["slices"],
    });

    const status = await readStatus(changePath);
    expect(status.stale ?? {}).toMatchObject({
      slices: { invalidated_by: "prd" },
    });
    expect((status.stale ?? {}).architecture).toBeUndefined();
  });

  it("rejects --invalidate values that are not transitive dependents of the progressed lane", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    await setupChangeWithDownstream(cwd);

    await expect(
      progressChange({
        cwd,
        stage: "prd",
        sources: ["exploration"],
        sessionPath: session,
        now: new Date(2026, 4, 22, 11, 0, 0),
        invalidateOnly: ["exploration"],
      }),
    ).rejects.toMatchObject({ code: "invalid_invalidate_target" });
  });

  it("rejects combining --no-invalidate with --invalidate", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    await setupChangeWithDownstream(cwd);

    await expect(
      progressChange({
        cwd,
        stage: "prd",
        sources: ["exploration"],
        sessionPath: session,
        now: new Date(2026, 4, 22, 11, 0, 0),
        noInvalidate: true,
        invalidateOnly: ["slices"],
      }),
    ).rejects.toMatchObject({ code: "conflicting_stale_flags" });
  });
});

describe("clearChangeStaleness", () => {
  it("removes a stale flag and appends a stale_history entry with the reason", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const changePath = await setupChangeWithDownstream(cwd);
    await progressChange({
      cwd,
      stage: "prd",
      sources: ["exploration"],
      sessionPath: session,
      now: new Date(2026, 4, 22, 11, 0, 0),
    });

    const result = await clearChangeStaleness({
      cwd,
      lane: "architecture",
      sessionPath: session,
      reason: "Verified content sync",
      now: new Date(2026, 4, 22, 11, 30, 0),
    });

    expect(result.change.stale.architecture).toBeUndefined();
    expect(result.change.stale.slices).toBeDefined();
    expect(result.history_entry).toMatchObject({
      lane: "architecture",
      invalidated_by: "prd",
      reason: "Verified content sync",
    });

    const status = await readStatus(changePath);
    expect((status as { stale_history?: unknown[] }).stale_history).toEqual([
      expect.objectContaining({
        lane: "architecture",
        invalidated_by: "prd",
        cleared_at: new Date(2026, 4, 22, 11, 30, 0).toISOString(),
        reason: "Verified content sync",
      }),
    ]);
  });

  it("rejects clearing a lane that is not currently stale", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    await setupChangeWithDownstream(cwd);

    await expect(
      clearChangeStaleness({ cwd, lane: "exploration", sessionPath: session, reason: "n/a" }),
    ).rejects.toMatchObject({ code: "lane_not_stale" });
  });

  it("records the history entry with reason=null when --reason is omitted", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    await setupChangeWithDownstream(cwd);
    await progressChange({
      cwd,
      stage: "prd",
      sources: ["exploration"],
      sessionPath: session,
      now: new Date(2026, 4, 22, 11, 0, 0),
    });

    const result = await clearChangeStaleness({
      cwd,
      lane: "slices",
      sessionPath: session,
      now: new Date(2026, 4, 22, 11, 30, 0),
    });

    expect(result.history_entry.reason).toBeNull();
  });

  it("preserves earlier stale_history entries across multiple clears", async () => {
    const cwd = await tempDir();
    const session = sessionPath(cwd);
    const changePath = await setupChangeWithDownstream(cwd);
    await progressChange({
      cwd,
      stage: "prd",
      sources: ["exploration"],
      sessionPath: session,
      now: new Date(2026, 4, 22, 11, 0, 0),
    });

    await clearChangeStaleness({
      cwd,
      lane: "architecture",
      sessionPath: session,
      reason: "first",
      now: new Date(2026, 4, 22, 11, 30, 0),
    });
    await clearChangeStaleness({
      cwd,
      lane: "slices",
      sessionPath: session,
      reason: "second",
      now: new Date(2026, 4, 22, 12, 0, 0),
    });

    const status = await readStatus(changePath);
    const history = (status as { stale_history: unknown[] }).stale_history;
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ lane: "architecture", reason: "first" });
    expect(history[1]).toMatchObject({ lane: "slices", reason: "second" });
  });
});
