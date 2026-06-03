import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { installAgentSkills } from "../src/lib/agent-skills.js";
import { detectSkillDrift, gatherNotices, isNewerVersion } from "../src/lib/notices.js";

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "weave-notices-"));
}

describe("notices", () => {
  it("returns an empty array when no drift, no newer npm version, and no env overrides", async () => {
    const cwd = await tempDir();
    await installAgentSkills({ cwd, agent: "claude" });

    const notices = await gatherNotices({
      cwd,
      packageVersion: "0.1.0",
      npmLatest: "0.1.0",
      env: { ...process.env, WEAVE_NO_NOTICES: undefined } as NodeJS.ProcessEnv,
    });

    expect(notices).toEqual([]);
  });

  it("emits a package_outdated notice when npm latest is newer than installed", async () => {
    const cwd = await tempDir();
    await installAgentSkills({ cwd, agent: "claude" });

    const notices = await gatherNotices({
      cwd,
      packageVersion: "0.1.0",
      npmLatest: "0.2.0",
    });

    const outdated = notices.find((notice) => notice.kind === "package_outdated");
    expect(outdated).toBeDefined();
    expect(outdated?.details).toMatchObject({ installed: "0.1.0", latest: "0.2.0" });
  });

  it("does not emit a package_outdated notice when npm latest is older or equal", async () => {
    const cwd = await tempDir();
    await installAgentSkills({ cwd, agent: "claude" });

    const equal = await gatherNotices({ cwd, packageVersion: "0.2.0", npmLatest: "0.2.0" });
    const older = await gatherNotices({ cwd, packageVersion: "0.2.0", npmLatest: "0.1.5" });

    expect(equal.find((notice) => notice.kind === "package_outdated")).toBeUndefined();
    expect(older.find((notice) => notice.kind === "package_outdated")).toBeUndefined();
  });

  it("emits a skills_modified notice when an installed skill file is edited locally", async () => {
    const cwd = await tempDir();
    await installAgentSkills({ cwd, agent: "claude" });
    const installedPath = path.join(cwd, ".claude", "skills", "weave-explore", "SKILL.md");
    await writeFile(installedPath, "custom user edit\n");

    const notices = await gatherNotices({
      cwd,
      packageVersion: "0.1.0",
      npmLatest: "0.1.0",
    });
    const modified = notices.find((notice) => notice.kind === "skills_modified");

    expect(modified).toBeDefined();
    expect(modified?.details).toMatchObject({
      skills: expect.arrayContaining([
        expect.objectContaining({ agent: "claude", name: "weave-explore" }),
      ]),
    });
  });

  it("emits a skills_outdated notice when the bundled last_changed_in differs from installed_from", async () => {
    const cwd = await tempDir();
    const templatesDir = path.join(cwd, "templates", "skills");
    const skillDir = path.join(templatesDir, "weave-explore");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: weave-explore\ndescription: First\nlast_changed_in: 0.1.0\n---\n\nFirst\n",
    );

    await installAgentSkills({ cwd, agent: "claude", templatesDir });

    await writeFile(
      path.join(skillDir, "SKILL.md"),
      "---\nname: weave-explore\ndescription: First\nlast_changed_in: 0.2.0\n---\n\nFirst\n",
    );

    const installedPath = path.join(cwd, ".claude", "skills", "weave-explore", "SKILL.md");
    await writeFile(
      installedPath,
      "---\nname: weave-explore\ndescription: First\nlast_changed_in: 0.1.0\n---\n\nFirst\n",
    );

    const notices = await gatherNotices({
      cwd,
      packageVersion: "0.2.0",
      npmLatest: "0.2.0",
      templatesDir,
    });
    const outdated = notices.find((notice) => notice.kind === "skills_outdated");

    expect(outdated).toBeDefined();
    expect(outdated?.details).toMatchObject({
      skills: expect.arrayContaining([
        expect.objectContaining({
          agent: "claude",
          name: "weave-explore",
          installed_from: "0.1.0",
          current: "0.2.0",
        }),
      ]),
    });
  });

  it("returns an empty array when WEAVE_NO_NOTICES=1 even with drift present", async () => {
    const cwd = await tempDir();
    await installAgentSkills({ cwd, agent: "claude" });
    await writeFile(path.join(cwd, ".claude", "skills", "weave-explore", "SKILL.md"), "custom\n");

    const notices = await gatherNotices({
      cwd,
      packageVersion: "0.1.0",
      npmLatest: "9.9.9",
      env: { WEAVE_NO_NOTICES: "1" } as NodeJS.ProcessEnv,
    });

    expect(notices).toEqual([]);
  });

  it("detectSkillDrift surfaces both modified and outdated lanes separately", async () => {
    const cwd = await tempDir();
    const templatesDir = path.join(cwd, "templates", "skills");
    const exploreDir = path.join(templatesDir, "weave-explore");
    const captureDir = path.join(templatesDir, "weave-capture");
    await mkdir(exploreDir, { recursive: true });
    await mkdir(captureDir, { recursive: true });
    await writeFile(
      path.join(exploreDir, "SKILL.md"),
      "---\nname: weave-explore\ndescription: Explore\nlast_changed_in: 0.1.0\n---\n\nExplore\n",
    );
    await writeFile(
      path.join(captureDir, "SKILL.md"),
      "---\nname: weave-capture\ndescription: Capture\nlast_changed_in: 0.1.0\n---\n\nCapture\n",
    );

    await installAgentSkills({ cwd, agent: "claude", templatesDir });

    await writeFile(
      path.join(captureDir, "SKILL.md"),
      "---\nname: weave-capture\ndescription: Capture\nlast_changed_in: 0.2.0\n---\n\nCapture\n",
    );
    await writeFile(path.join(cwd, ".claude", "skills", "weave-explore", "SKILL.md"), "custom\n");

    const drift = await detectSkillDrift({ cwd, templatesDir });

    expect(drift.modified.map((entry) => entry.name)).toEqual(["weave-explore"]);
    expect(drift.outdated.map((entry) => entry.name)).toEqual(["weave-capture"]);
  });

  it("isNewerVersion compares semver-shaped strings predictably", () => {
    expect(isNewerVersion("0.2.0", "0.1.0")).toBe(true);
    expect(isNewerVersion("1.0.0", "0.9.9")).toBe(true);
    expect(isNewerVersion("0.1.0", "0.1.0")).toBe(false);
    expect(isNewerVersion("0.1.0", "0.2.0")).toBe(false);
    expect(isNewerVersion("garbage", "0.1.0")).toBe(false);
  });
});
