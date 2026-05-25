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
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toEqual(
      expect.arrayContaining(["agent", "change", "skills", "skill"]),
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
    await createProgram().parseAsync(["skill", "show", "weave-issues"], { from: "user" });

    const output = write.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("weave-prd");
    expect(output).toContain("weave-issues");
    expect(output).toContain("weave workspace --json");
    expect(output).toContain("tracer-bullet");
  });

  it("prints JSON where supported", async () => {
    const cwd = await tempDir();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.chdir(cwd);

    await createProgram().parseAsync(["agent", "install", "claude", "--json"], { from: "user" });

    const output = write.mock.calls.map((call) => String(call[0])).join("");
    expect(JSON.parse(output)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agent: "claude",
          skill: "weave-prd",
          status: "installed",
        }),
      ]),
    );
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
    await expect(stat(path.join(cwd, ".agents", "skills", "weave-issues", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".opencode", "commands", "weave-prd.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".opencode", "commands", "weave-issues.md"))).resolves.toMatchObject({});
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-prd command for opencode"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-issues command for opencode"));
  });

  it("creates change explorations through weave change new", async () => {
    const cwd = await tempDir();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.chdir(cwd);

    await createProgram().parseAsync(["change", "new", "Analytics of reviews", "--type", "fix", "--slug", "review-analytics"], { from: "user" });

    const output = write.mock.calls.map((call) => String(call[0])).join("");
    const match = /Created change: \d{6}-[a-z0-9]{4}-review-analytics/.exec(output);
    expect(match).not.toBeNull();
    expect(output).toContain("Type: fix");
    const changeId = output.match(/Created change: ([^\n]+)/)?.[1];
    expect(changeId).toBeDefined();
    await expect(stat(path.join(cwd, "wiki", "changes", changeId ?? "", "exploration.md"))).resolves.toMatchObject({});
  });

  it("reports unknown skills without throwing", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await createProgram().parseAsync(["skill", "show", "missing-skill"], { from: "user" });

    expect(stderr).toHaveBeenCalledWith("Unknown skill: missing-skill\n");
    expect(process.exitCode).toBe(1);
  });
});
