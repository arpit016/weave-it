import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./files.js";

export type ArchitectureArtifactState =
  | {
      status: "missing";
      filePath: string;
      folderPath: string;
      substantive: false;
    }
  | {
      status: "conflict";
      filePath: string;
      folderPath: string;
      substantive: boolean;
      fileSubstantive: boolean;
      indexPath: string;
      indexExists: boolean;
      indexSubstantive: boolean;
      facetPaths: string[];
      substantiveFacetPaths: string[];
    }
  | {
      status: "file";
      path: string;
      filePath: string;
      folderPath: string;
      substantive: boolean;
    }
  | {
      status: "folder";
      filePath: string;
      folderPath: string;
      indexPath: string;
      indexExists: boolean;
      indexSubstantive: boolean;
      facetPaths: string[];
      substantiveFacetPaths: string[];
      substantive: boolean;
      partial: boolean;
    };

interface FolderArchitectureDetails {
  indexPath: string;
  indexExists: boolean;
  indexSubstantive: boolean;
  facetPaths: string[];
  substantiveFacetPaths: string[];
}

export async function resolveArchitectureArtifact(changePath: string): Promise<ArchitectureArtifactState> {
  const filePath = path.join(changePath, "architecture.md");
  const folderPath = path.join(changePath, "architecture");
  const fileExists = await pathExists(filePath);
  const folderExists = await isDirectory(folderPath);

  if (fileExists && folderExists) {
    const folder = await readFolderArchitecture(folderPath);
    const fileSubstantive = await hasSubstantiveMarkdown(filePath);
    const substantive = fileSubstantive || folder.indexSubstantive || folder.substantiveFacetPaths.length > 0;
    return {
      status: "conflict",
      filePath,
      folderPath,
      substantive,
      fileSubstantive,
      ...folder,
    };
  }

  if (fileExists) {
    return {
      status: "file",
      path: filePath,
      filePath,
      folderPath,
      substantive: await hasSubstantiveMarkdown(filePath),
    };
  }

  if (folderExists) {
    const folder = await readFolderArchitecture(folderPath);
    return {
      status: "folder",
      filePath,
      folderPath,
      ...folder,
      substantive: folder.indexSubstantive || folder.substantiveFacetPaths.length > 0,
      partial: !folder.indexSubstantive && folder.substantiveFacetPaths.length > 0,
    };
  }

  return {
    status: "missing",
    filePath,
    folderPath,
    substantive: false,
  };
}

export function architectureMarkdownPaths(state: ArchitectureArtifactState): string[] {
  switch (state.status) {
    case "missing":
      return [];
    case "file":
      return [state.path];
    case "folder":
      return [...(state.indexExists ? [state.indexPath] : []), ...state.facetPaths];
    case "conflict":
      return [state.filePath, ...(state.indexExists ? [state.indexPath] : []), ...state.facetPaths];
  }
}

export async function hasSubstantiveMarkdown(filePath: string): Promise<boolean> {
  if (!(await pathExists(filePath))) {
    return false;
  }

  const content = await readFile(filePath, "utf8");
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const withoutScaffold = withoutFrontmatter
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith("#") && trimmed !== "Not ready";
    })
    .join("\n")
    .trim();
  return withoutScaffold.length > 0;
}

async function readFolderArchitecture(folderPath: string): Promise<FolderArchitectureDetails> {
  const indexPath = path.join(folderPath, "index.md");
  const entries = await readdir(folderPath, { withFileTypes: true });
  const markdownPaths = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(folderPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
  const facetPaths = markdownPaths.filter((filePath) => path.basename(filePath) !== "index.md");
  const substantiveFacetPaths: string[] = [];

  for (const facetPath of facetPaths) {
    if (await hasSubstantiveMarkdown(facetPath)) {
      substantiveFacetPaths.push(facetPath);
    }
  }

  return {
    indexPath,
    indexExists: await pathExists(indexPath),
    indexSubstantive: await hasSubstantiveMarkdown(indexPath),
    facetPaths,
    substantiveFacetPaths,
  };
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}
