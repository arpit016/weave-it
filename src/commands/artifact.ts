import { Command, InvalidArgumentError } from "commander";
import {
  clearCurrentArtifact,
  currentArtifact,
  setCurrentArtifact,
  type ArtifactCurrentResult,
} from "../lib/artifact-context.js";
import { isLaneName, laneNames, type LaneName } from "../lib/lane.js";
import { ChangeCommandError } from "../lib/changes.js";

interface ArtifactCurrentOptions {
  json?: boolean;
}

interface ArtifactCurrentSetOptions {
  target?: string;
  json?: boolean;
}

export function artifactCommand(): Command {
  const command = new Command("artifact").description("Inspect and route Weave artifact context.");

  const current = new Command("current")
    .description("Show, set, or clear the current artifact context.")
    .argument("[target]", "target folder path, session folder id, or all")
    .option("--json", "print machine-readable JSON")
    .action(async (target: string | undefined, options: ArtifactCurrentOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await currentArtifact({
          cwd: process.cwd(),
          target,
        });
        writeResult(result, options.json ?? false);
      });
    });

  current
    .command("set")
    .description("Set the current artifact context for the active change.")
    .argument("<artifact>", `artifact: ${laneNames.join(", ")}`, parseArtifactName)
    .option("--target <target>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON")
    .action(async (artifact: LaneName, options: ArtifactCurrentSetOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await setCurrentArtifact({
          cwd: process.cwd(),
          artifact,
          target: options.target,
        });
        writeResult(result, options.json ?? false);
      });
    });

  current
    .command("clear")
    .description("Clear the current artifact context for the active change.")
    .option("--target <target>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON")
    .action(async (options: ArtifactCurrentSetOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await clearCurrentArtifact({
          cwd: process.cwd(),
          target: options.target,
        });
        writeResult(result, options.json ?? false);
      });
    });

  command.addCommand(current);
  return command;
}

function parseArtifactName(value: string): LaneName {
  if (isLaneName(value)) {
    return value;
  }

  throw new InvalidArgumentError(`Unsupported artifact: ${value}. Expected one of: ${laneNames.join(", ")}.`);
}

function writeResult(result: ArtifactCurrentResult, json: boolean): void {
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
