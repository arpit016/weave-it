import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AgentName,
  type AgentsManifest,
  type DefaultSkill,
  listDefaultSkills,
  loadAgentsManifest,
} from "./agent-skills.js";

export type NoticeKind = "package_outdated" | "skills_outdated" | "skills_modified";

export interface NoticeSkillRef {
  agent: AgentName;
  name: string;
  kind: "skill" | "command";
}

export interface OutdatedSkillRef extends NoticeSkillRef {
  installed_from: string | null;
  current: string;
}

export interface Notice {
  kind: NoticeKind;
  message: string;
  details?: Record<string, unknown>;
}

export interface GatherNoticesOptions {
  cwd: string;
  packageVersion: string;
  npmLatest?: string | null;
  templatesDir?: string;
  env?: NodeJS.ProcessEnv;
}

export async function gatherNotices(options: GatherNoticesOptions): Promise<Notice[]> {
  const env = options.env ?? process.env;
  if (env.WEAVE_NO_NOTICES === "1") {
    return [];
  }

  const notices: Notice[] = [];

  if (options.npmLatest && isNewerVersion(options.npmLatest, options.packageVersion)) {
    notices.push({
      kind: "package_outdated",
      message: `weave-it ${options.npmLatest} is available (installed ${options.packageVersion}). Run 'weave status' for details.`,
      details: {
        installed: options.packageVersion,
        latest: options.npmLatest,
      },
    });
  }

  const drift = await detectSkillDrift({
    cwd: options.cwd,
    templatesDir: options.templatesDir,
  });

  if (drift.modified.length > 0) {
    notices.push({
      kind: "skills_modified",
      message: `${drift.modified.length} installed skill file(s) have been modified locally. Run 'weave status' for details.`,
      details: { skills: drift.modified },
    });
  }

  if (drift.outdated.length > 0) {
    notices.push({
      kind: "skills_outdated",
      message: `${drift.outdated.length} installed skill file(s) are out of date. Run 'weave agent update --all' or 'weave status' for details.`,
      details: { skills: drift.outdated },
    });
  }

  return notices;
}

export interface SkillDrift {
  modified: NoticeSkillRef[];
  outdated: OutdatedSkillRef[];
}

export async function detectSkillDrift(options: {
  cwd: string;
  templatesDir?: string;
}): Promise<SkillDrift> {
  const manifest = await loadAgentsManifest(options.cwd);
  const templates = await safeListDefaultSkills(options.templatesDir);
  const templatesByName = new Map(templates.map((skill) => [skill.name, skill]));

  const modified: NoticeSkillRef[] = [];
  const outdated: OutdatedSkillRef[] = [];

  for (const [agentKey, buckets] of Object.entries(manifest.installed) as [
    AgentName,
    AgentsManifest["installed"][AgentName],
  ][]) {
    if (!buckets) continue;
    const skillEntries = buckets.skills ?? {};
    for (const [name, entry] of Object.entries(skillEntries)) {
      const absolutePath = join(options.cwd, entry.path);
      const diskHash = await safeHashFile(absolutePath);
      if (diskHash === null) {
        continue;
      }

      if (diskHash !== entry.installed_hash) {
        modified.push({ agent: agentKey, name, kind: "skill" });
        continue;
      }

      const template = templatesByName.get(name);
      if (!template) continue;

      if (entry.installed_from !== template.lastChangedIn) {
        outdated.push({
          agent: agentKey,
          name,
          kind: "skill",
          installed_from: entry.installed_from,
          current: template.lastChangedIn,
        });
      }
    }
  }

  modified.sort(compareSkillRefs);
  outdated.sort(compareSkillRefs);

  return { modified, outdated };
}

async function safeListDefaultSkills(templatesDir?: string): Promise<DefaultSkill[]> {
  try {
    return await listDefaultSkills({ templatesDir });
  } catch {
    return [];
  }
}

async function safeHashFile(path: string): Promise<string | null> {
  try {
    const content = await readFile(path, "utf8");
    return `sha256:${createHash("sha256").update(content).digest("hex")}`;
  } catch {
    return null;
  }
}

function compareSkillRefs(left: NoticeSkillRef, right: NoticeSkillRef): number {
  const agentCompare = left.agent.localeCompare(right.agent);
  if (agentCompare !== 0) return agentCompare;
  return left.name.localeCompare(right.name);
}

export function isNewerVersion(candidate: string, baseline: string): boolean {
  const parsedCandidate = parseSemver(candidate);
  const parsedBaseline = parseSemver(baseline);
  if (!parsedCandidate || !parsedBaseline) {
    return false;
  }
  for (let index = 0; index < 3; index++) {
    if (parsedCandidate[index] > parsedBaseline[index]) return true;
    if (parsedCandidate[index] < parsedBaseline[index]) return false;
  }
  return false;
}

function parseSemver(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
