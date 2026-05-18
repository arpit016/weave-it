import { Command } from "commander";
import { initWorkspace } from "../lib/init-workspace.js";

export function initCommand(): Command {
  return new Command("init")
    .description("Initialize Weave in the current folder and start a new session.")
    .option("--id <id>", "folder id")
    .option("--kind <kind>", "folder kind", "app")
    .option("--yes", "accept defaults and skip prompts")
    .action(async (options: { id?: string; kind?: string; yes?: boolean }) => {
      const result = await initWorkspace({
        cwd: process.cwd(),
        folderId: options.id,
        folderKind: options.kind,
        yes: options.yes ?? false,
        interactive: true,
      });

      process.stdout.write(`${result.message}\n`);

      if (result.status === "cancelled") {
        process.exitCode = 1;
      }
    });
}
