import path from "node:path";
import { currentBranch } from "./git.js";
import { ensureWeaveScaffold } from "./weave-scaffold.js";
import { pathExists } from "./files.js";
import { collectSkillRows, type StatusSkillRow } from "./status.js";
import { findWorkspaceMode, type FindWorkspaceModeResult } from "./workspace-mode.js";

export type DoctorStatus = "ok" | "warning" | "error";
export type DoctorCheckStatus = "ok" | "warning" | "error";

export interface DoctorCheck {
  id: string;
  status: DoctorCheckStatus;
  message: string;
  fixable: boolean;
  files?: string[];
  details?: string[];
}

export interface DoctorResult {
  status: DoctorStatus;
  cwd: string;
  mode: FindWorkspaceModeResult["mode"] | null;
  root: string | null;
  activeChange: {
    id: string;
    branch: string;
    branchMatch: boolean | null;
    currentBranch: string | null;
  } | null;
  checks: DoctorCheck[];
  changed: string[];
  message: string;
}

export interface BuildDoctorOptions {
  cwd: string;
  fix?: boolean;
  sessionPath?: string;
  templatesDir?: string;
}

const safeScaffoldFiles = [
  ".weave/sync.yml",
  ".weave/architecture-considerations.md",
  "wiki/knowledge/index.md",
  "wiki/knowledge/README.md",
  "wiki/knowledge/domains/README.md",
  "wiki/knowledge/shared/README.md",
];

const safeScaffoldDirs = [
  "wiki/changes",
  "wiki/knowledge/domains",
  "wiki/knowledge/shared",
  ".weave",
];

export async function buildDoctor(options: BuildDoctorOptions): Promise<DoctorResult> {
  const cwd = options.cwd;
  const fix = options.fix ?? false;
  const workspace = await findWorkspaceMode(cwd);
  const checks: DoctorCheck[] = [];
  let changed: string[] = [];
  let activeChange: DoctorResult["activeChange"] = null;
  let skills: StatusSkillRow[] = [];

  if (!workspace) {
    checks.push({
      id: "weave_context",
      status: "error",
      message: "No readable Weave metadata found. Run `weave init` first.",
      fixable: false,
    });

    return renderResult({ cwd, workspace: null, activeChange, checks, changed });
  }

  checks.push({
    id: "weave_context",
    status: "ok",
    message: `Weave metadata found: ${path.relative(workspace.workspacePath, workspace.workspaceYmlPath)}`,
    fixable: false,
  });

  const missingScaffold = await missingSafeScaffold(workspace.workspacePath);
  if (fix && missingScaffold.length > 0) {
    const scaffold = await ensureWeaveScaffold({ folder: { path: workspace.workspacePath } });
    changed = scaffold.created;
  }

  const remainingMissingScaffold = await missingSafeScaffold(workspace.workspacePath);
  if (remainingMissingScaffold.length > 0) {
    checks.push({
      id: "safe_scaffold",
      status: "warning",
      message: "Missing safe scaffold files.",
      fixable: true,
      files: remainingMissingScaffold,
      details: ["Fix: weave doctor --fix"],
    });
  } else {
    checks.push({
      id: "safe_scaffold",
      status: "ok",
      message: "Safe scaffold files found.",
      fixable: false,
    });
  }

  const missingDirs = await missingSafeDirs(workspace.workspacePath);
  if (missingDirs.length > 0) {
    checks.push({
      id: "safe_scaffold_dirs",
      status: "warning",
      message: "Missing safe scaffold directories.",
      fixable: true,
      files: missingDirs,
      details: ["Fix: weave doctor --fix"],
    });
  } else {
    checks.push({
      id: "safe_scaffold_dirs",
      status: "ok",
      message: "Safe scaffold directories found.",
      fixable: false,
    });
  }

  if (await pathExists(path.join(workspace.workspacePath, ".weave", "agents.yml"))) {
    skills = await collectSkillRows({
      cwd: workspace.workspacePath,
      templatesDir: options.templatesDir,
    }).catch(() => []);
    const drift = skills.filter((row) => row.state !== "current");
    if (drift.length > 0) {
      checks.push({
        id: "skill_drift",
        status: "warning",
        message: "Installed skills differ from bundled templates.",
        fixable: false,
        details: drift.map((row) => `${row.agent}/${row.name}: ${row.state}`),
      });
    } else {
      checks.push({
        id: "skill_drift",
        status: "ok",
        message: skills.length > 0 ? "Installed skills are current." : "No installed skills found.",
        fixable: false,
      });
    }
  } else {
    checks.push({
      id: "skill_drift",
      status: "ok",
      message: "No installed skill manifest found.",
      fixable: false,
    });
  }

  activeChange = await readActiveChange(workspace.workspacePath);
  if (activeChange) {
    checks.push({
      id: "active_change",
      status: activeChange.branchMatch === false ? "warning" : "ok",
      message:
        activeChange.branchMatch === false
          ? `Active change branch mismatch: expected ${activeChange.branch}, current ${activeChange.currentBranch ?? "unknown"}.`
          : `Active change found: ${activeChange.id}.`,
      fixable: false,
    });
  } else {
    checks.push({
      id: "active_change",
      status: "warning",
      message: "No active change found for this context.",
      fixable: false,
    });
  }

  return renderResult({ cwd, workspace, activeChange, checks, changed });
}

async function missingSafeScaffold(root: string): Promise<string[]> {
  const missing: string[] = [];
  for (const file of safeScaffoldFiles) {
    if (!(await pathExists(path.join(root, file)))) {
      missing.push(file);
    }
  }
  return missing;
}

async function missingSafeDirs(root: string): Promise<string[]> {
  const missing: string[] = [];
  for (const dir of safeScaffoldDirs) {
    if (!(await pathExists(path.join(root, dir)))) {
      missing.push(dir);
    }
  }
  return missing;
}

async function readActiveChange(root: string): Promise<DoctorResult["activeChange"]> {
  try {
    const branch = (await currentBranch(root)) ?? null;
    if (!branch?.startsWith("change/")) return null;
    const id = branch.slice("change/".length);
    const changePath = path.join(root, "wiki", "changes", id, "status.yml");
    if (!(await pathExists(changePath))) return null;
    return {
      id,
      branch,
      branchMatch: true,
      currentBranch: branch,
    };
  } catch {
    return null;
  }
}

function renderResult(input: {
  cwd: string;
  workspace: FindWorkspaceModeResult | null;
  activeChange: DoctorResult["activeChange"];
  checks: DoctorCheck[];
  changed: string[];
}): DoctorResult {
  const status = overallStatus(input.checks);
  return {
    status,
    cwd: input.cwd,
    mode: input.workspace?.mode ?? null,
    root: input.workspace?.workspacePath ?? null,
    activeChange: input.activeChange,
    checks: input.checks,
    changed: input.changed,
    message: renderDoctorMessage({
      status,
      cwd: input.cwd,
      workspace: input.workspace,
      activeChange: input.activeChange,
      checks: input.checks,
      changed: input.changed,
    }),
  };
}

function overallStatus(checks: DoctorCheck[]): DoctorStatus {
  if (checks.some((check) => check.status === "error")) return "error";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "ok";
}

function renderDoctorMessage(input: {
  status: DoctorStatus;
  cwd: string;
  workspace: FindWorkspaceModeResult | null;
  activeChange: DoctorResult["activeChange"];
  checks: DoctorCheck[];
  changed: string[];
}): string {
  const lines: string[] = [];
  lines.push("Weave Doctor");
  lines.push("");
  lines.push("Context");
  lines.push(`- Cwd: ${input.cwd}`);
  lines.push(`- Root: ${input.workspace?.workspacePath ?? "unknown"}`);
  lines.push(`- Mode: ${input.workspace?.mode ?? "unknown"}`);
  lines.push(`- Active change: ${input.activeChange?.id ?? "none"}`);
  lines.push(`- Branch: ${input.activeChange?.currentBranch ?? "unknown"}`);
  lines.push("");
  lines.push("Checks");
  for (const check of input.checks) {
    lines.push(`${statusPrefix(check.status)} ${check.message}`);
    for (const file of check.files ?? []) {
      lines.push(`  - ${file}`);
    }
    for (const detail of check.details ?? []) {
      lines.push(`  ${detail}`);
    }
  }
  lines.push("");
  lines.push("Summary");
  lines.push(`- Status: ${input.status}`);
  lines.push(`- Passed: ${input.checks.filter((check) => check.status === "ok").length}`);
  lines.push(`- Warnings: ${input.checks.filter((check) => check.status === "warning").length}`);
  lines.push(`- Errors: ${input.checks.filter((check) => check.status === "error").length}`);
  if (input.changed.length === 0) {
    lines.push("- No files were changed.");
  } else {
    lines.push("- Files changed:");
    for (const file of input.changed) {
      lines.push(`  - ${file}`);
    }
  }
  return lines.join("\n");
}

function statusPrefix(status: DoctorCheckStatus): string {
  if (status === "ok") return "[ok]";
  if (status === "warning") return "[warning]";
  return "[error]";
}
