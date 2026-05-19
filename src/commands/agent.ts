import { Command, InvalidArgumentError } from "commander";
import {
  type AgentSelection,
  diffAgentSkills,
  installAgentSkills,
  resetAgentSkills,
  updateAgentSkills,
} from "../lib/agent-skills.js";

interface JsonOption {
  json?: boolean;
}

export function agentCommand(): Command {
  const command = new Command("agent").description("Install and manage agent skills.");

  command
    .command("install")
    .description("Install Weave skills for an agent.")
    .argument("<agent>", "codex, cursor, claude, opencode, or all", parseAgentSelection)
    .option("--json", "print machine-readable JSON")
    .action(async (agent: AgentSelection, options: JsonOption) => {
      await runAction(async () => {
        const result = await installAgentSkills({ cwd: process.cwd(), agent });
        writeOperationResult(result.message, result.results, options.json ?? false);
      });
    });

  command
    .command("update")
    .description("Update installed Weave skills when they have not been modified.")
    .argument("<agent>", "codex, cursor, claude, opencode, or all", parseAgentSelection)
    .option("--json", "print machine-readable JSON")
    .action(async (agent: AgentSelection, options: JsonOption) => {
      await runAction(async () => {
        const result = await updateAgentSkills({ cwd: process.cwd(), agent });
        writeOperationResult(result.message, result.results, options.json ?? false);
      });
    });

  command
    .command("diff")
    .description("Show differences between installed skills and current Weave defaults.")
    .argument("<agent>", "codex, cursor, claude, opencode, or all", parseAgentSelection)
    .argument("[skill]", "skill name")
    .action(async (agent: AgentSelection, skill?: string) => {
      await runAction(async () => {
        const result = await diffAgentSkills({ cwd: process.cwd(), agent, skill });
        process.stdout.write(`${result.message}\n`);
      });
    });

  command
    .command("reset")
    .description("Overwrite installed skills with current Weave defaults.")
    .argument("<agent>", "codex, cursor, claude, opencode, or all", parseAgentSelection)
    .argument("[skill]", "skill name")
    .option("--json", "print machine-readable JSON")
    .action(async (agent: AgentSelection, skill: string | undefined, options: JsonOption) => {
      await runAction(async () => {
        const result = await resetAgentSkills({ cwd: process.cwd(), agent, skill });
        writeOperationResult(result.message, result.results, options.json ?? false);
      });
    });

  return command;
}

function parseAgentSelection(value: string): AgentSelection {
  if (value === "codex" || value === "cursor" || value === "claude" || value === "opencode" || value === "all") {
    return value;
  }

  throw new InvalidArgumentError(`Unsupported agent: ${value}`);
}

function writeOperationResult(message: string, results: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${message}\n`);
}

async function runAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
