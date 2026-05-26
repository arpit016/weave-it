import YAML from "yaml";

export type ArtifactName = "exploration" | "prd" | "architecture";
export type ArtifactStatus = "draft" | "reviewed" | "approved";
export type ArtifactOwner = "product" | "engineering";

export const artifactNames: ArtifactName[] = ["exploration", "prd", "architecture"];

export interface ArtifactFrontmatterOptions {
  artifact: ArtifactName;
  now: Date;
  status?: ArtifactStatus;
  owner?: ArtifactOwner;
  source?: string;
}

export function isArtifactName(value: string | undefined): value is ArtifactName {
  return Boolean(value && (artifactNames as string[]).includes(value));
}

export function artifactFileName(artifact: ArtifactName): string {
  return artifact === "exploration" ? "exploration.md" : `${artifact}.md`;
}

export function defaultArtifactOwner(artifact: ArtifactName): ArtifactOwner {
  return artifact === "architecture" ? "engineering" : "product";
}

export function defaultArtifactSource(artifact: ArtifactName): string {
  if (artifact === "exploration") {
    return "discussion";
  }

  return artifact === "prd" ? "exploration.md" : "prd.md";
}

export function artifactFrontmatter(options: ArtifactFrontmatterOptions): string {
  const artifact = options.artifact;
  const date = formatArtifactDate(options.now);
  return `---\n${YAML.stringify({
    artifact,
    status: options.status ?? "draft",
    owner: options.owner ?? defaultArtifactOwner(artifact),
    created_at: date,
    updated_at: date,
    reviewed_at: null,
    approved_at: null,
    approved_by: null,
    source: options.source ?? defaultArtifactSource(artifact),
  })}---\n\n`;
}

function formatArtifactDate(now: Date): string {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
