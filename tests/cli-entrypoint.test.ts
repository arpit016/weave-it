import { mkdtemp, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isDirectCliInvocation } from "../src/cli.js";

const projectRoot = path.resolve(__dirname, "..");
const cliEntry = path.resolve(projectRoot, "src", "cli.ts");

describe("CLI entrypoint detection", () => {
  it("treats a symlinked npm bin path as a direct invocation", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "weave-cli-entrypoint-"));
    const binPath = path.join(cwd, "weave");
    await symlink(cliEntry, binPath);

    expect(isDirectCliInvocation(binPath, pathToFileURL(cliEntry).href)).toBe(true);
  });
});
