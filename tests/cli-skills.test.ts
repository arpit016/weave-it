import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../src/cli.js";
import { createChange } from "../src/lib/changes.js";

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-it-cli-skills-"));
}

describe("skills CLI", () => {
  const originalCwd = process.cwd();
  const originalSessionPath = process.env.WEAVE_SESSION_PATH;

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalSessionPath === undefined) {
      delete process.env.WEAVE_SESSION_PATH;
    } else {
      process.env.WEAVE_SESSION_PATH = originalSessionPath;
    }
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

    await expect(stat(path.join(cwd, ".agents", "skills", "weave-explore", "SKILL.md"))).resolves.toMatchObject({});
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-explore skill for codex"));
  });

  it("lists and shows bundled skills", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await createProgram().parseAsync(["skills", "list"], { from: "user" });
    await createProgram().parseAsync(["skill", "show", "weave-explore"], { from: "user" });
    await createProgram().parseAsync(["skill", "show", "weave-prd"], { from: "user" });
    await createProgram().parseAsync(["skill", "show", "weave-architect"], { from: "user" });
    await createProgram().parseAsync(["skill", "show", "weave-clarify"], { from: "user" });
    await createProgram().parseAsync(["skill", "show", "weave-issues"], { from: "user" });
    await createProgram().parseAsync(["skill", "show", "weave-next"], { from: "user" });

    const output = write.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toContain("weave-explore");
    expect(output).toContain("weave-prd");
    expect(output).toContain("weave-architect");
    expect(output).toContain("weave-clarify");
    expect(output).toContain("weave-issues");
    expect(output).toContain("weave-next");
    expect(output).toContain("weave workspace --json");
    expect(output).toContain("Treat `prd.md` as a living product artifact");
    expect(output).toContain("Treat `prd.md` as the primary product contract");
    expect(output).toContain("Treat the selected target artifact as the only write target");
    expect(output).toContain("tracer-bullet");
    expect(output).toContain("`weave-next` is read-only advisory");
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
          skill: "weave-explore",
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
    expect(manifest).toContain("weave-explore:");
  });

  it("installs opencode skill and slash command through weave agent install", async () => {
    const cwd = await tempDir();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.chdir(cwd);

    await createProgram().parseAsync(["agent", "install", "opencode"], { from: "user" });

    await expect(stat(path.join(cwd, ".agents", "skills", "weave-explore", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".agents", "skills", "weave-architect", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".agents", "skills", "weave-clarify", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".agents", "skills", "weave-issues", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".agents", "skills", "weave-next", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".opencode", "commands", "weave-explore.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".opencode", "commands", "weave-prd.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".opencode", "commands", "weave-architect.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".opencode", "commands", "weave-clarify.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".opencode", "commands", "weave-issues.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(cwd, ".opencode", "commands", "weave-next.md"))).resolves.toMatchObject({});
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-explore command for opencode"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-prd command for opencode"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-architect command for opencode"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-clarify command for opencode"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-issues command for opencode"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Installed weave-next command for opencode"));
  });

  it("creates change explorations through weave change new", async () => {
    const cwd = await tempDir();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.chdir(cwd);
    process.env.WEAVE_SESSION_PATH = path.join(cwd, ".session.yml");

    await createProgram().parseAsync(["change", "new", "Analytics of reviews", "--type", "fix", "--slug", "review-analytics"], { from: "user" });

    const output = write.mock.calls.map((call) => String(call[0])).join("");
    const match = /Created change: \d{6}-[a-z0-9]{4}-review-analytics/.exec(output);
    expect(match).not.toBeNull();
    expect(output).toContain("Type: fix");
    const changeId = output.match(/Created change: ([^\n]+)/)?.[1];
    expect(changeId).toBeDefined();
    await expect(stat(path.join(cwd, "wiki", "changes", changeId ?? "", "exploration.md"))).resolves.toMatchObject({});
  });

  it("prints JSON errors for change command failures", async () => {
    const cwd = await tempDir();
    const sessionPath = path.join(cwd, ".session.yml");
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    process.chdir(cwd);
    process.env.WEAVE_SESSION_PATH = sessionPath;
    await createChange({ cwd, title: "Review import", slug: "review-import", randomId: () => "a111", sessionPath });
    await createChange({ cwd, title: "Review export", slug: "review-export", randomId: () => "b222", sessionPath });

    await createProgram().parseAsync(["change", "switch", "review", "--json"], { from: "user" });

    const output = write.mock.calls.map((call) => String(call[0])).join("");
    expect(JSON.parse(output)).toMatchObject({
      status: "error",
      code: "ambiguous_change",
      details: {
        candidates: expect.arrayContaining([
          expect.objectContaining({ id: expect.stringContaining("review-import") }),
          expect.objectContaining({ id: expect.stringContaining("review-export") }),
        ]),
      },
    });
    expect(process.exitCode).toBe(1);
  });

  it("reports unknown skills without throwing", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await createProgram().parseAsync(["skill", "show", "missing-skill"], { from: "user" });

    expect(stderr).toHaveBeenCalledWith("Unknown skill: missing-skill\n");
    expect(process.exitCode).toBe(1);
  });
});
