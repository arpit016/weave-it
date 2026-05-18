import path from "node:path";
import { defaultSessionPath, loadCurrentSession, type CurrentSession } from "./session-state.js";

export type ShowWorkspaceOptions = {
  json?: boolean;
  sessionPath?: string;
};

export type ShowWorkspaceResult = {
  status: "ok" | "no_session";
  message: string;
};

export async function showWorkspace(options: ShowWorkspaceOptions = {}): Promise<ShowWorkspaceResult> {
  const session = await loadCurrentSession(options.sessionPath ?? defaultSessionPath());

  if (!session) {
    return {
      status: "no_session",
      message: options.json
        ? JSON.stringify({ session: null, folders: [] }, null, 2)
        : "No current Weave session found. Run `weave init` first.",
    };
  }

  return {
    status: "ok",
    message: options.json ? JSON.stringify(jsonOutput(session), null, 2) : textOutput(session),
  };
}

function jsonOutput(session: CurrentSession) {
  return {
    session: {
      status: "active",
      updated_at: session.updated_at,
    },
    folders: Object.entries(session.folders).map(([id, folder]) => ({
      id,
      path: folder.path,
      kind: folder.kind,
      weave: path.join(folder.path, "weave"),
    })),
  };
}

function textOutput(session: CurrentSession): string {
  const folders = Object.entries(session.folders)
    .map(([id, folder]) => `  ${id}  ${folder.path}  ${folder.kind}`)
    .join("\n");

  return `Current Weave session

Folders:
${folders}

Next:
  weave add <path>
  weave init`;
}
