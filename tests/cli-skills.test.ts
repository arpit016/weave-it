import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../src/cli.js";

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-it-cli-skills-"));
}

describe("skills CLI", () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it("registers agent and skill commands", () => {
    const program = createProgram();

    expect(program.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["agent", "skills", "skill"]),
    );
  });

  it("installs skills through weave agent install", async () => {
    const cwd = await tempDir();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.chdir(cwd);

    await createProgram().parseAsync(["agent", "install", "codex"], { from: "user" });

    await expect(stat(path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md"))).resolves.toMatchObject({});
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-prd skill for codex"));
  });

  it("lists and shows bundled skills", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync(["skills", "list"], { from: "user" });
    await createProgram().parseAsync(["skill", "show", "weave-prd"], { from: "user" });

    const output = write.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("weave-prd");
    expect(output).toContain("weave workspace --json");
  });

  it("prints JSON where supported", async () => {
    const cwd = await tempDir();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.chdir(cwd);

    await createProgram().parseAsync(["agent", "install", "claude", "--json"], { from: "user" });

    const output = write.mock.calls.map((call) => String(call[0])).join("");
    expect(JSON.parse(output)).toEqual([
      expect.objectContaining({
        agent: "claude",
        skill: "weave-prd",
        status: "installed",
      }),
    ]);
  });

  it("writes manifest through the CLI install path", async () => {
    const cwd = await tempDir();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.chdir(cwd);

    await createProgram().parseAsync(["agent", "install", "claude"], { from: "user" });

    const manifest = await readFile(path.join(cwd, ".weave", "agents.yml"), "utf8");
    expect(manifest).toContain("claude:");
    expect(manifest).toContain("weave-prd:");

  });

  it("installs opencode skill and slash command through weave agent install", async () => {
    const cwd = await tempDir();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.chdir(cwd);

    await createProgram().parseAsync(["agent", "install", "opencode"], { from: "user" });

    await expect(stat(path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".opencode", "commands", "weave-prd.md"))).resolves.toMatchObject({});
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-prd command for opencode"));
  });

  it("reports unknown skills without throwing", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await createProgram().parseAsync(["skill", "show", "missing-skill"], { from: "user" });

    expect(stderr).toHaveBeenCalledWith("Unknown skill: missing-skill\n");
    expect(process.exitCode).toBe(1);
  });
});
