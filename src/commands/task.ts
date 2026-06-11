import { Command } from "commander";
import { ChangeCommandError } from "../lib/changes.js";
import { prepareTasks, type PrepareResult } from "../lib/task-prepare.js";

interface TaskPrepareOptions {
  json?: boolean;
}

export function taskCommand(): Command {
  const command = new Command("task").description("Prepare and inspect Weave local tasks.");

  command
    .command("prepare")
    .description("Prepare local branches for the active change.")
    .option("--json", "print machine-readable JSON")
    .action(async (options: TaskPrepareOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await prepareTasks({ cwd: process.cwd() });
        writeResult(result, options.json ?? false);
        if (result.status === "blocked") {
          process.exitCode = 1;
        }
      });
    });

  return command;
}

function writeResult(result: PrepareResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${result.message}\n`);
}

async function runAction(json: boolean, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (json) {
      process.stdout.write(`${JSON.stringify(errorResult(error), null, 2)}\n`);
    } else {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    }
    process.exitCode = 1;
  }
}

function errorResult(error: unknown): { status: "error"; code: string; message: string; details?: unknown } {
  if (error instanceof ChangeCommandError) {
    return {
      status: "error",
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
  return {
    status: "error",
    code: "unknown_error",
    message: error instanceof Error ? error.message : String(error),
  };
}
