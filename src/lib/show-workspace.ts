import path from "node:path";
import { defaultSessionPath, loadCurrentSession, type CurrentSession } from "./session-state.js";
import { findWorkspaceMode, isWorkspaceMode } from "./workspace-mode.js";
import { listReposForDisplay, readWorkspaceMetadata, type WorkspaceMetadata } from "./workspace-repos.js";

export type ShowWorkspaceOptions = {
  cwd?: string;
  json?: boolean;
  sessionPath?: string;
};

export type ShowWorkspaceRepo = {
  id: string;
  path: string;
  kind: string;
  remote?: string;
};

export type ShowWorkspaceFolder = {
  id: string;
  path: string;
  kind: string;
  wiki: string;
  metadata: string;
};

export type ShowWorkspaceSummary = {
  name: string;
  path: string;
  mode: "workspace";
};

export type ShowWorkspaceSession = {
  status: "active";
  updated_at: string;
};

export type ShowWorkspaceJson = {
  session: ShowWorkspaceSession | null;
  workspace: ShowWorkspaceSummary | null;
  repos: ShowWorkspaceRepo[];
  folders: ShowWorkspaceFolder[];
};

export type ShowWorkspaceResult = {
  status: "ok" | "no_session";
  message: string;
  json: ShowWorkspaceJson;
  text: string;
};

export async function showWorkspace(options: ShowWorkspaceOptions = {}): Promise<ShowWorkspaceResult> {
  const cwd = options.cwd ?? process.cwd();
  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const session = await loadCurrentSession(sessionPath);
  const modeResult = await findWorkspaceMode(cwd);

  if (isWorkspaceMode(modeResult)) {
    return buildWorkspaceModeResult({
      workspacePath: modeResult.workspacePath,
      session,
      json: options.json ?? false,
    });
  }

  return buildRepoModeResult({ session, json: options.json ?? false });
}

async function buildWorkspaceModeResult(input: {
  workspacePath: string;
  session: CurrentSession | undefined;
  json: boolean;
}): Promise<ShowWorkspaceResult> {
  const metadata = await readWorkspaceMetadata(input.workspacePath);
  const summary = workspaceSummary(input.workspacePath, metadata);
  const repos = metadata ? listReposForDisplay(metadata) : [];

  const json: ShowWorkspaceJson = {
    session: sessionJson(input.session),
    workspace: summary,
    repos,
    folders: [],
  };
  const text = workspaceText(summary, repos);

  return {
    status: "ok",
    message: input.json ? JSON.stringify(json, null, 2) : text,
    json,
    text,
  };
}

function buildRepoModeResult(input: {
  session: CurrentSession | undefined;
  json: boolean;
}): ShowWorkspaceResult {
  if (!input.session) {
    const json: ShowWorkspaceJson = {
      session: null,
      workspace: null,
      repos: [],
      folders: [],
    };
    const text = "No current Weave session found. Run `weave init` first.";
    return {
      status: "no_session",
      message: input.json ? JSON.stringify(json, null, 2) : text,
      json,
      text,
    };
  }

  const folders = Object.entries(input.session.folders).map(([id, folder]) =>
    buildFolderOutput(id, folder.path, folder.kind),
  );

  const json: ShowWorkspaceJson = {
    session: sessionJson(input.session),
    workspace: null,
    repos: [],
    folders,
  };
  const text = repoText(folders);
  return {
    status: "ok",
    message: input.json ? JSON.stringify(json, null, 2) : text,
    json,
    text,
  };
}

function buildFolderOutput(id: string, folderPath: string, kind: string): ShowWorkspaceFolder {
  return {
    id,
    path: folderPath,
    kind,
    wiki: path.join(folderPath, "wiki"),
    metadata: path.join(folderPath, ".weave"),
  };
}

function sessionJson(session: CurrentSession | undefined): ShowWorkspaceSession | null {
  if (!session) {
    return null;
  }
  return {
    status: "active",
    updated_at: session.updated_at,
  };
}

function workspaceSummary(workspacePath: string, metadata: WorkspaceMetadata | undefined): ShowWorkspaceSummary {
  return {
    name: metadata?.name ?? path.basename(workspacePath),
    path: workspacePath,
    mode: "workspace",
  };
}

function workspaceText(summary: ShowWorkspaceSummary, repos: ShowWorkspaceRepo[]): string {
  const repoLines = repos.length === 0
    ? "  (no repos registered yet)"
    : repos
        .map((repo) => {
          const remoteSuffix = repo.remote ? `  ${repo.remote}` : "";
          return `  ${repo.id}  ${repo.path}  ${repo.kind}${remoteSuffix}`;
        })
        .join("\n");

  return `Weave workspace: ${summary.name}

Path:
  ${summary.path}

Repos:
${repoLines}

Next:
  weave add <path|url>
  weave change new <title>`;
}

function repoText(folders: ShowWorkspaceFolder[]): string {
  const folderLines = folders
    .map((folder) => `  ${folder.id}  ${folder.path}  ${folder.kind}`)
    .join("\n");

  return `Current Weave session

Folders:
${folderLines}

Next:
  weave add <path>
  weave init`;
}
