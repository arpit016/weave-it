import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { createProgram } from "../src/cli.js";
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
      env: { ...process.env, WEAVE_NO_NOTICES: "1", ...env },
      encoding: "utf8",
    },
  );
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-doctor-"));
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

describe("weave doctor", () => {
  it("registers the doctor command", () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toContain("doctor");
  });

  it("reports missing safe scaffold files without changing them", async () => {
    const cwd = await tempDir();
    await writeWorkspaceMetadata(cwd);

    const result = runCli(["doctor", "--json"], cwd);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.status).toBe("warning");
    expect(parsed.changed).toEqual([]);
    expect(parsed.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "safe_scaffold",
          status: "warning",
          fixable: true,
          files: expect.arrayContaining([".weave/architecture-considerations.md"]),
        }),
      ]),
    );
    await expect(stat(path.join(cwd, ".weave", "architecture-considerations.md"))).rejects.toThrow();
  });

  it("renders a readable text report by default", async () => {
    const cwd = await tempDir();
    await writeWorkspaceMetadata(cwd);

    const result = runCli(["doctor"], cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Weave Doctor");
    expect(result.stdout).toContain("Checks");
    expect(result.stdout).toContain("Summary");
    expect(result.stdout).toContain("No files were changed");
  });

  it("reports an error outside a Weave context", async () => {
    const cwd = await tempDir();

    const result = runCli(["doctor", "--json"], cwd);

    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.status).toBe("error");
    expect(parsed.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "weave_context",
          status: "error",
        }),
      ]),
    );
  });

  it("reports skill drift without repairing installed skills", async () => {
    const cwd = await tempDir();
    await writeWorkspaceMetadata(cwd);
    await installAgentSkills({ cwd, agent: "claude" });
    const skillPath = path.join(cwd, ".claude", "skills", "weave-explore", "SKILL.md");
    await writeFile(skillPath, "custom\n");

    const result = runCli(["doctor", "--json"], cwd);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "skill_drift",
          status: "warning",
          fixable: false,
          details: expect.arrayContaining([expect.stringContaining("claude/weave-explore: modified")]),
        }),
      ]),
    );
    await expect(readFile(skillPath, "utf8")).resolves.toBe("custom\n");
  });

  it("fixes missing safe scaffold files without overwriting existing files", async () => {
    const cwd = await tempDir();
    await writeWorkspaceMetadata(cwd);
    const architectureConsiderationsPath = path.join(cwd, ".weave", "architecture-considerations.md");

    const first = runCli(["doctor", "--fix", "--json"], cwd);

    expect(first.status).toBe(0);
    const firstParsed = JSON.parse(first.stdout);
    expect(firstParsed.changed).toEqual(
      expect.arrayContaining([
        ".weave/architecture-considerations.md",
        "wiki/knowledge/index.md",
      ]),
    );
    await expect(readFile(architectureConsiderationsPath, "utf8")).resolves.toContain("# Architecture Considerations");

    await writeFile(architectureConsiderationsPath, "team-owned notes\n");
    const second = runCli(["doctor", "--fix", "--json"], cwd);

    expect(second.status).toBe(0);
    const secondParsed = JSON.parse(second.stdout);
    expect(secondParsed.changed).toEqual([]);
    await expect(readFile(architectureConsiderationsPath, "utf8")).resolves.toBe("team-owned notes\n");
  });

  it("does not update installed skills during fix", async () => {
    const cwd = await tempDir();
    await writeWorkspaceMetadata(cwd);
    await installAgentSkills({ cwd, agent: "claude" });
    const skillPath = path.join(cwd, ".claude", "skills", "weave-explore", "SKILL.md");
    await writeFile(skillPath, "custom\n");

    const result = runCli(["doctor", "--fix", "--json"], cwd);

    expect(result.status).toBe(0);
    await expect(readFile(skillPath, "utf8")).resolves.toBe("custom\n");
  });
});
