import { Command } from "commander";
import { createFeature, type FeatureOperationResult, propagateFeature } from "../lib/features.js";

interface FeatureNewOptions {
  slug?: string;
  target?: string[];
  json?: boolean;
}

interface FeaturePropagateOptions {
  from?: string;
  to?: string[];
  json?: boolean;
}

export function featureCommand(): Command {
  const command = new Command("feature").description("Create and propagate Weave feature artifacts.");

  command
    .command("new")
    .description("Create a feature exploration.")
    .argument("<title>", "feature title")
    .option("--slug <slug>", "feature slug override")
    .option("--target <target...>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON")
    .action(async (title: string, options: FeatureNewOptions) => {
      await runAction(async () => {
        const result = await createFeature({
          cwd: process.cwd(),
          title,
          slug: options.slug,
          targets: options.target,
        });
        writeResult(result, options.json ?? false);
      });
    });

  command
    .command("propagate")
    .description("Copy an existing feature exploration to other folders.")
    .argument("<feature-id>", "feature id")
    .option("--from <target>", "source folder path or session folder id")
    .requiredOption("--to <target...>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON")
    .action(async (featureId: string, options: FeaturePropagateOptions) => {
      await runAction(async () => {
        const result = await propagateFeature({
          cwd: process.cwd(),
          featureId,
          from: options.from,
          to: options.to ?? [],
        });
        writeResult(result, options.json ?? false);
      });
    });

  return command;
}

function writeResult(result: FeatureOperationResult, json: boolean): void {
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
