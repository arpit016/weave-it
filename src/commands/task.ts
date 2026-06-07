import { Command, InvalidArgumentError } from "commander";
import { ChangeCommandError } from "../lib/changes.js";
import { prepareTasks, type PrepareResult } from "../lib/task-prepare.js";
import type { TaskSelector } from "../lib/tasks.js";

interface TaskPrepareOptions {
  scope?: string;
  all?: boolean;
  json?: boolean;
}

export function taskCommand(): Command {
  const command = new Command("task").description("Prepare and inspect Weave local tasks.");

  command
    .command("prepare")
    .description("Prepare local branches for selected tasks.")
    .argument("[tasks...]", "task ids, e.g. T1 T3")
    .option("--scope <scope>", "prepare repos referenced by tasks with this scope")
    .option("--all", "prepare repos referenced by all T# tasks")
    .option("--json", "print machine-readable JSON")
    .action(async (tasks: string[], options: TaskPrepareOptions) => {
      await runAction(options.json ?? false, async () => {
        const selector = parsePrepareSelector(tasks, options);
        const result = await prepareTasks({ cwd: process.cwd(), selector });
        writeResult(result, options.json ?? false);
        if (result.status === "blocked") {
          process.exitCode = 1;
        }
      });
    });

  return command;
}

function parsePrepareSelector(tasks: string[], options: TaskPrepareOptions): TaskSelector {
  const hasTasks = tasks.length > 0;
  const hasScope = typeof options.scope === "string" && options.scope.trim().length > 0;
  const hasAll = options.all === true;
  const modes = [hasTasks, hasScope, hasAll].filter(Boolean).length;
  if (modes !== 1) {
    throw new InvalidArgumentError("Provide exactly one selector: task ids, --scope <scope>, or --all.");
  }
  if (hasAll) {
    return { type: "all" };
  }
  if (hasScope) {
    return { type: "scope", scope: options.scope?.trim() ?? "" };
  }
  return { type: "tasks", ids: tasks.map((task) => task.toUpperCase()) };
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
  if (error instanceof InvalidArgumentError) {
    return {
      status: "error",
      code: "invalid_arguments",
      message: error.message,
    };
  }

  return {
    status: "error",
    code: "unknown_error",
    message: error instanceof Error ? error.message : String(error),
  };
}
