import { createHash } from "node:crypto";

export function hashDocument(contents: string): string {
  return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
}
