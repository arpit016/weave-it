import { Command } from "commander";
import { addCommand } from "./commands/add.js";
import { agentCommand } from "./commands/agent.js";
import { artifactCommand } from "./commands/artifact.js";
import { changeCommand } from "./commands/change.js";
import { initCommand } from "./commands/init.js";
import { skillCommand, skillsCommand } from "./commands/skills.js";
import { statusCommand } from "./commands/status.js";
import { taskCommand } from "./commands/task.js";
import { workspaceCommand } from "./commands/workspace.js";
import { pathToFileURL } from "node:url";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("weave")
    .description("Repo-local LLM wiki and temporary multi-folder AI session tooling.")
    .version("0.1.0");

  program.addCommand(initCommand());
  program.addCommand(addCommand());
  program.addCommand(workspaceCommand());
  program.addCommand(changeCommand());
  program.addCommand(artifactCommand());
  program.addCommand(agentCommand());
  program.addCommand(skillsCommand());
  program.addCommand(skillCommand());
  program.addCommand(statusCommand());
  program.addCommand(taskCommand());

  return program;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await createProgram().parseAsync(process.argv);
}
