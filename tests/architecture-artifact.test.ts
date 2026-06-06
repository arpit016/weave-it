import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { architectureMarkdownPaths, resolveArchitectureArtifact } from "../src/lib/architecture-artifact.js";

async function tempChangePath(): Promise<string> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "weave-architecture-artifact-"));
  const changePath = path.join(cwd, "wiki", "changes", "260606-test-change");
  await mkdir(changePath, { recursive: true });
  return changePath;
}

describe("architecture artifact resolver", () => {
  it("returns missing when no architecture artifact exists", async () => {
    const changePath = await tempChangePath();

    const artifact = await resolveArchitectureArtifact(changePath);

    expect(artifact).toMatchObject({
      status: "missing",
      substantive: false,
    });
    expect(architectureMarkdownPaths(artifact)).toEqual([]);
  });

  it("detects substantive legacy file mode", async () => {
    const changePath = await tempChangePath();
    await writeFile(path.join(changePath, "architecture.md"), "# Architecture\n\nSubstantive design.\n");

    const artifact = await resolveArchitectureArtifact(changePath);

    expect(artifact).toMatchObject({
      status: "file",
      substantive: true,
    });
    expect(architectureMarkdownPaths(artifact)).toEqual([path.join(changePath, "architecture.md")]);
  });

  it("detects non-substantive legacy file mode", async () => {
    const changePath = await tempChangePath();
    await writeFile(path.join(changePath, "architecture.md"), "---\nartifact: architecture\n---\n\n# Architecture\n");

    const artifact = await resolveArchitectureArtifact(changePath);

    expect(artifact).toMatchObject({
      status: "file",
      substantive: false,
    });
  });

  it("detects folder mode with substantive index", async () => {
    const changePath = await tempChangePath();
    const folderPath = path.join(changePath, "architecture");
    await mkdir(folderPath);
    await writeFile(path.join(folderPath, "index.md"), "# Architecture\n\nIndex design.\n");
    await writeFile(path.join(folderPath, "schema.md"), "# Schema\n");

    const artifact = await resolveArchitectureArtifact(changePath);

    expect(artifact).toMatchObject({
      status: "folder",
      indexExists: true,
      indexSubstantive: true,
      substantive: true,
      partial: false,
    });
  });

  it("treats substantive facet-only folder mode as partial architecture", async () => {
    const changePath = await tempChangePath();
    const folderPath = path.join(changePath, "architecture");
    await mkdir(folderPath);
    await writeFile(path.join(folderPath, "schema.md"), "# Schema\n\nSubstantive schema design.\n");

    const artifact = await resolveArchitectureArtifact(changePath);

    expect(artifact).toMatchObject({
      status: "folder",
      indexExists: false,
      indexSubstantive: false,
      substantive: true,
      partial: true,
      substantiveFacetPaths: [path.join(folderPath, "schema.md")],
    });
  });

  it("detects non-substantive folder mode", async () => {
    const changePath = await tempChangePath();
    const folderPath = path.join(changePath, "architecture");
    await mkdir(folderPath);
    await writeFile(path.join(folderPath, "index.md"), "# Architecture\n");
    await writeFile(path.join(folderPath, "schema.md"), "# Schema\n");

    const artifact = await resolveArchitectureArtifact(changePath);

    expect(artifact).toMatchObject({
      status: "folder",
      substantive: false,
      partial: false,
      substantiveFacetPaths: [],
    });
  });

  it("detects conflict when both file and folder shapes exist", async () => {
    const changePath = await tempChangePath();
    const folderPath = path.join(changePath, "architecture");
    await mkdir(folderPath);
    await writeFile(path.join(changePath, "architecture.md"), "# Architecture\n\nLegacy design.\n");
    await writeFile(path.join(folderPath, "index.md"), "# Architecture\n\nFolder design.\n");

    const artifact = await resolveArchitectureArtifact(changePath);

    expect(artifact).toMatchObject({
      status: "conflict",
      fileSubstantive: true,
      indexSubstantive: true,
      substantive: true,
    });
    expect(architectureMarkdownPaths(artifact)).toEqual([
      path.join(changePath, "architecture.md"),
      path.join(folderPath, "index.md"),
    ]);
  });
});
