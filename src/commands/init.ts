import { Command } from "commander";
import { initWorkspace } from "../lib/init-workspace.js";

export function initCommand(): Command {
  return new Command("init")
    .description("Initialize Weave in repo mode or workspace mode and start a new session.")
    .option("--id <id>", "folder id")
    .option("--kind <kind>", "folder kind", "app")
    .option("--mode <mode>", "init mode: repo or workspace; defaults to repo with --yes")
    .option("--workspace-name <name>", "workspace name for workspace mode")
    .option("--workspace-path <path>", "workspace path for workspace mode outside a git repo")
    .option("--yes", "accept defaults and skip prompts")
    .action(
      async (options: {
        id?: string;
        kind?: string;
        mode?: string;
        workspaceName?: string;
        workspacePath?: string;
        yes?: boolean;
      }) => {
        const result = await initWorkspace({
          cwd: process.cwd(),
          folderId: options.id,
          folderKind: options.kind,
          mode: options.mode,
          workspaceName: options.workspaceName,
          workspacePath: options.workspacePath,
          yes: options.yes ?? false,
          interactive: true,
        });

        process.stdout.write(`${result.message}\n`);

        if (result.status === "cancelled") {
          process.exitCode = 1;
        }
      },
    );
}
