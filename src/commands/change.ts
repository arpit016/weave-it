import { Command, InvalidArgumentError } from "commander";
import {
  ChangeCommandError,
  changeStages,
  changeTypes,
  type ChangeStage,
  createChange,
  currentChange,
  listChanges,
  type ChangeListResult,
  type ChangeOperationResult,
  type ChangeType,
  progressChange,
  type ProgressChangeResult,
  propagateChange,
  statusChange,
  switchChange,
  type CurrentChangeResult,
  type StatusChangeResult,
  type SwitchChangeResult,
  isChangeStage,
} from "../lib/changes.js";

interface ChangeNewOptions {
  slug?: string;
  type?: ChangeType;
  target?: string[];
  json?: boolean;
}

interface ChangePropagateOptions {
  from?: string;
  to?: string[];
  json?: boolean;
}

interface ChangeTargetOptions {
  json?: boolean;
}

interface ChangeStatusOptions {
  target?: string;
  json?: boolean;
}

export function changeCommand(): Command {
  const command = new Command("change").description("Create, inspect, and propagate Weave change artifacts.");

  command
    .command("new")
    .description("Create a change exploration.")
    .argument("<title>", "change title")
    .option("--type <type>", "change type: feat, fix, refactor, docs, test, ci, or chore", parseChangeType, "feat")
    .option("--slug <slug>", "change slug override")
    .option("--target <target...>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON")
    .action(async (title: string, options: ChangeNewOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await createChange({
          cwd: process.cwd(),
          title,
          type: options.type,
          slug: options.slug,
          targets: options.target,
        });
        writeResult(result, options.json ?? false);
      });
    });

  command
    .command("list")
    .description("List changes.")
    .argument("[target]", "target folder path, session folder id, or all")
    .option("--json", "print machine-readable JSON")
    .action(async (target: string | undefined, options: ChangeTargetOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await listChanges({
          cwd: process.cwd(),
          target,
        });
        writeResult(result, options.json ?? false);
      });
    });

  command
    .command("current")
    .description("Show the current active change.")
    .argument("[target]", "target folder path, session folder id, or all")
    .option("--json", "print machine-readable JSON")
    .action(async (target: string | undefined, options: ChangeTargetOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await currentChange({
          cwd: process.cwd(),
          target,
        });
        writeResult(result, options.json ?? false);
      });
    });

  command
    .command("status")
    .description("Show active change status and branch alignment.")
    .argument("[change]", "change reference to inspect without switching")
    .option("--target <target>", "target folder path, session folder id, or all")
    .option("--json", "print machine-readable JSON")
    .action(async (change: string | undefined, options: ChangeStatusOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await statusChange({
          cwd: process.cwd(),
          change,
          target: options.target,
        });
        writeResult(result, options.json ?? false);
      });
    });

  command
    .command("progress")
    .description("Record lifecycle progress for the active change.")
    .argument("<lane>", "lane: exploration, prd, architecture, or issues", parseChangeStage)
    .option("--target <target>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON")
    .action(async (stage: ChangeStage, options: ChangeStatusOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await progressChange({
          cwd: process.cwd(),
          stage,
          target: options.target,
        });
        writeResult(result, options.json ?? false);
      });
    });

  command
    .command("switch")
    .description("Switch to an existing change.")
    .argument("<change>", "change id, token, slug, or title substring")
    .option("--json", "print machine-readable JSON")
    .action(async (change: string, options: ChangeTargetOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await switchChange({
          cwd: process.cwd(),
          change,
        });
        writeResult(result, options.json ?? false);
      });
    });

  command
    .command("propagate")
    .description("Copy an existing change exploration to other folders.")
    .argument("<change-id>", "change id")
    .option("--from <target>", "source folder path or session folder id")
    .requiredOption("--to <target...>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON")
    .action(async (changeId: string, options: ChangePropagateOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await propagateChange({
          cwd: process.cwd(),
          changeId,
          from: options.from,
          to: options.to ?? [],
        });
        writeResult(result, options.json ?? false);
      });
    });

  return command;
}

function parseChangeStage(value: string): ChangeStage {
  if (isChangeStage(value)) {
    return value;
  }

  throw new InvalidArgumentError(`Unsupported change stage: ${value}. Expected ${changeStages.join(", ")}`);
}

function parseChangeType(value: string): ChangeType {
  if ((changeTypes as string[]).includes(value)) {
    return value as ChangeType;
  }

  throw new InvalidArgumentError(`Unsupported change type: ${value}`);
}

function writeResult(
  result: ChangeOperationResult | ChangeListResult | CurrentChangeResult | StatusChangeResult | SwitchChangeResult | ProgressChangeResult,
  json: boolean,
): void {
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
