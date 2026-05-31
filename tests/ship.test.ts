import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createChange } from "../src/lib/changes.js";
import { ship } from "../src/lib/ship.js";

const execFileAsync = promisify(execFile);
const testNow = new Date(2026, 4, 22, 10, 0, 0);

interface Fixture {
  cwd: string;
  fakeBinDir: string;
  changeId: string;
}

async function tempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

function sessionPath(cwd: string): string {
  return path.join(path.dirname(cwd), `${path.basename(cwd)}.session.yml`);
}

type GhBehaviour = "ok" | "no_pr" | "unauth" | "create_pr" | "draft_pr";

async function makeFakeGh(binDir: string, behaviour: GhBehaviour): Promise<void> {
  await mkdir(binDir, { recursive: true });
  const ghPath = path.join(binDir, "gh");
  let script = "#!/usr/bin/env bash\n";
  const trace = path.join(binDir, "calls.log");
  script += `echo "$@" >> ${trace}\n`;
  if (behaviour === "unauth") {
    script += `if [[ "$1" == "--version" ]]; then echo "gh fake"; exit 0; fi
case "$1 $2" in
  "auth status") exit 1;;
  *) exit 1;;
esac
`;
  } else if (behaviour === "no_pr") {
    script += `case "$1 $2" in
  "auth status") exit 0;;
  "pr view")  exit 1;;
  "pr create") echo "https://github.com/example/example/pull/1"; exit 0;;
  "--version") echo "gh fake"; exit 0;;
  "pr ready") exit 0;;
  *) exit 0;;
esac
`;
  } else if (behaviour === "create_pr") {
    script += `case "$1 $2" in
  "auth status") exit 0;;
  "pr view") exit 1;;
  "pr create") echo "https://github.com/example/example/pull/1"; exit 0;;
  "--version") echo "gh fake"; exit 0;;
  "pr ready") exit 0;;
  *) exit 0;;
esac
`;
  } else if (behaviour === "draft_pr") {
    script += `case "$1 $2" in
  "auth status") exit 0;;
  "pr view") echo '{"url":"https://github.com/example/example/pull/1","number":1,"isDraft":true,"state":"OPEN"}'; exit 0;;
  "pr create") echo "https://github.com/example/example/pull/1"; exit 0;;
  "--version") echo "gh fake"; exit 0;;
  "pr ready") exit 0;;
  *) exit 0;;
esac
`;
  } else {
    script += `case "$1 $2" in
  "auth status") exit 0;;
  "pr view") echo '{"url":"https://github.com/example/example/pull/1","number":1,"isDraft":false,"state":"OPEN"}'; exit 0;;
  "pr create") echo "https://github.com/example/example/pull/1"; exit 0;;
  "--version") echo "gh fake"; exit 0;;
  "pr ready") exit 0;;
  *) exit 0;;
esac
`;
  }
  await writeFile(ghPath, script);
  await chmod(ghPath, 0o755);
}

async function setupFixture(opts: { withGh?: GhBehaviour; explorationDirty?: boolean } = {}): Promise<Fixture> {
  const cwd = await tempDir("weave-it-ship-");
  const fakeBinDir = await tempDir("weave-it-fakebin-");
  await execFileAsync("git", ["init"], { cwd });
  await execFileAsync("git", ["config", "user.email", "weave@example.com"], { cwd });
  await execFileAsync("git", ["config", "user.name", "Weave Test"], { cwd });
  await execFileAsync("git", ["remote", "add", "origin", "https://github.com/example/example.git"], { cwd });
  await writeFile(path.join(cwd, "README.md"), "ok");
  await execFileAsync("git", ["add", "."], { cwd });
  await execFileAsync("git", ["commit", "-m", "init"], { cwd });

  const result = await createChange({
    cwd,
    title: "Ship Tracer Bullet",
    type: "feat",
    now: testNow,
    randomId: () => "tbul",
    sessionPath: sessionPath(cwd),
  });

  await execFileAsync("git", ["add", "."], { cwd });
  await execFileAsync("git", ["commit", "-m", "scaffold change"], { cwd });

  if (opts.explorationDirty !== false) {
    const explorationPath = path.join(cwd, "wiki", "changes", result.id, "exploration.md");
    const original = await readFile(explorationPath, "utf8");
    await writeFile(explorationPath, `${original}\n## Decisions\n\n- decided: yes\n`);
  }

  if (opts.withGh) {
    await makeFakeGh(fakeBinDir, opts.withGh);
    const fakeRemote = await tempDir("weave-it-fakeremote-");
    await execFileAsync("git", ["init", "--bare"], { cwd: fakeRemote });
    await execFileAsync("git", ["remote", "set-url", "--push", "origin", fakeRemote], { cwd });
  }

  return { cwd, fakeBinDir, changeId: result.id };
}

let originalPath: string | undefined;

beforeEach(() => {
  originalPath = process.env.PATH;
});

afterEach(() => {
  process.env.PATH = originalPath;
});

describe("weave ship - tracer bullet", () => {
  it("commits, pushes, and opens a draft PR for the exploration lane", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.status).toBe("ok");
    expect(result.targets).toHaveLength(1);
    const target = result.targets[0];
    expect(target.lane_used).toBe("exploration");
    expect(target.precondition.ok).toBe(true);
    expect(target.commit.skipped).toBe(false);
    expect(target.commit.sha).toBeDefined();
    expect(target.push.pushed).toBe(true);
    expect(target.pr.action).toBe("opened_draft");
    expect(target.pr.url).toBe("https://github.com/example/example/pull/1");
    expect(target.exit_code).toBe(0);

    const log = await execFileAsync("git", ["log", "-1", "--format=%s"], { cwd: fx.cwd });
    expect(log.stdout.trim()).toBe(`feat(${fx.changeId}): exploration - Ship Tracer Bullet`);
  });

  it("returns existing PR url on idempotent re-run", async () => {
    const fx = await setupFixture({ withGh: "ok", explorationDirty: false });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.targets[0].pr.action).toBe("existing");
    expect(result.targets[0].pr.url).toBe("https://github.com/example/example/pull/1");
    expect(result.targets[0].commit.skipped).toBe(true);
    expect(result.targets[0].commit.reason).toBe("no_in_scope_changes");
  });

  it("fails fast with wrong-branch precondition when not on the change branch", async () => {
    const fx = await setupFixture({ withGh: "ok" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    await execFileAsync("git", ["checkout", "-B", "main"], { cwd: fx.cwd });

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.status).toBe("error");
    expect(result.targets[0].precondition.ok).toBe(false);
    expect(result.targets[0].precondition.reason).toBe("wrong_branch");
    expect(result.targets[0].exit_code).toBe(2);
  });

  it("fails fast with not_git_repo when called outside a git repo", async () => {
    const cwd = await tempDir("weave-it-ship-nogit-");
    await mkdir(path.join(cwd, "wiki", "changes"), { recursive: true });

    const result = await ship({ cwd, sessionPath: sessionPath(cwd) });

    expect(result.status).toBe("error");
    expect(result.targets[0].precondition.reason).toBe("not_git_repo");
    expect(result.targets[0].exit_code).toBe(2);
  });

  it("blocks the ship when leaked files are dirty without --stash", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    await writeFile(path.join(fx.cwd, "leaked.txt"), "leaked");

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.targets[0].guard.ok).toBe(false);
    expect(result.targets[0].guard.leaked_files).toContain("leaked.txt");
    expect(result.targets[0].commit.skipped).toBe(true);
    expect(result.targets[0].commit.reason).toBe("guard_blocked");
    expect(result.targets[0].exit_code).toBe(3);
  });

  it("--stash sets aside leaked files and restores them after ship", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    await execFileAsync("git", ["add", "."], { cwd: fx.cwd });
    await execFileAsync("git", ["commit", "-m", "scaffolded baseline"], { cwd: fx.cwd });
    const exploration = path.join(fx.cwd, "wiki", "changes", fx.changeId, "exploration.md");
    await writeFile(exploration, `${await readFile(exploration, "utf8")}\n## Decisions\n- ok\n`);
    await writeFile(path.join(fx.cwd, "leaked.txt"), "leaked");

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd), stash: true });

    expect(result.targets[0].guard.ok).toBe(true);
    expect(result.targets[0].stash.used).toBe(true);
    expect(result.targets[0].stash.restored).toBe(true);
    expect(result.targets[0].commit.skipped).toBe(false);

    const stillLeaked = await readFile(path.join(fx.cwd, "leaked.txt"), "utf8");
    expect(stillLeaked).toBe("leaked");
  });

  it("ships every session folder that shares the active change id", async () => {
    const root = await tempDir("weave-it-multi-");
    const targetA = path.join(root, "app");
    const targetB = path.join(root, "api");
    await mkdir(targetA);
    await mkdir(targetB);
    const fakeBinDir = await tempDir("weave-it-fakebin-");
    await makeFakeGh(fakeBinDir, "no_pr");

    for (const t of [targetA, targetB]) {
      await execFileAsync("git", ["init"], { cwd: t });
      await execFileAsync("git", ["config", "user.email", "weave@example.com"], { cwd: t });
      await execFileAsync("git", ["config", "user.name", "Weave Test"], { cwd: t });
      await writeFile(path.join(t, "README.md"), "ok");
      await execFileAsync("git", ["add", "."], { cwd: t });
      await execFileAsync("git", ["commit", "-m", "init"], { cwd: t });
      const fakeRemote = await tempDir("weave-it-fakeremote-");
      await execFileAsync("git", ["init", "--bare"], { cwd: fakeRemote });
      await execFileAsync("git", ["remote", "add", "origin", "https://github.com/example/example.git"], { cwd: t });
      await execFileAsync("git", ["remote", "set-url", "--push", "origin", fakeRemote], { cwd: t });
    }

    const session = path.join(root, ".session.yml");
    const created = await createChange({
      cwd: targetA,
      title: "Multi target",
      type: "feat",
      now: testNow,
      randomId: () => "mtgt",
      targets: [targetA, targetB],
      sessionPath: session,
    });

    for (const t of [targetA, targetB]) {
      await execFileAsync("git", ["add", "."], { cwd: t });
      await execFileAsync("git", ["commit", "-m", "scaffold"], { cwd: t });
      const exp = path.join(t, "wiki", "changes", created.id, "exploration.md");
      await writeFile(exp, `${await readFile(exp, "utf8")}\n## Decisions\n- ok\n`);
    }

    process.env.PATH = `${fakeBinDir}:${process.env.PATH ?? ""}`;
    const result = await ship({ cwd: targetA, sessionPath: session });

    expect(result.targets).toHaveLength(2);
    const paths = result.targets.map((t) => t.target_path).sort();
    expect(paths.length).toBe(2);
    for (const t of result.targets) {
      expect(t.commit.skipped).toBe(false);
      expect(t.exit_code).toBe(0);
    }
  });

  it("opens a ready PR by default for the implementation lane", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    await writeFile(
      path.join(fx.cwd, "wiki", "changes", fx.changeId, "tasks.md"),
      "## Tasks\n\n- one\n",
    );

    const result = await ship({
      cwd: fx.cwd,
      sessionPath: sessionPath(fx.cwd),
      lane: "implementation",
    });

    expect(result.targets[0].lane_used).toBe("implementation");
    expect(result.targets[0].lane_source).toBe("flag");
    expect(result.targets[0].pr.action).toBe("opened_ready");
  });

  it("--draft forces draft posture even on implementation lane", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    await writeFile(
      path.join(fx.cwd, "wiki", "changes", fx.changeId, "tasks.md"),
      "## Tasks\n\n- one\n",
    );

    const result = await ship({
      cwd: fx.cwd,
      sessionPath: sessionPath(fx.cwd),
      lane: "implementation",
      draft: true,
    });

    expect(result.targets[0].pr.action).toBe("opened_draft");
  });

  it("--ready promotes an existing draft PR on implementation lane", async () => {
    const fx = await setupFixture({ withGh: "draft_pr", explorationDirty: false });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;

    const result = await ship({
      cwd: fx.cwd,
      sessionPath: sessionPath(fx.cwd),
      lane: "implementation",
      ready: true,
    });

    expect(result.targets[0].pr.action).toBe("promoted_to_ready");
    expect(result.targets[0].pr.url).toBe("https://github.com/example/example/pull/1");
  });

  it("bundles foreign knowledge files with the ship and emits a stderr warning", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    await mkdir(path.join(fx.cwd, "wiki", "knowledge"), { recursive: true });
    await writeFile(path.join(fx.cwd, "wiki", "knowledge", "rule.md"), "knowledge\n");

    const stderrChunks: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((data: string | Uint8Array) => {
      stderrChunks.push(typeof data === "string" ? data : Buffer.from(data).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;

    try {
      const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

      expect(result.targets[0].foreign_knowledge_files).toContain("wiki/knowledge/rule.md");
      expect(result.targets[0].staged_files).toContain("wiki/knowledge/rule.md");
      const stderr = stderrChunks.join("");
      expect(stderr).toMatch(/foreign knowledge file/);
    } finally {
      process.stderr.write = originalWrite;
    }

    const log = await execFileAsync("git", ["log", "-1", "--name-only", "--format="], { cwd: fx.cwd });
    expect(log.stdout).toContain("wiki/knowledge/rule.md");
  });

  it("skips PR with skipped_no_gh when gh is not on PATH", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = "/usr/bin:/bin";

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.targets[0].pr.action).toBe("skipped_no_gh");
    expect(result.targets[0].commit.skipped).toBe(false);
    expect(result.targets[0].push.pushed).toBe(true);
    expect(result.targets[0].exit_code).toBe(0);
  });

  it("skips PR with skipped_unauth when gh exists but auth status fails", async () => {
    const fx = await setupFixture({ withGh: "unauth" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.targets[0].pr.action).toBe("skipped_unauth");
    expect(result.targets[0].exit_code).toBe(0);
  });

  it("skips PR with skipped_non_github for non-github remotes", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    await execFileAsync("git", ["remote", "set-url", "origin", "https://gitlab.com/example/example.git"], { cwd: fx.cwd });

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.targets[0].pr.action).toBe("skipped_non_github");
    expect(result.targets[0].exit_code).toBe(0);
  });

  it("skips PR with skipped_no_remote when origin is not configured", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    await execFileAsync("git", ["remote", "remove", "origin"], { cwd: fx.cwd });

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.targets[0].push.pushed).toBe(false);
    expect(result.targets[0].pr.action === "skipped_no_remote" || result.targets[0].pr.action === "error").toBe(true);
  });

  it("retries the commit once when a pre-commit hook auto-modifies a staged file", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    const hookPath = path.join(fx.cwd, ".git", "hooks", "pre-commit");
    const exploration = path.join("wiki", "changes", fx.changeId, "exploration.md");
    const sentinel = path.join(fx.cwd, ".git", "weave-hook-once");
    const hook = `#!/usr/bin/env bash
if [[ ! -f "${sentinel}" ]]; then
  touch "${sentinel}"
  echo "// hook touched" >> "${path.join(fx.cwd, exploration)}"
  exit 1
fi
exit 0
`;
    await writeFile(hookPath, hook);
    await chmod(hookPath, 0o755);

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.targets[0].commit.skipped).toBe(false);
    expect(result.targets[0].commit.sha).toBeDefined();
  });

  it("hook_failed surfaces when the hook keeps failing after one retry", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;
    const hookPath = path.join(fx.cwd, ".git", "hooks", "pre-commit");
    await writeFile(hookPath, "#!/usr/bin/env bash\nexit 1\n");
    await chmod(hookPath, 0o755);

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });

    expect(result.targets[0].commit.skipped).toBe(true);
    expect(result.targets[0].commit.reason).toBe("hook_failed");
    expect(result.targets[0].exit_code).toBe(3);
  });

  it("returns the full ShipResult shape with --json-equivalent fields", async () => {
    const fx = await setupFixture({ withGh: "no_pr" });
    process.env.PATH = `${fx.fakeBinDir}:${process.env.PATH ?? ""}`;

    const result = await ship({ cwd: fx.cwd, sessionPath: sessionPath(fx.cwd) });
    const target = result.targets[0];

    expect(target).toEqual(
      expect.objectContaining({
        target_path: expect.any(String),
        change_id: fx.changeId,
        branch: `change/${fx.changeId}`,
        lane_used: expect.any(String),
        lane_source: expect.any(String),
        precondition: expect.objectContaining({ ok: true }),
        guard: expect.objectContaining({ ok: true, leaked_files: [] }),
        staged_files: expect.any(Array),
        foreign_knowledge_files: expect.any(Array),
        commit: expect.any(Object),
        push: expect.any(Object),
        pr: expect.any(Object),
        stash: expect.objectContaining({ used: false, restored: false }),
        exit_code: 0,
      }),
    );
  });
});
