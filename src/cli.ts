import { Command } from "commander";
import { addCommand } from "./commands/add.js";
import { initCommand } from "./commands/init.js";
import { workspaceCommand } from "./commands/workspace.js";

const program = new Command();

program
  .name("weave")
  .description("Repo-local LLM wiki and temporary multi-folder AI session tooling.")
  .version("0.1.0");

program.addCommand(initCommand());
program.addCommand(addCommand());
program.addCommand(workspaceCommand());

await program.parseAsync(process.argv);
