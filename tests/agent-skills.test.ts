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
  it("ships weave-explore as a canonical Agent Skills template", async () => {
    const skill = await readDefaultSkill("weave-explore");

    expect(skill.name).toBe("weave-explore");
    expect(skill.description).toContain("Stress-test product requirements");
    expect(skill.content).toContain("# Plan Mode Guard");
    expect(skill.content).toContain("This skill must run in Plan Mode. Switch to Plan Mode, then invoke weave-explore again.");
    expect(skill.content).toContain("Static Weave skill content cannot automatically switch collaboration mode");
    expect(skill.content).toContain("In Plan Mode, do not write repo-tracked artifacts directly");
    expect(skill.content).toContain("weave workspace --json");
    expect(skill.content).toContain("weave artifact current set exploration --json");
    expect(skill.content).toContain("`weave-explore` means enter or resume exploration for the active change.");
    expect(skill.content).toContain("Read `wiki/changes/<change-id>/exploration.md` first. Treat the live artifact as canonical current truth.");
    expect(skill.content).toContain("sessions/*-exploration.md");
    expect(skill.content).toContain("Prioritize the latest `## Next Resume Point`");
    expect(skill.content).toContain("Loaded exploration.md and <N> exploration session note(s).");
    expect(skill.sourcePath).toContain(path.join("templates", "skills", "weave-explore", "SKILL.md"));
    expect(skill.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("ships weave-prd as a canonical PRD generation skill", async () => {
    const skill = await readDefaultSkill("weave-prd");

    expect(skill.name).toBe("weave-prd");
    expect(skill.description).toContain("Generate or revise prd.md");
    expect(skill.content).toContain("Treat `prd.md` as a living product artifact");
    expect(skill.content).toContain("Require a usable `exploration.md` before generating or revising `prd.md`");
    expect(skill.content).toContain("No usable exploration.md found for <change-id>. Run `weave-explore` first, then run `weave-prd` again.");
    expect(skill.content).toContain("scaffold-only with headings but no substantive content");
    expect(skill.content).toContain("explicitly marked `PRD Readiness` as `Not ready`");
    expect(skill.content).toContain("Do not simulate `weave-explore`");
    expect(skill.content).toContain("weave change status");
    expect(skill.content).toContain("weave artifact current set prd --json");
    expect(skill.content).toContain("artifact: prd");
    expect(skill.content).toContain("Preserve existing artifact lifecycle frontmatter");
    expect(skill.content).toContain("Treat `weave-prd` as entering or resuming the PRD lane for the active change.");
    expect(skill.content).toContain("## 3. PRD Resume Context");
    expect(skill.content).toContain("sessions/*-prd.md");
    expect(skill.content).toContain("Read `prd.md` before session notes. The live artifact is canonical current truth.");
    expect(skill.content).toContain("Use the latest `## Next Resume Point`");
    expect(skill.content).toContain("Loaded prd.md and <N> PRD session note(s).");
    expect(skill.sourcePath).toContain(path.join("templates", "skills", "weave-prd", "SKILL.md"));
    expect(skill.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("ships weave-architect as a canonical architecture generation skill", async () => {
    const skill = await readDefaultSkill("weave-architect");

    expect(skill.name).toBe("weave-architect");
    expect(skill.description).toContain("Generate or revise architecture.md");
    expect(skill.content).toContain("# Plan Mode Guard");
    expect(skill.content).toContain("This skill must run in Plan Mode. Switch to Plan Mode, then invoke weave-architect again.");
    expect(skill.content).toContain("Static Weave skill content cannot automatically switch collaboration mode");
    expect(skill.content).toContain("In Plan Mode, do not write repo-tracked artifacts directly");
    expect(skill.content).toContain("Treat `prd.md` as the primary product contract");
    expect(skill.content).toContain("Interview the user relentlessly about the engineering design");
    expect(skill.content).toContain("Ask questions one at a time and wait for the user's response");
    expect(skill.content).toContain('explicitly offer: "Explain with an example before deciding"');
    expect(skill.content).toContain("restate the original decision question");
    expect(skill.content).toContain("wiki/changes/<change-id>/architecture.md");
    expect(skill.content).toContain("weave artifact current set architecture --json");
    expect(skill.content).toContain("artifact: architecture");
    expect(skill.content).toContain("Preserve existing artifact lifecycle frontmatter");
    expect(skill.content).toContain("Treat `weave-architect` as entering or resuming the architecture lane for the active change.");
    expect(skill.content).toContain("## 3. Architecture Resume Context");
    expect(skill.content).toContain("sessions/*-architecture.md");
    expect(skill.content).toContain("Read `architecture.md` before session notes. The live artifact is canonical current truth.");
    expect(skill.content).toContain("Use the latest `## Next Resume Point`");
    expect(skill.content).toContain("Loaded architecture.md and <N> architecture session note(s).");
    expect(skill.sourcePath).toContain(path.join("templates", "skills", "weave-architect", "SKILL.md"));
    expect(skill.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("ships weave-capture as a structured artifact capture skill", async () => {
    const skill = await readDefaultSkill("weave-capture");

    expect(skill.name).toBe("weave-capture");
    expect(skill.description).toContain("structured session note");
    expect(skill.content).toContain("weave artifact current --json");
    expect(skill.content).toContain("Which artifact should I capture this into: exploration, prd, or architecture?");
    expect(skill.content).toContain("yyyy-mm-dd-<4-char-id>-<artifact>.md");
    expect(skill.content).toContain("Do not copy or store the raw transcript");
    expect(skill.content).toContain("When the live artifact already exists, preserve its template structure and lifecycle frontmatter");
    expect(skill.content).toContain("missing `exploration.md`: create it for the valid active change");
    expect(skill.content).toContain("missing `prd.md`: create it only when a usable `exploration.md` exists");
    expect(skill.content).toContain("missing `architecture.md`: create it only when a usable `prd.md` exists");
    expect(skill.content).toContain("a just-completed Plan Mode `weave-architect` discussion is valid source material");
    expect(skill.content).toContain("Do not create `exploration.md`, `prd.md`, or `architecture.md` without a valid active change, valid target context, and required prerequisite artifact.");
    expect(skill.content).toContain("Captured session: wiki/changes/<change-id>/sessions/<filename>.md");
    expect(skill.sourcePath).toContain(path.join("templates", "skills", "weave-capture", "SKILL.md"));
    expect(skill.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("ships weave-next as a read-only advisory orientation skill", async () => {
    const skill = await readDefaultSkill("weave-next");

    expect(skill.name).toBe("weave-next");
    expect(skill.description).toContain("Answer what to do next");
    expect(skill.content).toContain("`weave-next` is read-only advisory");
    expect(skill.content).not.toContain("# Plan Mode Guard");
    expect(skill.content).toContain("Do not require Plan Mode.");
    expect(skill.content).toContain("Do not write repo-tracked artifacts.");
    expect(skill.content).toContain("Do not set or clear artifact context.");
    expect(skill.content).toContain("Do not invoke or delegate to `weave-explore`, `weave-prd`, `weave-architect`, `weave-issues`, `weave-capture`, or `weave-clarify`.");
    expect(skill.content).toContain("weave change current all --json");
    expect(skill.content).toContain("weave artifact current --json");
    expect(skill.content).toContain("Inspect only workspace targets whose current change matches the active change.");
    expect(skill.content).toContain("read live artifacts first");
    expect(skill.content).toContain("Prefer the latest relevant `## Next Resume Point`");
    expect(skill.content).toContain("Recommended Next Step");
    expect(skill.content).toContain("Alternate Pipeline Step");
    expect(skill.content).toContain("Optional Checkpoint");
    expect(skill.sourcePath).toContain(path.join("templates", "skills", "weave-next", "SKILL.md"));
    expect(skill.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("keeps repo-installed Weave skill copies aligned for artifact capture flow", async () => {
    for (const skill of ["weave-explore", "weave-prd", "weave-architect", "weave-capture", "weave-next"]) {
      const template = await readFile(path.join(process.cwd(), "templates", "skills", skill, "SKILL.md"), "utf8");

      await expect(readFile(path.join(process.cwd(), ".agents", "skills", skill, "SKILL.md"), "utf8")).resolves.toBe(template);
      await expect(readFile(path.join(process.cwd(), ".claude", "skills", skill, "SKILL.md"), "utf8")).resolves.toBe(template);
    }
  });

  it("ships weave-clarify as a canonical clarification skill", async () => {
    const skill = await readDefaultSkill("weave-clarify");

    expect(skill.name).toBe("weave-clarify");
    expect(skill.description).toContain("Clarify and revise one existing Weave change artifact");
    expect(skill.content).toContain("Treat the selected target artifact as the only write target");
    expect(skill.content).toContain("Supported target artifacts");
    expect(skill.content).toContain("Do not edit follow-up artifacts");
    expect(skill.content).toContain("## 3. Target Resume Context");
    expect(skill.content).toContain("Only load session files that match the selected target artifact, newest-first.");
    expect(skill.content).toContain("Read the selected live artifact before session notes. The live artifact is canonical current truth.");
    expect(skill.content).toContain("Use the latest `## Next Resume Point`, unresolved points, user preferences, and agent recommendations as clarification context.");
    expect(skill.content).toContain("Clarified <target>: wiki/changes/<change-id>/<artifact>.md");
    expect(skill.sourcePath).toContain(path.join("templates", "skills", "weave-clarify", "SKILL.md"));
    expect(skill.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("lists default skills with metadata and hashes", async () => {
    const skills = await listDefaultSkills();

    expect(skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "weave-capture",
          description: expect.stringContaining("structured session note"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          name: "weave-new",
          description: expect.stringContaining("Start a new Weave change exploration"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          name: "weave-next",
          description: expect.stringContaining("Answer what to do next"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          name: "weave-issues",
          description: expect.stringContaining("implementation plan"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          name: "weave-explore",
          description: expect.stringContaining("Stress-test product requirements"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          name: "weave-prd",
          description: expect.stringContaining("Generate or revise prd.md"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          name: "weave-architect",
          description: expect.stringContaining("Generate or revise architecture.md"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          name: "weave-clarify",
          description: expect.stringContaining("Clarify and revise one existing Weave change artifact"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          name: "weave-propagate",
          description: expect.stringContaining("Propagate an existing Weave change exploration"),
          hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
      ]),
    );
  });

  it("installs Codex and Cursor skills to .agents/skills", async () => {
    const cwd = await tempDir();

    const codex = await installAgentSkills({ cwd, agent: "codex", now: new Date("2026-05-19T00:00:00.000Z") });
    const cursor = await installAgentSkills({ cwd, agent: "cursor", now: new Date("2026-05-19T00:00:01.000Z") });

    const installed = await readFile(path.join(cwd, ".agents", "skills", "weave-explore", "SKILL.md"), "utf8");
    const manifest = await readManifest(cwd);

    expect(codex.results).toContainEqual(expect.objectContaining({ agent: "codex", kind: "skill", skill: "weave-explore", status: "installed" }));
    expect(codex.results).toContainEqual(expect.objectContaining({ agent: "codex", kind: "skill", skill: "weave-next", status: "installed" }));
    expect(cursor.results).toContainEqual(expect.objectContaining({ agent: "cursor", kind: "skill", skill: "weave-explore", status: "unchanged" }));
    expect(cursor.results).toContainEqual(expect.objectContaining({ agent: "cursor", kind: "skill", skill: "weave-next", status: "unchanged" }));
    expect(installed).toContain("name: weave-explore");
    expect(manifest).toMatchObject({
      version: 1,
      installed: {
        codex: {
          skills: {
            "weave-explore": {
              path: ".agents/skills/weave-explore/SKILL.md",
              installed_at: "2026-05-19T00:00:00.000Z",
            },
            "weave-next": {
              path: ".agents/skills/weave-next/SKILL.md",
              installed_at: "2026-05-19T00:00:00.000Z",
            },
          },
        },
        cursor: {
          skills: {
            "weave-explore": {
              path: ".agents/skills/weave-explore/SKILL.md",
              installed_at: "2026-05-19T00:00:01.000Z",
            },
            "weave-next": {
              path: ".agents/skills/weave-next/SKILL.md",
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

    await expect(stat(path.join(claudeCwd, ".claude", "skills", "weave-explore", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(claudeCwd, ".claude", "skills", "weave-architect", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(claudeCwd, ".claude", "skills", "weave-next", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".agents", "skills", "weave-explore", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".agents", "skills", "weave-architect", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".agents", "skills", "weave-clarify", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".agents", "skills", "weave-next", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".claude", "skills", "weave-explore", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".claude", "skills", "weave-architect", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".claude", "skills", "weave-clarify", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".claude", "skills", "weave-next", "SKILL.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".opencode", "commands", "weave-explore.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".opencode", "commands", "weave-architect.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".opencode", "commands", "weave-clarify.md"))).resolves.toMatchObject({});
    await expect(stat(path.join(allCwd, ".opencode", "commands", "weave-next.md"))).resolves.toMatchObject({});
    expect(manifest).toMatchObject({
      installed: {
        codex: {
          skills: {
            "weave-explore": { path: ".agents/skills/weave-explore/SKILL.md" },
            "weave-architect": { path: ".agents/skills/weave-architect/SKILL.md" },
            "weave-clarify": { path: ".agents/skills/weave-clarify/SKILL.md" },
            "weave-next": { path: ".agents/skills/weave-next/SKILL.md" },
          },
        },
        cursor: {
          skills: {
            "weave-explore": { path: ".agents/skills/weave-explore/SKILL.md" },
            "weave-architect": { path: ".agents/skills/weave-architect/SKILL.md" },
            "weave-clarify": { path: ".agents/skills/weave-clarify/SKILL.md" },
            "weave-next": { path: ".agents/skills/weave-next/SKILL.md" },
          },
        },
        claude: {
          skills: {
            "weave-explore": { path: ".claude/skills/weave-explore/SKILL.md" },
            "weave-architect": { path: ".claude/skills/weave-architect/SKILL.md" },
            "weave-clarify": { path: ".claude/skills/weave-clarify/SKILL.md" },
            "weave-next": { path: ".claude/skills/weave-next/SKILL.md" },
          },
        },
        opencode: {
          skills: {
            "weave-explore": { path: ".agents/skills/weave-explore/SKILL.md" },
            "weave-architect": { path: ".agents/skills/weave-architect/SKILL.md" },
            "weave-clarify": { path: ".agents/skills/weave-clarify/SKILL.md" },
            "weave-next": { path: ".agents/skills/weave-next/SKILL.md" },
          },
          commands: {
            "weave-explore": { path: ".opencode/commands/weave-explore.md" },
            "weave-architect": { path: ".opencode/commands/weave-architect.md" },
            "weave-clarify": { path: ".opencode/commands/weave-clarify.md" },
            "weave-next": { path: ".opencode/commands/weave-next.md" },
          },
        },
      },
    });
  });

  it("does not overwrite a user-modified installed skill during install or update", async () => {
    const cwd = await tempDir();
    const installedPath = path.join(cwd, ".agents", "skills", "weave-explore", "SKILL.md");

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
    const skillDir = path.join(templatesDir, "weave-explore");
    await mkdir(skillDir, { recursive: true });
    await writeFile(skillDir + "/SKILL.md", "---\nname: weave-explore\ndescription: Original\n---\n\nOriginal\n");

    await installAgentSkills({ cwd, agent: "codex", templatesDir });
    await writeFile(skillDir + "/SKILL.md", "---\nname: weave-explore\ndescription: Updated\n---\n\nUpdated\n");

    const update = await updateAgentSkills({ cwd, agent: "codex", templatesDir });
    const installed = await readFile(path.join(cwd, ".agents", "skills", "weave-explore", "SKILL.md"), "utf8");

    expect(update.results).toContainEqual(expect.objectContaining({ status: "updated" }));
    expect(installed).toContain("Updated");
  });

  it("resets modified skills only when explicitly requested", async () => {
    const cwd = await tempDir();
    const installedPath = path.join(cwd, ".agents", "skills", "weave-explore", "SKILL.md");

    await installAgentSkills({ cwd, agent: "codex" });
    await writeFile(installedPath, "custom user edit\n");

    const reset = await resetAgentSkills({ cwd, agent: "codex", skill: "weave-explore" });

    expect(reset.results).toContainEqual(expect.objectContaining({ status: "reset" }));
    await expect(readFile(installedPath, "utf8")).resolves.toContain("name: weave-explore");
  });

  it("shows diffs between installed skills and current defaults", async () => {
    const cwd = await tempDir();
    const installedPath = path.join(cwd, ".agents", "skills", "weave-explore", "SKILL.md");

    await installAgentSkills({ cwd, agent: "codex" });
    await writeFile(installedPath, "custom user edit\n");

    const result = await diffAgentSkills({ cwd, agent: "codex", skill: "weave-explore" });

    expect(result.status).toBe("ok");
    expect(result.message).toContain("--- installed");
    expect(result.message).toContain("+++ default");
    expect(result.message).toContain("-custom user edit");
    expect(result.message).toContain("+---");
  });

  it("installs opencode skill and slash command wrapper", async () => {
    const cwd = await tempDir();

    const install = await installAgentSkills({ cwd, agent: "opencode", now: new Date("2026-05-19T00:00:00.000Z") });
    const exploreSkill = await readFile(path.join(cwd, ".agents", "skills", "weave-explore", "SKILL.md"), "utf8");
    const prdSkill = await readFile(path.join(cwd, ".agents", "skills", "weave-prd", "SKILL.md"), "utf8");
    const architectSkill = await readFile(path.join(cwd, ".agents", "skills", "weave-architect", "SKILL.md"), "utf8");
    const clarifySkill = await readFile(path.join(cwd, ".agents", "skills", "weave-clarify", "SKILL.md"), "utf8");
    const newSkill = await readFile(path.join(cwd, ".agents", "skills", "weave-new", "SKILL.md"), "utf8");
    const issuesSkill = await readFile(path.join(cwd, ".agents", "skills", "weave-issues", "SKILL.md"), "utf8");
    const nextSkill = await readFile(path.join(cwd, ".agents", "skills", "weave-next", "SKILL.md"), "utf8");
    const exploreCommand = await readFile(path.join(cwd, ".opencode", "commands", "weave-explore.md"), "utf8");
    const prdCommand = await readFile(path.join(cwd, ".opencode", "commands", "weave-prd.md"), "utf8");
    const architectCommand = await readFile(path.join(cwd, ".opencode", "commands", "weave-architect.md"), "utf8");
    const clarifyCommand = await readFile(path.join(cwd, ".opencode", "commands", "weave-clarify.md"), "utf8");
    const newCommand = await readFile(path.join(cwd, ".opencode", "commands", "weave-new.md"), "utf8");
    const issuesCommand = await readFile(path.join(cwd, ".opencode", "commands", "weave-issues.md"), "utf8");
    const nextCommand = await readFile(path.join(cwd, ".opencode", "commands", "weave-next.md"), "utf8");
    const manifest = await readManifest(cwd);

    expect(install.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-explore", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-prd", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-architect", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-clarify", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-new", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-issues", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-next", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-explore", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-prd", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-architect", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-clarify", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-new", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-issues", status: "installed" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-next", status: "installed" }),
      ]),
    );
    expect(exploreSkill).toContain("name: weave-explore");
    expect(prdSkill).toContain("name: weave-prd");
    expect(architectSkill).toContain("name: weave-architect");
    expect(clarifySkill).toContain("name: weave-clarify");
    expect(newSkill).toContain("name: weave-new");
    expect(issuesSkill).toContain("name: weave-issues");
    expect(nextSkill).toContain("name: weave-next");
    expect(exploreCommand).toContain("Load and follow the `weave-explore` skill.");
    expect(prdCommand).toContain("Load and follow the `weave-prd` skill.");
    expect(prdCommand).toContain("Context: $ARGUMENTS");
    expect(architectCommand).toContain("Load and follow the `weave-architect` skill.");
    expect(architectCommand).toContain("Context: $ARGUMENTS");
    expect(clarifyCommand).toContain("Load and follow the `weave-clarify` skill.");
    expect(clarifyCommand).toContain("Context: $ARGUMENTS");
    expect(newCommand).toContain("Load and follow the `weave-new` skill.");
    expect(issuesCommand).toContain("Load and follow the `weave-issues` skill.");
    expect(issuesCommand).toContain("Context: $ARGUMENTS");
    expect(nextCommand).toContain("Load and follow the `weave-next` skill.");
    expect(nextCommand).toContain("Context: $ARGUMENTS");
    expect(manifest).toMatchObject({
      installed: {
        opencode: {
          skills: {
            "weave-explore": {
              path: ".agents/skills/weave-explore/SKILL.md",
            },
            "weave-prd": {
              path: ".agents/skills/weave-prd/SKILL.md",
            },
            "weave-architect": {
              path: ".agents/skills/weave-architect/SKILL.md",
            },
            "weave-clarify": {
              path: ".agents/skills/weave-clarify/SKILL.md",
            },
            "weave-new": {
              path: ".agents/skills/weave-new/SKILL.md",
            },
            "weave-issues": {
              path: ".agents/skills/weave-issues/SKILL.md",
            },
            "weave-next": {
              path: ".agents/skills/weave-next/SKILL.md",
            },
          },
          commands: {
            "weave-explore": {
              path: ".opencode/commands/weave-explore.md",
            },
            "weave-prd": {
              path: ".opencode/commands/weave-prd.md",
            },
            "weave-architect": {
              path: ".opencode/commands/weave-architect.md",
            },
            "weave-clarify": {
              path: ".opencode/commands/weave-clarify.md",
            },
            "weave-new": {
              path: ".opencode/commands/weave-new.md",
            },
            "weave-issues": {
              path: ".opencode/commands/weave-issues.md",
            },
            "weave-next": {
              path: ".opencode/commands/weave-next.md",
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
        expect.objectContaining({ agent: "opencode", kind: "skill", skill: "weave-explore", status: "unchanged" }),
        expect.objectContaining({ agent: "opencode", kind: "command", skill: "weave-explore", status: "unchanged" }),
      ]),
    );
    await expect(stat(path.join(cwd, ".opencode", "skills"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not overwrite a user-modified opencode command during install or update", async () => {
    const cwd = await tempDir();
    const commandPath = path.join(cwd, ".opencode", "commands", "weave-explore.md");

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
    const skillDir = path.join(templatesDir, "weave-explore");
    await mkdir(skillDir, { recursive: true });
    await mkdir(commandTemplatesDir, { recursive: true });
    await writeFile(skillDir + "/SKILL.md", "---\nname: weave-explore\ndescription: Original\n---\n\nOriginal\n");
    await writeFile(commandTemplatesDir + "/weave-explore.md", "---\ndescription: Original command\n---\n\nOriginal command\n");

    await installAgentSkills({ cwd, agent: "opencode", templatesDir, commandTemplatesDir });
    await writeFile(commandTemplatesDir + "/weave-explore.md", "---\ndescription: Updated command\n---\n\nUpdated command\n");

    const update = await updateAgentSkills({ cwd, agent: "opencode", templatesDir, commandTemplatesDir });
    const command = await readFile(path.join(cwd, ".opencode", "commands", "weave-explore.md"), "utf8");

    expect(update.results).toContainEqual(expect.objectContaining({ kind: "command", status: "updated" }));
    expect(command).toContain("Updated command");
  });

  it("resets opencode skill and command when explicitly requested", async () => {
    const cwd = await tempDir();
    const skillPath = path.join(cwd, ".agents", "skills", "weave-explore", "SKILL.md");
    const commandPath = path.join(cwd, ".opencode", "commands", "weave-explore.md");

    await installAgentSkills({ cwd, agent: "opencode" });
    await writeFile(skillPath, "custom skill\n");
    await writeFile(commandPath, "custom command\n");

    const reset = await resetAgentSkills({ cwd, agent: "opencode", skill: "weave-explore" });

    expect(reset.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "skill", status: "reset" }),
        expect.objectContaining({ kind: "command", status: "reset" }),
      ]),
    );
    await expect(readFile(skillPath, "utf8")).resolves.toContain("name: weave-explore");
    await expect(readFile(commandPath, "utf8")).resolves.toContain("Topic: $ARGUMENTS");
  });
});
