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
  return YAML.parse(await readFile(path.join(cwd, "weave", "agents.yml"), "utf8"));
}

describe("agent skills", () => {
  it("ships explore-product as a canonical Agent Skills template", async () => {
    const skill = await readDefaultSkill("explore-product");

    expect(skill.name).toBe("explore-product");
    expect(skill.description).toContain("Stress-test product requirements");
    expect(skill.content).toContain("weave workspace --json");
    expect(skill.sourcePath).toContain(path.join("templates", "skills", "explore-product", "SKILL.md"));
    expect(skill.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("lists default skills with metadata and hashes", async () => {
    const skills = await listDefaultSkills();

    expect(skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "explore-product",
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

    const installed = await readFile(path.join(cwd, ".agents", "skills", "explore-product", "SKILL.md"), "utf8");
    const manifest = await readManifest(cwd);

    expect(codex.results).toContainEqual(expect.objectContaining({ agent: "codex", skill: "explore-product", status: "installed" }));
    expect(cursor.results).toContainEqual(expect.objectContaining({ agent: "cursor", skill: "explore-product", status: "unchanged" }));
    expect(installed).toContain("name: explore-product");
    expect(manifest).toMatchObject({
      version: 1,
      installed: {
        codex: {
          "explore-product": {
            path: ".agents/skills/explore-product/SKILL.md",
            installed_at: "2026-05-19T00:00:00.000Z",
          },
        },
        cursor: {
          "explore-product": {
            path: ".agents/skills/explore-product/SKILL.md",
            installed_at: "2026-05-19T00:00:01.000Z",
          },
        },
      },
    });
  });

  it("installs Claude skills to .claude/skills and all installs both target trees", async () => {
    const claudeCwd = await tempDir();
    const allCwd = await tempDir();

    await installAgentSkills({ cwd: claudeCwd, agent: "claude" });
    await installAgentSkills({ cwd: allCwd, agent: "all" });

    await expect(stat(path.join(claudeCwd, ".claude", "skills", "explore-product", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".agents", "skills", "explore-product", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".claude", "skills", "explore-product", "SKILL.md"))).resolves.toMatchObject({});
  });

  it("does not overwrite a user-modified installed skill during install or update", async () => {
    const cwd = await tempDir();
    const installedPath = path.join(cwd, ".agents", "skills", "explore-product", "SKILL.md");

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
    const skillDir = path.join(templatesDir, "explore-product");
    await mkdir(skillDir, { recursive: true });
    await writeFile(skillDir + "/SKILL.md", "---\nname: explore-product\ndescription: Original\n---\n\nOriginal\n");

    await installAgentSkills({ cwd, agent: "codex", templatesDir });
    await writeFile(skillDir + "/SKILL.md", "---\nname: explore-product\ndescription: Updated\n---\n\nUpdated\n");

    const update = await updateAgentSkills({ cwd, agent: "codex", templatesDir });
    const installed = await readFile(path.join(cwd, ".agents", "skills", "explore-product", "SKILL.md"), "utf8");

    expect(update.results).toContainEqual(expect.objectContaining({ status: "updated" }));
    expect(installed).toContain("Updated");
  });

  it("resets modified skills only when explicitly requested", async () => {
    const cwd = await tempDir();
    const installedPath = path.join(cwd, ".agents", "skills", "explore-product", "SKILL.md");

    await installAgentSkills({ cwd, agent: "codex" });
    await writeFile(installedPath, "custom user edit\n");

    const reset = await resetAgentSkills({ cwd, agent: "codex", skill: "explore-product" });

    expect(reset.results).toContainEqual(expect.objectContaining({ status: "reset" }));
    await expect(readFile(installedPath, "utf8")).resolves.toContain("name: explore-product");
  });

  it("shows diffs between installed skills and current defaults", async () => {
    const cwd = await tempDir();
    const installedPath = path.join(cwd, ".agents", "skills", "explore-product", "SKILL.md");

    await installAgentSkills({ cwd, agent: "codex" });
    await writeFile(installedPath, "custom user edit\n");

    const result = await diffAgentSkills({ cwd, agent: "codex", skill: "explore-product" });

    expect(result.status).toBe("ok");
    expect(result.message).toContain("--- installed");
    expect(result.message).toContain("+++ default");
    expect(result.message).toContain("-custom user edit");
    expect(result.message).toContain("+---");
  });
});
