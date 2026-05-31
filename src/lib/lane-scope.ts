import path from "node:path";
import type { LaneName } from "./lane.js";

const PROJECT_FILES = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.eslint.json",
  ".eslintrc.cjs",
  ".eslintrc.js",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.yml",
  ".prettierrc.yaml",
  ".prettierrc.cjs",
  "vitest.config.ts",
  "vitest.config.js",
]);

export interface ScopeContext {
  changeRelativePath: string;
}

export interface ScopePartition {
  inScope: string[];
  leaked: string[];
  foreignKnowledge: string[];
}

export function partitionDirty(
  files: string[],
  lane: LaneName,
  ctx: ScopeContext,
): ScopePartition {
  const inScope: string[] = [];
  const leaked: string[] = [];
  const foreignKnowledge: string[] = [];

  for (const rawFile of files) {
    const file = normalize(rawFile);
    if (isInChangeScope(file, lane, ctx)) {
      inScope.push(rawFile);
      continue;
    }

    if (isForeignKnowledge(file, ctx)) {
      foreignKnowledge.push(rawFile);
      continue;
    }

    if (isLaneScope(file, lane)) {
      inScope.push(rawFile);
      continue;
    }

    leaked.push(rawFile);
  }

  return { inScope, leaked, foreignKnowledge };
}

function normalize(file: string): string {
  return file.split(path.sep).join("/");
}

function isUnderChangeFolder(file: string, ctx: ScopeContext): boolean {
  const prefix = ensureTrailingSlash(normalize(ctx.changeRelativePath));
  return file === prefix.slice(0, -1) || file.startsWith(prefix);
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function isInChangeScope(file: string, lane: LaneName, ctx: ScopeContext): boolean {
  if (!isUnderChangeFolder(file, ctx)) {
    return false;
  }

  const relative = file.slice(ensureTrailingSlash(normalize(ctx.changeRelativePath)).length);
  const top = relative.split("/")[0] ?? "";

  if (top === "sessions" || top === "status.yml" || top === "tasks.md" || top === "review.md") {
    return true;
  }

  if (lane === "exploration") {
    return top === "exploration.md";
  }
  if (lane === "prd") {
    return top === "exploration.md" || top === "prd.md";
  }
  if (lane === "architecture") {
    return top === "exploration.md" || top === "prd.md" || top === "architecture.md";
  }
  if (lane === "implementation") {
    return (
      top === "exploration.md" ||
      top === "prd.md" ||
      top === "architecture.md" ||
      top === "tasks.md"
    );
  }
  if (lane === "review") {
    return true;
  }

  return false;
}

function isForeignKnowledge(file: string, _ctx: ScopeContext): boolean {
  return file.startsWith("wiki/knowledge/");
}

function isLaneScope(file: string, lane: LaneName): boolean {
  if (lane === "implementation" || lane === "review") {
    if (file.startsWith("src/")) {
      return true;
    }
    if (file.startsWith("tests/")) {
      return true;
    }
    if (file.startsWith("templates/")) {
      return true;
    }
    if (file.startsWith("scripts/")) {
      return true;
    }
    const basename = file.split("/").pop() ?? "";
    if (PROJECT_FILES.has(basename)) {
      return true;
    }
  }
  return false;
}
