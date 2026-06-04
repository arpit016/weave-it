import { Command } from "commander";
import { addFolder } from "../lib/add-folder.js";

export function addCommand(): Command {
  return new Command("add")
    .description("Add a folder or git URL to the current Weave context (repo session or workspace registry).")
    .argument("<path>", "folder path or git URL to add")
    .option("--id <id>", "folder id")
    .option("--kind <kind>", "folder kind", "app")
    .action(async (targetPath: string, options: { id?: string; kind?: string }) => {
      const result = await addFolder({
        cwd: process.cwd(),
        targetPath,
        folderId: options.id,
        folderKind: options.kind,
      });

      process.stdout.write(`${result.message}\n`);

      if (result.status === "no_session") {
        process.exitCode = 1;
      }
    });
}
