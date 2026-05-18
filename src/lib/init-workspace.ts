import * as prompts from "@clack/prompts";
import { resolveFolder } from "./folders.js";
import { loadCurrentSession, saveCurrentSession, createCurrentSession, defaultSessionPath } from "./session-state.js";
import { ensureWeaveScaffold } from "./weave-scaffold.js";

export type InitStatus = "initialized" | "cancelled";

export type InitWorkspaceOptions = {
  cwd?: string;
  folderId?: string;
  folderKind?: string;
  yes?: boolean;
  interactive?: boolean;
  now?: Date;
  sessionPath?: string;
};

export type InitWorkspaceResult = {
  status: InitStatus;
  message: string;
  folderPath: string;
  weaveDir: string;
  sessionPath: string;
};

export async function initWorkspace(options: InitWorkspaceOptions = {}): Promise<InitWorkspaceResult> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const existingSession = await loadCurrentSession(sessionPath);

  if (existingSession && !(await shouldReplaceSession(options))) {
    return {
      status: "cancelled",
      message: "Cancelled. Existing Weave session was not replaced.",
      folderPath: cwd,
      weaveDir: "",
      sessionPath,
    };
  }

  const folder = await resolveFolder({
    cwd,
    id: options.folderId,
    kind: options.folderKind,
  });
  const scaffold = await ensureWeaveScaffold({ folder, now });
  const session = createCurrentSession(folder, now);
  await saveCurrentSession(session, sessionPath);

  return {
    status: "initialized",
    message: initializedMessage(folder.id, folder.path, scaffold.created, sessionPath),
    folderPath: folder.path,
    weaveDir: scaffold.weaveDir,
    sessionPath,
  };
}

async function shouldReplaceSession(options: InitWorkspaceOptions): Promise<boolean> {
  if (options.yes || options.interactive === false) {
    return true;
  }

  const answer = await prompts.confirm({
    message: "A Weave session already exists. Start a new session from this folder?",
    initialValue: true,
  });

  if (prompts.isCancel(answer)) {
    prompts.cancel("Cancelled.");
    return false;
  }

  return answer;
}

function initializedMessage(folderId: string, folderPath: string, created: string[], sessionPath: string): string {
  const createdText = created.length > 0 ? created.join("\n  ") : "No repo files changed";

  return `Initialized Weave for folder: ${folderId}

Folder:
  ${folderPath}

Created:
  ${createdText}

Started current session:
  ${folderId}

Session state:
  ${sessionPath}

Next:
  weave add <path>
  weave workspace`;
}
