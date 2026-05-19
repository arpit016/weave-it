import { Command } from "commander";
import { listDefaultSkills, readDefaultSkill } from "../lib/agent-skills.js";

export function skillsCommand(): Command {
  const command = new Command("skills").description("List Weave skills.");

  command
    .command("list")
    .description("List default skills shipped with Weave.")
    .option("--json", "print machine-readable JSON")
    .action(async (options: { json?: boolean }) => {
      await runAction(async () => {
        const skills = await listDefaultSkills();

        if (options.json) {
          process.stdout.write(`${JSON.stringify(skills, null, 2)}\n`);
          return;
        }

        process.stdout.write(
          `${skills.map((skill) => `${skill.name}\t${skill.description}`).join("\n")}\n`,
        );
      });
    });

  return command;
}

export function skillCommand(): Command {
  const command = new Command("skill").description("Show Weave skill content.");

  command
    .command("show")
    .description("Print a default skill shipped with Weave.")
    .argument("<name>", "skill name")
    .action(async (name: string) => {
      await runAction(async () => {
        const skill = await readDefaultSkill(name);
        process.stdout.write(skill.content);
        if (!skill.content.endsWith("\n")) {
          process.stdout.write("\n");
        }
      });
    });

  return command;
}

async function runAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
