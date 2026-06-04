import { readFile } from "node:fs/promises";
import path from "node:path";
import { realpath } from "node:fs/promises";
import YAML from "yaml";
import { pathExists } from "./files.js";

export type WorkspaceModeKind = "workspace" | "repo";

export type FindWorkspaceModeResult = {
  mode: WorkspaceModeKind;
  workspacePath: string;
  workspaceYmlPath: string;
};

export async function findWorkspaceMode(startPath: string): Promise<FindWorkspaceModeResult | undefined> {
  let current = await realpath(startPath);

  for (;;) {
    const workspaceYmlPath = path.join(current, ".weave", "workspace.yml");
    if (await pathExists(workspaceYmlPath)) {
      const parsed = await readWorkspaceYml(workspaceYmlPath);
      if (!parsed) {
        return undefined;
      }

      const mode = parsed.mode === "workspace" ? "workspace" : "repo";
      return {
        mode,
        workspacePath: current,
        workspaceYmlPath,
      };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function readWorkspaceYml(workspaceYmlPath: string): Promise<{ mode?: string } | undefined> {
  try {
    const parsed = YAML.parse(await readFile(workspaceYmlPath, "utf8"));
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    return parsed as { mode?: string };
  } catch {
    return undefined;
  }
}

export function isWorkspaceMode(result: FindWorkspaceModeResult | undefined): result is FindWorkspaceModeResult & {
  mode: "workspace";
} {
  return result?.mode === "workspace";
}
