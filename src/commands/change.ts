import { Command, InvalidArgumentError } from "commander";
import { changeTypes, createChange, type ChangeOperationResult, type ChangeType, propagateChange } from "../lib/changes.js";

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

export function changeCommand(): Command {
  const command = new Command("change").description("Create and propagate Weave change artifacts.");

  command
    .command("new")
    .description("Create a change exploration.")
    .argument("<title>", "change title")
    .option("--type <type>", "change type: feat, fix, refactor, docs, test, ci, or chore", parseChangeType, "feat")
    .option("--slug <slug>", "change slug override")
    .option("--target <target...>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON")
    .action(async (title: string, options: ChangeNewOptions) => {
      await runAction(async () => {
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
    .command("propagate")
    .description("Copy an existing change exploration to other folders.")
    .argument("<change-id>", "change id")
    .option("--from <target>", "source folder path or session folder id")
    .requiredOption("--to <target...>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON")
    .action(async (changeId: string, options: ChangePropagateOptions) => {
      await runAction(async () => {
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

function parseChangeType(value: string): ChangeType {
  if ((changeTypes as string[]).includes(value)) {
    return value as ChangeType;
  }

  throw new InvalidArgumentError(`Unsupported change type: ${value}`);
}

function writeResult(result: ChangeOperationResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${result.message}\n`);
}

async function runAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
