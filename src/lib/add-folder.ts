import { resolveFolder } from "./folders.js";
import { addFolderToSession, defaultSessionPath, loadCurrentSession, saveCurrentSession } from "./session-state.js";
import { ensureWeaveScaffold } from "./weave-scaffold.js";

export type AddFolderOptions = {
  cwd?: string;
  targetPath: string;
  folderId?: string;
  folderKind?: string;
  now?: Date;
  sessionPath?: string;
};

export type AddFolderStatus = "added" | "already_exists" | "no_session";

export type AddFolderCommandResult = {
  status: AddFolderStatus;
  message: string;
};

export async function addFolder(options: AddFolderOptions): Promise<AddFolderCommandResult> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const sessionPath = options.sessionPath ?? defaultSessionPath();
  const session = await loadCurrentSession(sessionPath);

  if (!session) {
    return {
      status: "no_session",
      message: "No current Weave session found. Run `weave init` first.",
    };
  }

  const folder = await resolveFolder({
    cwd,
    targetPath: options.targetPath,
    id: options.folderId,
    kind: options.folderKind,
  });
  await ensureWeaveScaffold({ folder });

  const result = addFolderToSession(session, folder, now);
  await saveCurrentSession(result.session, sessionPath);

  if (!result.added) {
    return {
      status: "already_exists",
      message: `Folder already exists in current Weave session: ${result.id}\n\nPath:\n  ${folder.path}`,
    };
  }

  return {
    status: "added",
    message: `Added folder to current Weave session: ${result.id}\n\nPath:\n  ${folder.path}\n\nNext:\n  weave workspace`,
  };
}
