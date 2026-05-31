import { artifactNames, isArtifactName, type ArtifactName } from "./artifact-metadata.js";

export type LaneName = ArtifactName | "implementation" | "review";

export const laneNames: LaneName[] = [...artifactNames, "implementation", "review"];

export function isLaneName(value: string | undefined): value is LaneName {
  return Boolean(value && (laneNames as string[]).includes(value));
}

export function isFileBackedLane(lane: LaneName): lane is ArtifactName {
  return isArtifactName(lane);
}
