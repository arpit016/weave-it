import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { artifactFileName } from "./artifact-metadata.js";
import { ChangeCommandError, currentChange } from "./changes.js";
import { pathExists, writeFileAtomic } from "./files.js";
import { isFileBackedLane, isLaneName, type LaneName } from "./lane.js";
import {
  clearCurrentArtifactForPath,
  currentArtifactForPath,
  defaultSessionPath,
  loadCurrentSession,
  saveCurrentSession,
  setCurrentArtifactForPath,
  type SessionCurrentArtifact,
} from "./session-state.js";

export type ArtifactCurrentSource = "session" | "none";

export interface ArtifactCurrentTargetResult {
  id?: string;
  name?: string;
  path: string;
  source: ArtifactCurrentSource;
  current: boolean;
  artifact?: SessionCurrentArtifact;
  current_change?: {
    id: string;
    path: string;
    branch: string;
  };
}

export interface ArtifactCurrentResult {
  status: "ok";
  targets: ArtifactCurrentTargetResult[];
  message: string;
}

export interface ArtifactCurrentOptions {
  cwd: string;
  target?: string;
  now?: Date;
  sessionPath?: string;
}

export interface ArtifactCurrentSetOptions extends ArtifactCurrentOptions {
  artifact: string;
}

export async function currentArtifact(options: ArtifactCurrentOptions): Promise<ArtifactCurrentResult> {
  const now = options.now ?? new Date();
  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const changeResult = await currentChange({ cwd: options.cwd, target: options.target, now, sessionPath });
  const session = await loadCurrentSession(sessionPath);
  const targets: ArtifactCurrentTargetResult[] = changeResult.targets.map((target) => {
    const saved = currentArtifactForPath(session, target.path);
    const valid = Boolean(saved && target.current && saved.change_id === target.current.id);
    return {
      id: target.id,
      name: target.name,
      path: target.path,
      source: valid ? "session" : "none",
      current: valid,
      artifact: valid ? saved : undefined,
      current_change: target.current
        ? { id: target.current.id, path: target.current.path, branch: target.current.branch }
        : undefined,
    };
  });

  return {
    status: "ok",
    targets,
    message: formatCurrentArtifactMessage(targets),
  };
}

export async function setCurrentArtifact(options: ArtifactCurrentSetOptions): Promise<ArtifactCurrentResult> {
  const artifact = parseArtifact(options.artifact);
  const now = options.now ?? new Date();
  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const changeResult = await currentChange({ cwd: options.cwd, target: options.target, now, sessionPath });

  if (changeResult.targets.length !== 1) {
    throw new ChangeCommandError("ambiguous_target", "Set current artifact for one target at a time");
  }

  const target = changeResult.targets[0];
  if (!target.current) {
    throw new ChangeCommandError("no_current_change", "No active Weave change found. Run `weave change new` or `weave change switch` first.");
  }

  const session = (await loadCurrentSession(sessionPath)) ?? {
    version: 1 as const,
    updated_at: now.toISOString(),
    folders: {},
  };
  const artifactPath = isFileBackedLane(artifact)
    ? path.join(target.current.path, artifactFileName(artifact))
    : target.current.path;
  const artifactState = {
    artifact,
    change_id: target.current.id,
    path: artifactPath,
  };

  setCurrentArtifactForPath(session, target.path, artifactState, now);
  await saveCurrentSession(session, sessionPath);
  await mirrorStageToStatusYml(target.path, target.current.path, artifact);

  const saved = currentArtifactForPath(session, target.path);
  const results: ArtifactCurrentTargetResult[] = [
    {
      id: target.id,
      name: target.name,
      path: target.path,
      source: "session",
      current: true,
      artifact: saved,
      current_change: {
        id: target.current.id,
        path: target.current.path,
        branch: target.current.branch,
      },
    },
  ];

  return {
    status: "ok",
    targets: results,
    message: formatCurrentArtifactMessage(results),
  };
}

export async function clearCurrentArtifact(options: ArtifactCurrentOptions): Promise<ArtifactCurrentResult> {
  const now = options.now ?? new Date();
  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const changeResult = await currentChange({ cwd: options.cwd, target: options.target, now, sessionPath });

  if (changeResult.targets.length !== 1) {
    throw new ChangeCommandError("ambiguous_target", "Clear current artifact for one target at a time");
  }

  const target = changeResult.targets[0];
  const session = (await loadCurrentSession(sessionPath)) ?? {
    version: 1 as const,
    updated_at: now.toISOString(),
    folders: {},
  };
  clearCurrentArtifactForPath(session, target.path, now);
  await saveCurrentSession(session, sessionPath);

  const results: ArtifactCurrentTargetResult[] = [
    {
      id: target.id,
      name: target.name,
      path: target.path,
      source: "none",
      current: false,
      current_change: target.current
        ? { id: target.current.id, path: target.current.path, branch: target.current.branch }
        : undefined,
    },
  ];

  return {
    status: "ok",
    targets: results,
    message: formatCurrentArtifactMessage(results),
  };
}

function parseArtifact(value: string): LaneName {
  if (isLaneName(value)) {
    return value;
  }

  throw new ChangeCommandError(
    "invalid_artifact",
    `Unsupported artifact: ${value}. Expected exploration, prd, architecture, implementation, or review.`,
  );
}

async function mirrorStageToStatusYml(targetRoot: string, changeRelativePath: string, lane: LaneName): Promise<void> {
  const statusPath = path.join(targetRoot, changeRelativePath, "status.yml");
  try {
    if (!(await pathExists(statusPath))) {
      return;
    }

    const raw = await readFile(statusPath, "utf8");
    const parsed = YAML.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return;
    }

    const data = parsed as Record<string, unknown>;
    if (data.stage === lane) {
      return;
    }

    data.stage = lane;
    data.updated_at = new Date().toISOString();
    await writeFileAtomic(statusPath, YAML.stringify(data));
  } catch (error) {
    process.stderr.write(`weave: warning: failed to mirror stage to ${statusPath}: ${(error as Error).message}\n`);
  }
}

function formatCurrentArtifactMessage(targets: ArtifactCurrentTargetResult[]): string {
  return targets
    .map((target) => {
      const label = target.name ? `${target.name} (${target.path})` : target.path;
      if (!target.artifact) {
        return [`Target: ${label}`, "Current artifact: none"].join("\n");
      }

      return [
        `Target: ${label}`,
        `Current artifact: ${target.artifact.artifact}`,
        `Change: ${target.artifact.change_id}`,
        `Path: ${target.artifact.path}`,
      ].join("\n");
    })
    .join("\n\n");
}
