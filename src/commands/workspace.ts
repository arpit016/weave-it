import { Command } from "commander";
import { showWorkspace } from "../lib/show-workspace.js";
import { withNotices } from "../lib/with-notices.js";

export function workspaceCommand(): Command {
  return new Command("workspace")
    .description("Show the current Weave workspace (workspace mode) or session folders (repo mode).")
    .option("--json", "print machine-readable JSON")
    .action(async (options: { json?: boolean }) => {
      await withNotices(
        { commandName: "workspace", json: options.json ?? false },
        async () => {
          const result = await showWorkspace({ cwd: process.cwd() });
          return {
            json: result.json,
            text: result.text,
            exitCode: result.status === "no_session" ? 1 : 0,
          };
        },
      );
    });
}
