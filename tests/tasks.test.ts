import { describe, expect, it } from "vitest";
import { deriveTaskRepoIds, parseTasksMarkdown, selectTasks } from "../src/lib/tasks.js";

const tasksMarkdown = `# Tasks

## Active Task Index

| ID | Status | Type | Scope | Primary repo | Repos | Title | Blocked by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | todo | AFK | Backend | \`api\` | \`api\`, \`shared\` | Build API | None |

## T1: Build API

Status: todo

Type: AFK

Scope: Backend

Primary repo: \`api\`

Repos: \`api\`, \`shared\`

## T2: Wire UI

Status: done

Type: AFK

Scope: frontend

Primary repo: \`web\`

Repos: None

## T3: Cross-repo smoke

Status: invalid

Type: AFK

Scope: Full-Stack

Primary repo: workspace

Repos: \`api\`, \`web\`

## QF1: Bug finding

Status: accepted

## R1: Refactor note

Status: proposed
`;

describe("task parsing and selection", () => {
  it("parses T# detail sections and ignores finding/refactor sections", () => {
    const tasks = parseTasksMarkdown(tasksMarkdown);

    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({
      id: "T1",
      title: "Build API",
      status: "todo",
      type: "AFK",
      scope: "Backend",
      primaryRepo: "api",
      repos: ["api", "shared"],
    });
  });

  it("selects explicit ids and reports missing ids", () => {
    const tasks = parseTasksMarkdown(tasksMarkdown);

    expect(selectTasks(tasks, { type: "tasks", ids: ["t1", "T3"] }).tasks.map((task) => task.id)).toEqual(["T1", "T3"]);
    expect(() => selectTasks(tasks, { type: "tasks", ids: ["T4"] })).toThrow("No matching task found: T4");
  });

  it("selects scopes case-insensitively and all tasks status-agnostically", () => {
    const tasks = parseTasksMarkdown(tasksMarkdown);

    expect(selectTasks(tasks, { type: "scope", scope: "backend" }).tasks.map((task) => task.id)).toEqual(["T1"]);
    expect(selectTasks(tasks, { type: "all" }).tasks.map((task) => task.id)).toEqual(["T1", "T2", "T3"]);
  });

  it("derives stable repo ids from primary repo and repos", () => {
    const tasks = parseTasksMarkdown(tasksMarkdown);

    expect(deriveTaskRepoIds(tasks[0])).toEqual(["api", "shared"]);
    expect(deriveTaskRepoIds(tasks[2])).toEqual(["workspace", "api", "web"]);
  });
});
