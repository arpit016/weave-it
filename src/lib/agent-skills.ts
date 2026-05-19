import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { ensureDir, pathExists, writeFileAtomic } from "./files.js";

export type AgentName = "codex" | "cursor" | "claude";
export type AgentSelection = AgentName | "all";
export type SkillOperationStatus = "installed" | "unchanged" | "modified" | "updated" | "reset" | "missing";

export interface DefaultSkill {
  name: string;
  description: string;
  sourcePath: string;
  content: string;
  hash: string;
}

export interface SkillOperationResult {
  agent: AgentName;
  skill: string;
  path: string;
  status: SkillOperationStatus;
  message: string;
}

export interface SkillOperationSummary {
  status: "ok";
  message: string;
  results: SkillOperationResult[];
}

interface AgentSkillOptions {
  cwd: string;
  agent: AgentSelection;
  templatesDir?: string;
  now?: Date;
}

interface ResetAgentSkillOptions extends AgentSkillOptions {
  skill?: string;
}

interface DiffAgentSkillOptions extends AgentSkillOptions {
  skill?: string;
}

interface ManifestEntry {
  path: string;
  source_hash: string;
  installed_hash: string;
  installed_at: string;
}

interface AgentsManifest {
  version: 1;
  installed: Partial<Record<AgentName, Record<string, ManifestEntry>>>;
}

interface ConcreteTarget {
  agent: AgentName;
  skillsDir: string;
}

const manifestRelativePath = join("weave", "agents.yml");

export async function listDefaultSkills(options: { templatesDir?: string } = {}): Promise<DefaultSkill[]> {
  const templatesDir = options.templatesDir ?? (await findDefaultTemplatesDir());
  const entries = await readdir(templatesDir, { withFileTypes: true });
  const skills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => readDefaultSkill(entry.name, { templatesDir })),
  );

  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

export async function readDefaultSkill(
  name: string,
  options: { templatesDir?: string } = {},
): Promise<DefaultSkill> {
  validateSkillName(name);

  const templatesDir = options.templatesDir ?? (await findDefaultTemplatesDir());
  const sourcePath = join(templatesDir, name, "SKILL.md");
  const content = await readFile(sourcePath, "utf8").catch((error: unknown) => {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Unknown skill: ${name}`);
    }

    throw error;
  });
  const metadata = parseSkillFrontmatter(content, sourcePath);

  if (metadata.name !== name) {
    throw new Error(`Skill frontmatter name mismatch in ${sourcePath}: expected ${name}, got ${metadata.name}`);
  }

  return {
    name: metadata.name,
    description: metadata.description,
    sourcePath,
    content,
    hash: hashContent(content),
  };
}

export async function installAgentSkills(options: AgentSkillOptions): Promise<SkillOperationSummary> {
  const manifest = await loadAgentsManifest(options.cwd);
  const skills = await listDefaultSkills({ templatesDir: options.templatesDir });
  const results: SkillOperationResult[] = [];

  for (const target of resolveAgentTargets(options.cwd, options.agent)) {
    for (const skill of skills) {
      results.push(await installSkill(options.cwd, target, skill, manifest, options.now ?? new Date()));
    }
  }

  await saveAgentsManifest(options.cwd, manifest);

  return summarize(results);
}

export async function updateAgentSkills(options: AgentSkillOptions): Promise<SkillOperationSummary> {
  const manifest = await loadAgentsManifest(options.cwd);
  const skills = await listDefaultSkills({ templatesDir: options.templatesDir });
  const results: SkillOperationResult[] = [];

  for (const target of resolveAgentTargets(options.cwd, options.agent)) {
    for (const skill of skills) {
      results.push(await updateSkill(options.cwd, target, skill, manifest, options.now ?? new Date()));
    }
  }

  await saveAgentsManifest(options.cwd, manifest);

  return summarize(results);
}

export async function resetAgentSkills(options: ResetAgentSkillOptions): Promise<SkillOperationSummary> {
  const manifest = await loadAgentsManifest(options.cwd);
  const skills = options.skill
    ? [await readDefaultSkill(options.skill, { templatesDir: options.templatesDir })]
    : await listDefaultSkills({ templatesDir: options.templatesDir });
  const results: SkillOperationResult[] = [];

  for (const target of resolveAgentTargets(options.cwd, options.agent)) {
    for (const skill of skills) {
      results.push(await resetSkill(options.cwd, target, skill, manifest, options.now ?? new Date()));
    }
  }

  await saveAgentsManifest(options.cwd, manifest);

  return summarize(results);
}

export async function diffAgentSkills(options: DiffAgentSkillOptions): Promise<{ status: "ok"; message: string }> {
  const skills = options.skill
    ? [await readDefaultSkill(options.skill, { templatesDir: options.templatesDir })]
    : await listDefaultSkills({ templatesDir: options.templatesDir });
  const chunks: string[] = [];

  for (const target of resolveAgentTargets(options.cwd, options.agent)) {
    for (const skill of skills) {
      const installedPath = installedSkillPath(target.skillsDir, skill.name);
      if (!(await pathExists(installedPath))) {
        chunks.push(`Missing ${target.agent}/${skill.name} at ${relative(options.cwd, installedPath)}`);
        continue;
      }

      const installed = await readFile(installedPath, "utf8");
      chunks.push(formatFullFileDiff(relative(options.cwd, installedPath), skill.name, installed, skill.content));
    }
  }

  return {
    status: "ok",
    message: chunks.join("\n"),
  };
}

async function installSkill(
  cwd: string,
  target: ConcreteTarget,
  skill: DefaultSkill,
  manifest: AgentsManifest,
  now: Date,
): Promise<SkillOperationResult> {
  const destination = installedSkillPath(target.skillsDir, skill.name);
  const relativePath = relative(cwd, destination);
  await ensureDir(dirname(destination));

  if (!(await pathExists(destination))) {
    await writeFile(destination, skill.content);
    setManifestEntry(manifest, target.agent, skill, relativePath, now);
    return result(target.agent, skill.name, relativePath, "installed", `Installed ${skill.name} for ${target.agent}`);
  }

  const currentHash = hashContent(await readFile(destination, "utf8"));
  const entry = manifest.installed[target.agent]?.[skill.name];
  if (entry && currentHash !== entry.installed_hash) {
    return result(target.agent, skill.name, relativePath, "modified", `Skipped modified ${skill.name} for ${target.agent}`);
  }

  if (!entry && currentHash !== skill.hash) {
    return result(target.agent, skill.name, relativePath, "modified", `Skipped existing ${skill.name} for ${target.agent}`);
  }

  if (entry && currentHash === entry.installed_hash && currentHash !== skill.hash) {
    await writeFile(destination, skill.content);
    setManifestEntry(manifest, target.agent, skill, relativePath, now);
    return result(target.agent, skill.name, relativePath, "updated", `Updated ${skill.name} for ${target.agent}`);
  }

  setManifestEntry(manifest, target.agent, skill, relativePath, now);
  return result(target.agent, skill.name, relativePath, "unchanged", `${skill.name} already installed for ${target.agent}`);
}

async function updateSkill(
  cwd: string,
  target: ConcreteTarget,
  skill: DefaultSkill,
  manifest: AgentsManifest,
  now: Date,
): Promise<SkillOperationResult> {
  const destination = installedSkillPath(target.skillsDir, skill.name);
  const relativePath = relative(cwd, destination);

  if (!(await pathExists(destination))) {
    return result(target.agent, skill.name, relativePath, "missing", `Missing ${skill.name} for ${target.agent}`);
  }

  const currentHash = hashContent(await readFile(destination, "utf8"));
  const entry = manifest.installed[target.agent]?.[skill.name];
  if (!entry || currentHash !== entry.installed_hash) {
    return result(target.agent, skill.name, relativePath, "modified", `Skipped modified ${skill.name} for ${target.agent}`);
  }

  if (currentHash === skill.hash) {
    setManifestEntry(manifest, target.agent, skill, relativePath, now);
    return result(target.agent, skill.name, relativePath, "unchanged", `${skill.name} already up to date for ${target.agent}`);
  }

  await writeFile(destination, skill.content);
  setManifestEntry(manifest, target.agent, skill, relativePath, now);
  return result(target.agent, skill.name, relativePath, "updated", `Updated ${skill.name} for ${target.agent}`);
}

async function resetSkill(
  cwd: string,
  target: ConcreteTarget,
  skill: DefaultSkill,
  manifest: AgentsManifest,
  now: Date,
): Promise<SkillOperationResult> {
  const destination = installedSkillPath(target.skillsDir, skill.name);
  const relativePath = relative(cwd, destination);

  await ensureDir(dirname(destination));
  await writeFile(destination, skill.content);
  setManifestEntry(manifest, target.agent, skill, relativePath, now);

  return result(target.agent, skill.name, relativePath, "reset", `Reset ${skill.name} for ${target.agent}`);
}

function setManifestEntry(
  manifest: AgentsManifest,
  agent: AgentName,
  skill: DefaultSkill,
  relativePath: string,
  now: Date,
): void {
  manifest.installed[agent] ??= {};
  manifest.installed[agent][skill.name] = {
    path: relativePath,
    source_hash: skill.hash,
    installed_hash: skill.hash,
    installed_at: now.toISOString(),
  };
}

function resolveAgentTargets(cwd: string, agent: AgentSelection): ConcreteTarget[] {
  switch (agent) {
    case "codex":
      return [{ agent, skillsDir: join(cwd, ".agents", "skills") }];
    case "cursor":
      return [{ agent, skillsDir: join(cwd, ".agents", "skills") }];
    case "claude":
      return [{ agent, skillsDir: join(cwd, ".claude", "skills") }];
    case "all":
      return [
        { agent: "codex", skillsDir: join(cwd, ".agents", "skills") },
        { agent: "claude", skillsDir: join(cwd, ".claude", "skills") },
      ];
    default:
      throw new Error(`Unsupported agent: ${agent satisfies never}`);
  }
}

function installedSkillPath(skillsDir: string, skillName: string): string {
  return join(skillsDir, skillName, "SKILL.md");
}

async function loadAgentsManifest(cwd: string): Promise<AgentsManifest> {
  const manifestPath = join(cwd, manifestRelativePath);

  if (!(await pathExists(manifestPath))) {
    return { version: 1, installed: {} };
  }

  const parsed = YAML.parse(await readFile(manifestPath, "utf8")) as Partial<AgentsManifest> | null;

  return {
    version: 1,
    installed: parsed?.installed ?? {},
  };
}

async function saveAgentsManifest(cwd: string, manifest: AgentsManifest): Promise<void> {
  const manifestPath = join(cwd, manifestRelativePath);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFileAtomic(manifestPath, YAML.stringify(manifest));
}

function parseSkillFrontmatter(content: string, sourcePath: string): { name: string; description: string } {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) {
    throw new Error(`Missing frontmatter in ${sourcePath}`);
  }

  const metadata = YAML.parse(match[1]) as Partial<{ name: string; description: string }>;
  if (!metadata.name || !metadata.description) {
    throw new Error(`Skill frontmatter in ${sourcePath} must include name and description`);
  }

  return {
    name: metadata.name,
    description: metadata.description,
  };
}

function formatFullFileDiff(installedPath: string, skillName: string, installed: string, currentDefault: string): string {
  if (installed === currentDefault) {
    return `No differences for ${installedPath}`;
  }

  const installedLines = splitLines(installed);
  const defaultLines = splitLines(currentDefault);

  return [
    `--- installed:${installedPath}`,
    `+++ default:${skillName}`,
    ...installedLines.map((line) => `-${line}`),
    ...defaultLines.map((line) => `+${line}`),
  ].join("\n");
}

function splitLines(value: string): string[] {
  return value.endsWith("\n") ? value.slice(0, -1).split("\n") : value.split("\n");
}

function result(
  agent: AgentName,
  skill: string,
  path: string,
  status: SkillOperationStatus,
  message: string,
): SkillOperationResult {
  return { agent, skill, path, status, message };
}

function summarize(results: SkillOperationResult[]): SkillOperationSummary {
  return {
    status: "ok",
    message: results.map((item) => item.message).join("\n"),
    results,
  };
}

function hashContent(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function findDefaultTemplatesDir(): Promise<string> {
  let current = dirname(fileURLToPath(import.meta.url));

  while (true) {
    const candidate = join(current, "templates", "skills");
    try {
      await access(candidate, constants.R_OK);
      return candidate;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        throw new Error("Could not locate templates/skills");
      }

      current = parent;
    }
  }
}

function validateSkillName(name: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`Invalid skill name: ${name}`);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
