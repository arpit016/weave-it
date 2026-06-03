import { Command, InvalidArgumentError } from "commander";
import {
  ChangeCommandError,
  changeStages,
  knowledgeStatuses,
  changeTypes,
  type ChangeStage,
  type KnowledgeStatus,
  clearChangeStaleness,
  type ClearChangeStalenessResult,
  createChange,
  currentChange,
  listChanges,
  type ChangeListResult,
  type ChangeOperationResult,
  type ChangeType,
  progressChange,
  type ProgressChangeResult,
  knowledgeChange,
  type KnowledgeChangeResult,
  propagateChange,
  statusChange,
  switchChange,
  type CurrentChangeResult,
  type StatusChangeResult,
  type SwitchChangeResult,
  isChangeStage,
  isKnowledgeStatus,
} from "../lib/changes.js";
import { withNotices } from "../lib/with-notices.js";

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

interface ChangeProgressOptions extends ChangeStatusOptions {
  source?: string[];
  noInvalidate?: boolean;
  invalidate?: string;
}

interface ChangeClearStaleOptions extends ChangeStatusOptions {
  reason?: string;
}

interface ChangeKnowledgeOptions extends ChangeStatusOptions {
  domain?: string[];
  shared?: string[];
  file?: string[];
  delta?: string;
  reason?: string;
  invalidatedBy?: string;
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
      const json = options.json ?? false;
      await runAction(json, async () => {
        await withNotices({ commandName: "change-new", json }, async () => {
          const result = await createChange({
            cwd: process.cwd(),
            title,
            type: options.type,
            slug: options.slug,
            targets: options.target,
          });
          return { json: result, text: result.message };
        });
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
      const json = options.json ?? false;
      await runAction(json, async () => {
        await withNotices({ commandName: "change-current", json }, async () => {
          const result = await currentChange({ cwd: process.cwd(), target });
          return { json: result, text: result.message };
        });
      });
    });

  command
    .command("status")
    .description("Show active change status and branch alignment.")
    .argument("[change]", "change reference to inspect without switching")
    .option("--target <target>", "target folder path, session folder id, or all")
    .option("--json", "print machine-readable JSON")
    .action(async (change: string | undefined, options: ChangeStatusOptions) => {
      const json = options.json ?? false;
      await runAction(json, async () => {
        await withNotices({ commandName: "change-status", json }, async () => {
          const result = await statusChange({
            cwd: process.cwd(),
            change,
            target: options.target,
          });
          return { json: result, text: result.message };
        });
      });
    });

  command
    .command("progress")
    .description("Record lifecycle progress for the active change.")
    .argument("<lane>", "lane: exploration, prd, architecture, or issues", parseChangeStage)
    .option("--target <target>", "target folder path or session folder id")
    .option("--source <source>", "source dependency: exploration, prd, architecture, discussion, sessions, or codebase", collectValues, [])
    .option("--no-invalidate", "suppress all downstream stale propagation")
    .option(
      "--invalidate <lanes>",
      "mark only this comma-separated subset of dependent lanes stale (e.g. issues,prd)",
    )
    .option("--json", "print machine-readable JSON")
    .action(async (stage: ChangeStage, options: ChangeProgressOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await progressChange({
          cwd: process.cwd(),
          stage,
          target: options.target,
          sources: options.source,
          noInvalidate: options.noInvalidate ?? false,
          invalidateOnly: parseInvalidateList(options.invalidate),
        });
        writeResult(result, options.json ?? false);
      });
    });

  command
    .command("clear-stale")
    .description("Explicitly clear a stale lane flag after content-sync verification.")
    .argument("<lane>", "lane: exploration, prd, architecture, or issues", parseChangeStage)
    .option("--target <target>", "target folder path or session folder id")
    .option("--reason <reason>", "one-sentence verification rationale recorded in stale_history")
    .option("--json", "print machine-readable JSON")
    .action(async (lane: ChangeStage, options: ChangeClearStaleOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await clearChangeStaleness({
          cwd: process.cwd(),
          lane,
          target: options.target,
          reason: options.reason,
        });
        writeResult(result, options.json ?? false);
      });
    });

  command
    .command("knowledge")
    .description("Record knowledge freshness for the active change.")
    .argument("<status>", "knowledge status: pending, stale, updated, or none", parseKnowledgeStatus)
    .option("--target <target>", "target folder path or session folder id")
    .option("--domain <domain>", "affected knowledge domain", collectValues)
    .option("--shared <shared>", "affected shared behavior area", collectValues)
    .option("--file <file>", "touched or authoritative knowledge file", collectValues)
    .option("--delta <delta>", "change-local knowledge delta file")
    .option("--reason <reason>", "reason for the knowledge status")
    .option("--invalidated-by <source>", "source that invalidated knowledge freshness")
    .option("--json", "print machine-readable JSON")
    .action(async (status: KnowledgeStatus, options: ChangeKnowledgeOptions) => {
      await runAction(options.json ?? false, async () => {
        const result = await knowledgeChange({
          cwd: process.cwd(),
          status,
          target: options.target,
          domains: options.domain,
          shared: options.shared,
          files: options.file,
          delta: options.delta,
          reason: options.reason,
          invalidatedBy: options.invalidatedBy,
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

function parseKnowledgeStatus(value: string): KnowledgeStatus {
  if (isKnowledgeStatus(value)) {
    return value;
  }

  throw new InvalidArgumentError(`Unsupported knowledge status: ${value}. Expected ${knowledgeStatuses.join(", ")}`);
}

function parseChangeStage(value: string): ChangeStage {
  if (isChangeStage(value)) {
    return value;
  }

  throw new InvalidArgumentError(`Unsupported change stage: ${value}. Expected ${changeStages.join(", ")}`);
}

function parseInvalidateList(raw: string | undefined): ChangeStage[] | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    if (!isChangeStage(part)) {
      throw new InvalidArgumentError(
        `Unsupported lane in --invalidate: ${part}. Expected ${changeStages.join(", ")}`,
      );
    }
  }
  return parts as ChangeStage[];
}

function parseChangeType(value: string): ChangeType {
  if ((changeTypes as string[]).includes(value)) {
    return value as ChangeType;
  }

  throw new InvalidArgumentError(`Unsupported change type: ${value}`);
}

function collectValues(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function writeResult(
  result:
    | ChangeOperationResult
    | ChangeListResult
    | CurrentChangeResult
    | StatusChangeResult
    | SwitchChangeResult
    | ProgressChangeResult
    | KnowledgeChangeResult
    | ClearChangeStalenessResult,
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
