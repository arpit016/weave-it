import { readFile } from "node:fs/promises";
import path from "node:path";
import { ChangeCommandError } from "./changes.js";
import { pathExists } from "./files.js";

export type TaskSelector =
  | { type: "tasks"; ids: string[] }
  | { type: "scope"; scope: string }
  | { type: "all" };

export type ParsedTask = {
  id: string;
  title: string;
  status?: string;
  type?: string;
  scope?: string;
  primaryRepo?: string;
  repos: string[];
};

export type TaskSelection = {
  selector: TaskSelector;
  tasks: ParsedTask[];
  availableTaskIds: string[];
  availableScopes: string[];
};

export async function loadTasksForChange(changePath: string): Promise<ParsedTask[]> {
  const tasksPath = path.join(changePath, "tasks.md");
  if (!(await pathExists(tasksPath))) {
    throw new ChangeCommandError("tasks_missing", "No tasks.md found for the active change. Run `weave-slices` first.", { path: tasksPath });
  }

  return parseTasksMarkdown(await readFile(tasksPath, "utf8"));
}

export function parseTasksMarkdown(content: string): ParsedTask[] {
  const headings = [...content.matchAll(/^## (T\d+):\s*(.+)$/gm)];
  const tasks: ParsedTask[] = [];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const next = headings[index + 1];
    const id = heading[1];
    const title = heading[2].trim();
    const start = heading.index ?? 0;
    const end = next?.index ?? content.length;
    const block = content.slice(start, end);
    const fields = parseTaskFields(block);
    tasks.push({
      id,
      title,
      status: fields.get("status"),
      type: fields.get("type"),
      scope: fields.get("scope"),
      primaryRepo: fields.get("primary repo"),
      repos: parseRepoList(fields.get("repos")),
    });
  }

  return tasks;
}

export function selectTasks(tasks: ParsedTask[], selector: TaskSelector): TaskSelection {
  const availableTaskIds = tasks.map((task) => task.id);
  const availableScopes = unique(tasks.map((task) => task.scope).filter((scope): scope is string => Boolean(scope)));

  if (selector.type === "all") {
    return { selector, tasks, availableTaskIds, availableScopes };
  }

  if (selector.type === "scope") {
    const scope = selector.scope.toLowerCase();
    return {
      selector,
      tasks: tasks.filter((task) => task.scope?.toLowerCase() === scope),
      availableTaskIds,
      availableScopes,
    };
  }

  const normalized = selector.ids.map((id) => id.toUpperCase());
  const found = tasks.filter((task) => normalized.includes(task.id.toUpperCase()));
  const foundIds = new Set(found.map((task) => task.id.toUpperCase()));
  const missing = normalized.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ChangeCommandError("task_not_found", `No matching task found: ${missing.join(", ")}`, { missing, availableTaskIds });
  }

  return { selector, tasks: found, availableTaskIds, availableScopes };
}

export function deriveTaskRepoIds(task: ParsedTask): string[] {
  return unique([
    ...parseRepoList(task.primaryRepo),
    ...task.repos,
  ]);
}

function parseTaskFields(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of block.split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z ]+):\s*(.*)$/);
    if (!match) {
      continue;
    }
    fields.set(match[1].trim().toLowerCase(), cleanValue(match[2]));
  }
  return fields;
}

function parseRepoList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((part) => cleanValue(part))
    .filter((part) => part.length > 0 && !isNoRepoValue(part));
}

function cleanValue(value: string): string {
  return value.trim().replace(/^`+|`+$/g, "").trim();
}

function isNoRepoValue(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized === "none" || normalized === "n/a" || normalized === "not applicable" || normalized === "-";
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}
