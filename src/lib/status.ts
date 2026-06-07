import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { type AgentName, listDefaultSkills, loadAgentsManifest } from "./agent-skills.js";
import { pathExists } from "./files.js";
import { gatherNotices, type Notice } from "./notices.js";
import { getNpmVersionInfo } from "./npm-version.js";

const agentOrder: AgentName[] = ["claude", "codex", "cursor", "opencode"];

export interface StatusSkillRow {
  agent: AgentName;
  name: string;
  installed_from: string | null;
  current: string;
  state: "current" | "outdated" | "modified" | "missing";
}

export interface StatusResult {
  status: "ok";
  packageVersion: string;
  cwd: string;
  inRepo: boolean;
  skills: StatusSkillRow[];
  notices: Notice[];
  message: string;
}

export interface BuildStatusOptions {
  cwd: string;
  packageVersion?: string;
  npmLatest?: string | null;
  templatesDir?: string;
  env?: NodeJS.ProcessEnv;
}

export async function buildStatus(options: BuildStatusOptions): Promise<StatusResult> {
  const packageVersion = options.packageVersion ?? (await readPackageVersion());
  const inRepo = await pathExists(join(options.cwd, ".weave", "agents.yml"));
  const skills = inRepo ? await collectSkillRows(options) : [];
  const npmLatest =
    options.npmLatest === undefined
      ? (await getNpmVersionInfo({ packageVersion, env: options.env })).cachedLatest
      : options.npmLatest;
  const notices = await gatherNotices({
    cwd: options.cwd,
    packageVersion,
    npmLatest: npmLatest ?? null,
    templatesDir: options.templatesDir,
    env: options.env,
  });

  return {
    status: "ok",
    packageVersion,
    cwd: options.cwd,
    inRepo,
    skills,
    notices,
    message: renderStatusMessage({
      packageVersion,
      cwd: options.cwd,
      inRepo,
      skills,
      notices,
      npmLatest: npmLatest ?? null,
    }),
  };
}

export async function collectSkillRows(options: BuildStatusOptions): Promise<StatusSkillRow[]> {
  const manifest = await loadAgentsManifest(options.cwd);
  const templates = await listDefaultSkills({ templatesDir: options.templatesDir }).catch(() => []);
  const templatesByName = new Map(templates.map((skill) => [skill.name, skill]));

  const rows: StatusSkillRow[] = [];

  for (const agent of agentOrder) {
    const buckets = manifest.installed[agent];
    if (!buckets) continue;
    const skills = buckets.skills ?? {};
    for (const [name, entry] of Object.entries(skills)) {
      const template = templatesByName.get(name);
      const current = template?.lastChangedIn ?? "unknown";
      const absolutePath = join(options.cwd, entry.path);
      const fileExists = await pathExists(absolutePath);

      let state: StatusSkillRow["state"] = "current";
      if (!fileExists) {
        state = "missing";
      } else {
        const diskContent = await readFile(absolutePath, "utf8").catch(() => "");
        const diskHash = `sha256:${createHash("sha256").update(diskContent).digest("hex")}`;
        if (diskHash !== entry.installed_hash) {
          state = "modified";
        } else if (template && entry.installed_from !== template.lastChangedIn) {
          state = "outdated";
        }
      }

      rows.push({
        agent,
        name,
        installed_from: entry.installed_from,
        current,
        state,
      });
    }
  }

  return rows;
}

function renderStatusMessage(opts: {
  packageVersion: string;
  cwd: string;
  inRepo: boolean;
  skills: StatusSkillRow[];
  notices: Notice[];
  npmLatest: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`weave-it ${opts.packageVersion}`);
  lines.push(`cwd: ${opts.cwd}`);
  if (opts.npmLatest) {
    lines.push(`npm latest (cached): ${opts.npmLatest}`);
  } else {
    lines.push(`npm latest (cached): unknown`);
  }

  if (!opts.inRepo) {
    lines.push("");
    lines.push("Not inside a Weave-managed repo (no .weave/agents.yml).");
  } else if (opts.skills.length === 0) {
    lines.push("");
    lines.push("No skills installed.");
  } else {
    lines.push("");
    lines.push("Installed skills:");
    const header = ["agent", "skill", "state", "installed_from", "current"];
    const rows = opts.skills.map((row) => [
      row.agent,
      row.name,
      row.state,
      row.installed_from ?? "unknown",
      row.current,
    ]);
    const widths = header.map((cell, index) =>
      Math.max(cell.length, ...rows.map((row) => row[index].length)),
    );
    const renderRow = (cells: string[]) =>
      cells.map((cell, index) => cell.padEnd(widths[index])).join("  ").trimEnd();
    lines.push(renderRow(header));
    lines.push(widths.map((width) => "-".repeat(width)).join("  ").trimEnd());
    for (const row of rows) {
      lines.push(renderRow(row));
    }
  }

  lines.push("");
  if (opts.notices.length === 0) {
    lines.push("Notices: none.");
  } else {
    lines.push(`Notices (${opts.notices.length}):`);
    for (const notice of opts.notices) {
      lines.push(`- [${notice.kind}] ${notice.message}`);
    }
  }

  return lines.join("\n");
}

async function readPackageVersion(): Promise<string> {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  let current = moduleDir;
  while (true) {
    const candidate = join(current, "package.json");
    if (await pathExists(candidate)) {
      try {
        const parsed = JSON.parse(await readFile(candidate, "utf8")) as { version?: string };
        if (typeof parsed?.version === "string") {
          return parsed.version;
        }
      } catch {
        // ignore malformed package.json and keep walking up
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return "0.0.0";
}
