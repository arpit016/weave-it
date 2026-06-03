import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { installAgentSkills } from "../src/lib/agent-skills.js";

const projectRoot = path.resolve(__dirname, "..");
const cliEntry = path.resolve(projectRoot, "src", "cli.ts");
const tsxBinary = path.resolve(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");

interface CliResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): CliResult {
  const result = spawnSync(
    process.execPath,
    [tsxBinary, cliEntry, ...args],
    {
      cwd,
      env: { ...process.env, WEAVE_NO_NOTICES: undefined, ...env },
      encoding: "utf8",
    },
  );
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-status-"));
}

describe("weave status", () => {
  it("reports not-in-repo when run outside a Weave-managed folder", () => {
    const result = runCli(["status", "--json"], os.tmpdir());

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({ status: "ok", inRepo: false, skills: [] });
    expect(parsed.notices).toEqual([]);
  });

  it("returns ok with empty skills when in a Weave repo with no installed skills", async () => {
    const cwd = await tempDir();
    await writeFile(path.join(cwd, ".weave-marker"), "");
    const weaveDir = path.join(cwd, ".weave");
    await import("node:fs/promises").then((mod) => mod.mkdir(weaveDir, { recursive: true }));
    await writeFile(path.join(weaveDir, "agents.yml"), "version: 1\ninstalled: {}\n");

    const result = runCli(["status", "--json"], cwd);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({ status: "ok", inRepo: true, skills: [] });
  });

  it("lists installed skills with state=current after a fresh install", async () => {
    const cwd = await tempDir();
    await installAgentSkills({ cwd, agent: "claude" });

    const result = runCli(["status", "--json"], cwd);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.skills.length).toBeGreaterThan(0);
    for (const row of parsed.skills) {
      expect(row.state).toBe("current");
      expect(row.installed_from).toMatch(/^\d+\.\d+\.\d+/);
      expect(row.current).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it("marks an installed skill as state=modified after a local edit", async () => {
    const cwd = await tempDir();
    await installAgentSkills({ cwd, agent: "claude" });
    await writeFile(path.join(cwd, ".claude", "skills", "weave-explore", "SKILL.md"), "custom\n");

    const result = runCli(["status", "--json"], cwd);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    const explore = parsed.skills.find((row: { name: string }) => row.name === "weave-explore");
    expect(explore?.state).toBe("modified");
  });

  it("renders a readable text summary by default", async () => {
    const cwd = await tempDir();
    await installAgentSkills({ cwd, agent: "claude" });

    const result = runCli(["status"], cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("weave-it");
    expect(result.stdout).toContain("Installed skills:");
    expect(result.stdout).toContain("Notices:");
  });

  it("suppresses notices entirely when WEAVE_NO_NOTICES=1 is set", async () => {
    const cwd = await tempDir();
    await installAgentSkills({ cwd, agent: "claude" });
    await writeFile(path.join(cwd, ".claude", "skills", "weave-explore", "SKILL.md"), "custom\n");

    const result = runCli(["status", "--json"], cwd, { WEAVE_NO_NOTICES: "1" });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.notices).toEqual([]);
  });
});
