import { homedir } from "node:os";
import { join } from "node:path";

export function getUserHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.WEAVE_USER_HOME || homedir();
}

export function getUserWeaveDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(getUserHome(env), ".weave");
}

export function getUserCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(getUserWeaveDir(env), "cache");
}

export function getNpmVersionCachePath(env: NodeJS.ProcessEnv = process.env): string {
  return join(getUserCacheDir(env), "npm-version.json");
}
