import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { pathExists } from "./files.js";
import { gatherNotices, type Notice } from "./notices.js";
import { getNpmVersionInfo } from "./npm-version.js";

export interface CommandOutput {
  json: unknown;
  text: string;
  exitCode?: number;
}

export interface WithNoticesOptions {
  commandName: string;
  json: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  packageVersion?: string;
}

export async function withNotices(
  options: WithNoticesOptions,
  action: () => Promise<CommandOutput>,
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const packageVersion = options.packageVersion ?? (await readPackageVersion());

  const noticesPromise = gatherNoticesSafely({ cwd, packageVersion, env });
  const actionResult = await action();
  const notices = await noticesPromise;

  if (options.json) {
    const payload = mergeNoticesIntoJson(actionResult.json, notices);
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${actionResult.text}\n`);
    if (shouldShowFooter(notices, env)) {
      process.stderr.write(renderFooter(notices));
    }
  }

  if (actionResult.exitCode !== undefined && actionResult.exitCode !== 0) {
    process.exitCode = actionResult.exitCode;
  }
}

async function gatherNoticesSafely(opts: {
  cwd: string;
  packageVersion: string;
  env: NodeJS.ProcessEnv;
}): Promise<Notice[]> {
  try {
    const npmInfo = await getNpmVersionInfo({
      packageVersion: opts.packageVersion,
      env: opts.env,
    });
    return await gatherNotices({
      cwd: opts.cwd,
      packageVersion: opts.packageVersion,
      npmLatest: npmInfo.cachedLatest,
      env: opts.env,
    });
  } catch {
    return [];
  }
}

function mergeNoticesIntoJson(json: unknown, notices: Notice[]): unknown {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    return { ...(json as Record<string, unknown>), notices };
  }
  return { result: json, notices };
}

function shouldShowFooter(notices: Notice[], env: NodeJS.ProcessEnv): boolean {
  if (notices.length === 0) return false;
  if (env.WEAVE_NO_NOTICES === "1") return false;
  if (env.CI && env.CI !== "" && env.CI !== "false" && env.CI !== "0") return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

function renderFooter(notices: Notice[]): string {
  return `weave-it: ${notices.length} notice(s) - run 'weave status' for details\n`;
}

async function readPackageVersion(): Promise<string> {
  let current = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(current, "package.json");
    if (await pathExists(candidate)) {
      try {
        const parsed = JSON.parse(await readFile(candidate, "utf8")) as { version?: string };
        if (typeof parsed?.version === "string") return parsed.version;
      } catch {
        // walk up
      }
    }
    const parent = dirname(current);
    if (parent === current) return "0.0.0";
    current = parent;
  }
}
