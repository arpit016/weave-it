import { Command, InvalidArgumentError } from "commander";
import { isLaneName, laneNames, type LaneName } from "../lib/lane.js";
import { ship, type ShipResult } from "../lib/ship.js";

interface ShipCliOptions {
  lane?: LaneName;
  json?: boolean;
  draft?: boolean;
  ready?: boolean;
  stash?: boolean;
  messageBody?: string;
  prBodyExtra?: string;
  target?: string;
}

export function shipCommand(): Command {
  return new Command("ship")
    .description("Stage, commit, push, and open/refresh a PR for the active Weave change.")
    .option("--lane <name>", `override lane (one of: ${laneNames.join(", ")})`, parseLane)
    .option("--draft", "force-open the PR as draft")
    .option("--ready", "force-open or promote the PR to ready")
    .option("--stash", "stash leaked files instead of refusing to ship")
    .option("--message-body <text>", "extra paragraphs to append to the commit body")
    .option("--pr-body-extra <text>", "extra paragraphs to append to the PR body")
    .option("--target <target>", "target folder path or session folder id")
    .option("--json", "print machine-readable JSON to stdout")
    .action(async (options: ShipCliOptions) => {
      const json = Boolean(options.json);
      try {
        const result = await ship({
          cwd: process.cwd(),
          lane: options.lane,
          draft: options.draft,
          ready: options.ready,
          stash: options.stash,
          messageBody: options.messageBody,
          prBodyExtra: options.prBodyExtra,
          target: options.target,
        });
        writeResult(result, json);
        process.exitCode = computeExitCode(result);
      } catch (error) {
        if (json) {
          process.stdout.write(
            `${JSON.stringify(
              {
                status: "error",
                targets: [],
                message: error instanceof Error ? error.message : String(error),
              },
              null,
              2,
            )}\n`,
          );
        } else {
          process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        }
        process.exitCode = 1;
      }
    });
}

function parseLane(value: string): LaneName {
  if (isLaneName(value)) {
    return value;
  }
  throw new InvalidArgumentError(`Unsupported lane: ${value}. Expected one of: ${laneNames.join(", ")}.`);
}

function writeResult(result: ShipResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${result.message}\n`);
}

function computeExitCode(result: ShipResult): number {
  let code = 0;
  for (const target of result.targets) {
    if (target.exit_code !== 0) {
      code = Math.max(code, target.exit_code);
    }
  }
  return code;
}
