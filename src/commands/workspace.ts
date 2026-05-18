import { Command } from "commander";
import { showWorkspace } from "../lib/show-workspace.js";

export function workspaceCommand(): Command {
  return new Command("workspace")
    .description("Show the current Weave session folders.")
    .option("--json", "print machine-readable JSON")
    .action(async (options: { json?: boolean }) => {
      const result = await showWorkspace({ json: options.json ?? false });

      process.stdout.write(`${result.message}\n`);

      if (result.status === "no_session") {
        process.exitCode = 1;
      }
    });
}
