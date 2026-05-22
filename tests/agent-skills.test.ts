import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import {
  diffAgentSkills,
  installAgentSkills,
  listDefaultSkills,
  readDefaultSkill,
  resetAgentSkills,
  updateAgentSkills,
} from "../src/lib/agent-skills.js";

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-it-skills-"));
}

async function readManifest(cwd: string): Promise<unknown> {
  return YAML.parse(await readFile(path.join(cwd, ".weave", "agents.yml"), "utf8"));
}

describe("agent skills", () => {
  it("ships weave-prd as a canonical Agent Skills template", async () => {
    const skill = await readDefaultSkill("weave-prd");

    expect(skill.name).toBe("weave-prd");
    expect(skill.description).toContain("Stress-test product requirements");
    expect(skill.content).toContain("weave workspace --json");
    expect(skill.sourcePath).toContain(path.join("templates", "skills", "weave-prd", "SKILL.md"));
    expect(skill.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("lists default skills with metadata and hashes", async () => {
    const skills = await listDefaultSkills();

    expect(skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "weave-prd",
          description: expect.stringContaining("Stress-test product requirements"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
      ]),
    );
  });

  it("installs Codex and Cursor skills to .agents/skills", async () => {
    const cwd = await tempDir();

    const codex = await installAgentSkills({ cwd, agent: "codex", now: new Date("2026-05-19T00:00:00.000Z") });
    const cursor = await installAgentSkills({ cwd, agent: "cursor", now: new Date("2026-05-19T00:00:01.000Z") });

    const installed = await readFile(path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md"), "utf8");
    const manifest = await readManifest(cwd);

    expect(codex.results).toContainEqual(expect.objectContaining({ agent: "codex", kind: "skill", skill: "weave-prd", status: "installed" }));
    expect(cursor.results).toContainEqual(expect.objectContaining({ agent: "cursor", kind: "skill", skill: "weave-prd", status: "unchanged" }));
    expect(installed).toContain("name: weave-prd");
    expect(manifest).toMatchObject({
      version: 1,
      installed: {
        codex: {
          skills: {
            "weave-prd": {
              path: ".agents/skills/weave-prd/SKILL.md",
              installed_at: "2026-05-19T00:00:00.000Z",
            },
          },
        },
        cursor: {
          skills: {
            "weave-prd": {
              path: ".agents/skills/weave-prd/SKILL.md",
              installed_at: "2026-05-19T00:00:01.000Z",
            },
          },
        },
      },
    });
  });

  it("installs Claude skills to .claude/skills and all installs every supported target", async () => {
    const claudeCwd = await tempDir();
    const allCwd = await tempDir();

    await installAgentSkills({ cwd: claudeCwd, agent: "claude" });
    await installAgentSkills({ cwd: allCwd, agent: "all" });
    const manifest = await readManifest(allCwd);

    await expect(stat(path.join(claudeCwd, ".claude", "skills", "weave-prd", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".agents", "skills", "weave-prd", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".claude", "skills", "weave-prd", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".opencode", "commands", "weave-prd.md"))).resolves.toMatchObject({});
    expect(manifest).toMatchObject({
      installed: {
        codex: { skills: { "weave-prd": { path: ".agents/skills/weave-prd/SKILL.md" } } },
        cursor: { skills: { "weave-prd": { path: ".agents/skills/weave-prd/SKILL.md" } } },
        claude: { skills: { "weave-prd": { path: ".claude/skills/weave-prd/SKILL.md" } } },
        opencode: {
          skills: { "weave-prd": { path: ".agents/skills/weave-prd/SKILL.md" } },
          commands: { "weave-prd": { path: ".opencode/commands/weave-prd.md" } },
        },
      },
    });
  });

  it("does not overwrite a user-modified installed skill during install or update", async () => {
    const cwd = await tempDir();
    const installedPath = path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md");

    await installAgentSkills({ cwd, agent: "codex" });
    await writeFile(installedPath, "custom user edit\n");

    const installAgain = await installAgentSkills({ cwd, agent: "codex" });
    const update = await updateAgentSkills({ cwd, agent: "codex" });

    expect(installAgain.results).toContainEqual(expect.objectContaining({ status: "modified" }));
    expect(update.results).toContainEqual(expect.objectContaining({ status: "modified" }));
    await expect(readFile(installedPath, "utf8")).resolves.toBe("custom user edit\n");
  });

  it("updates untouched installed skills when the default source changes", async () => {
    const cwd = await tempDir();
    const templatesDir = path.join(cwd, "templates", "skills");
    const skillDir = path.join(templatesDir, "weave-prd");
    await mkdir(skillDir, { recursive: true });
    await writeFile(skillDir + "/SKILL.md", "---\nname: weave-prd\ndescription: Original\n---\n\nOriginal\n");

    await installAgentSkills({ cwd, agent: "codex", templatesDir });
    await writeFile(skillDir + "/SKILL.md", "---\nname: weave-prd\ndescription: Updated\n---\n\nUpdated\n");

    const update = await updateAgentSkills({ cwd, agent: "codex", templatesDir });
    const installed = await readFile(path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md"), "utf8");

    expect(update.results).toContainEqual(expect.objectContaining({ status: "updated" }));
    expect(installed).toContain("Updated");
  });

  it("resets modified skills only when explicitly requested", async () => {
    const cwd = await tempDir();
    const installedPath = path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md");

    await installAgentSkills({ cwd, agent: "codex" });
    await writeFile(installedPath, "custom user edit\n");

    const reset = await resetAgentSkills({ cwd, agent: "codex", skill: "weave-prd" });

    expect(reset.results).toContainEqual(expect.objectContaining({ status: "reset" }));
    await expect(readFile(installedPath, "utf8")).resolves.toContain("name: weave-prd");
  });

  it("shows diffs between installed skills and current defaults", async () => {
    const cwd = await tempDir();
    const installedPath = path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md");

    await installAgentSkills({ cwd, agent: "codex" });
    await writeFile(installedPath, "custom user edit\n");

    const result = await diffAgentSkills({ cwd, agent: "codex", skill: "weave-prd" });

    expect(result.status).toBe("ok");
    expect(result.message).toContain("--- installed");
    expect(result.message).toContain("+++ default");
    expect(result.message).toContain("-custom user edit");
    expect(result.message).toContain("+---");
  });

  it("installs opencode skill and slash command wrapper", async () => {
    const cwd = await tempDir();

    const install = await installAgentSkills({ cwd, agent: "opencode", now: new Date("2026-05-19T00:00:00.000Z") });
    const skill = await readFile(path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md"), "utf8");
    const command = await readFile(path.join(cwd, ".opencode", "commands", "weave-prd.md"), "utf8");
    const manifest = await readManifest(cwd);

    expect(install.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-prd", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-prd", status: "installed" }),
      ]),
    );
    expect(skill).toContain("name: weave-prd");
    expect(command).toContain("Load and follow the `weave-prd` skill.");
    expect(command).toContain("Topic: $ARGUMENTS");
    expect(manifest).toMatchObject({
      installed: {
        opencode: {
          skills: {
            "weave-prd": {
              path: ".agents/skills/weave-prd/SKILL.md",
            },
          },
          commands: {
            "weave-prd": {
              path: ".opencode/commands/weave-prd.md",
            },
          },
        },
      },
    });
  });

  it("re-running opencode install is idempotent and does not create native opencode skills", async () => {
    const cwd = await tempDir();

    await installAgentSkills({ cwd, agent: "opencode" });
    const installAgain = await installAgentSkills({ cwd, agent: "opencode" });

    expect(installAgain.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-prd", status: "unchanged" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-prd", status: "unchanged" }),
      ]),
    );
    await expect(stat(path.join(cwd, ".opencode", "skills"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not overwrite a user-modified opencode command during install or update", async () => {
    const cwd = await tempDir();
    const commandPath = path.join(cwd, ".opencode", "commands", "weave-prd.md");

    await installAgentSkills({ cwd, agent: "opencode" });
    await writeFile(commandPath, "custom opencode command\n");

    const installAgain = await installAgentSkills({ cwd, agent: "opencode" });
    const update = await updateAgentSkills({ cwd, agent: "opencode" });

    expect(installAgain.results).toContainEqual(expect.objectContaining({ kind: "command", status: "modified" }));
    expect(update.results).toContainEqual(expect.objectContaining({ kind: "command", status: "modified" }));
    await expect(readFile(commandPath, "utf8")).resolves.toBe("custom opencode command\n");
  });

  it("updates untouched opencode command wrappers when the default command changes", async () => {
    const cwd = await tempDir();
    const templatesDir = path.join(cwd, "templates", "skills");
    const commandTemplatesDir = path.join(cwd, "templates", "opencode", "commands");
    const skillDir = path.join(templatesDir, "weave-prd");
    await mkdir(skillDir, { recursive: true });
    await mkdir(commandTemplatesDir, { recursive: true });
    await writeFile(skillDir + "/SKILL.md", "---\nname: weave-prd\ndescription: Original\n---\n\nOriginal\n");
    await writeFile(commandTemplatesDir + "/weave-prd.md", "---\ndescription: Original command\n---\n\nOriginal command\n");

    await installAgentSkills({ cwd, agent: "opencode", templatesDir, commandTemplatesDir });
    await writeFile(commandTemplatesDir + "/weave-prd.md", "---\ndescription: Updated command\n---\n\nUpdated command\n");

    const update = await updateAgentSkills({ cwd, agent: "opencode", templatesDir, commandTemplatesDir });
    const command = await readFile(path.join(cwd, ".opencode", "commands", "weave-prd.md"), "utf8");

    expect(update.results).toContainEqual(expect.objectContaining({ kind: "command", status: "updated" }));
    expect(command).toContain("Updated command");
  });

  it("resets opencode skill and command when explicitly requested", async () => {
    const cwd = await tempDir();
    const skillPath = path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md");
    const commandPath = path.join(cwd, ".opencode", "commands", "weave-prd.md");

    await installAgentSkills({ cwd, agent: "opencode" });
    await writeFile(skillPath, "custom skill\n");
    await writeFile(commandPath, "custom command\n");

    const reset = await resetAgentSkills({ cwd, agent: "opencode", skill: "weave-prd" });

    expect(reset.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "skill", status: "reset" }),
        expect.objectContaining({ kind: "command", status: "reset" }),
      ]),
    );
    await expect(readFile(skillPath, "utf8")).resolves.toContain("name: weave-prd");
    await expect(readFile(commandPath, "utf8")).resolves.toContain("Topic: $ARGUMENTS");
  });
});
