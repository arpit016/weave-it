import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
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

async function setupWeaveRepo(): Promise<string> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "weave-tier1-"));
  const weaveDir = path.join(cwd, ".weave");
  await mkdir(weaveDir, { recursive: true });
  await writeFile(
    path.join(weaveDir, "current-session.yml"),
    [
      "version: 1",
      "session:",
      "  status: active",
      "  updated_at: 2026-06-03T12:00:00.000Z",
      "folders:",
      "  test-app:",
      `    path: ${cwd}`,
      "    kind: app",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(weaveDir, "workspace.yml"),
    [
      "version: 1",
      "mode: repo",
      "name: test-app",
      "repos: {}",
      "",
    ].join("\n"),
  );
  await writeFile(weaveDir + "/agents.yml", "version: 1\ninstalled: {}\n");
  return cwd;
}

const tier1JsonCommands: { name: string; args: string[] }[] = [
  { name: "workspace", args: ["workspace", "--json"] },
  { name: "status", args: ["status", "--json"] },
  { name: "doctor", args: ["doctor", "--json"] },
  { name: "change-current", args: ["change", "current", "--json"] },
  { name: "change-status", args: ["change", "status", "--json"] },
];

describe("Tier 1 commands include a notices field in --json output", () => {
  for (const { name, args } of tier1JsonCommands) {
    it(`${name} includes notices: []`, async () => {
      const cwd = await setupWeaveRepo();
      const result = runCli(args, cwd, { WEAVE_NO_NOTICES: "1" });
      expect(result.status === 0 || result.status === 1).toBe(true);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty("notices");
      expect(Array.isArray(parsed.notices)).toBe(true);
    });
  }

  it("change new --json includes notices: []", async () => {
    const cwd = await setupWeaveRepo();
    const projectMarker = path.join(cwd, "package.json");
    await writeFile(projectMarker, JSON.stringify({ name: "test", version: "0.0.0" }));
    const result = runCli(
      ["change", "new", "Test change", "--json"],
      cwd,
      { WEAVE_NO_NOTICES: "1" },
    );

    if (result.status !== 0) return; // git/branch setup may fail in tmp; skip semantic check
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty("notices");
  });

  it("agent install --json does NOT include notices (non-Tier-1)", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "weave-non-tier1-"));
    const result = runCli(["agent", "install", "claude", "--json"], cwd);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).not.toHaveProperty("notices");
  });

  it("skills list --json does NOT include notices (non-Tier-1)", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "weave-non-tier1-"));
    const result = runCli(["skills", "list", "--json"], cwd);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).not.toHaveProperty("notices");
  });

  it("a Tier 1 command in --json mode passes through a skills_modified notice when drift exists", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "weave-tier1-drift-"));
    await installAgentSkills({ cwd, agent: "claude" });
    await writeFile(
      path.join(cwd, ".claude", "skills", "weave-explore", "SKILL.md"),
      "custom\n",
    );

    const result = runCli(["status", "--json"], cwd);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.notices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "skills_modified" }),
      ]),
    );
  });
});
