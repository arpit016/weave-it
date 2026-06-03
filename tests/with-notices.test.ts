import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { withNotices } from "../src/lib/with-notices.js";

vi.mock("../src/lib/notices.js", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/notices.js")>(
    "../src/lib/notices.js",
  );
  return {
    ...actual,
    gatherNotices: vi.fn(),
  };
});

vi.mock("../src/lib/npm-version.js", () => ({
  getNpmVersionInfo: vi.fn(async () => ({ cachedLatest: null, isStale: false, fetchedAt: null })),
}));

import { gatherNotices } from "../src/lib/notices.js";

interface CaptureResult {
  stdout: string;
  stderr: string;
  exitCode: number | undefined;
}

async function capture(action: () => Promise<void>): Promise<CaptureResult> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  process.stdout.write = ((chunk: unknown) => {
    stdoutChunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;

  try {
    await action();
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
  const capturedExit = process.exitCode;
  process.exitCode = originalExitCode;

  return {
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join(""),
    exitCode: capturedExit,
  };
}

describe("withNotices", () => {
  beforeEach(() => {
    vi.mocked(gatherNotices).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("merges notices into JSON output at the top level", async () => {
    vi.mocked(gatherNotices).mockResolvedValue([
      { kind: "skills_modified", message: "modified" },
    ]);

    const result = await capture(async () => {
      await withNotices(
        { commandName: "test", json: true, env: {} as NodeJS.ProcessEnv },
        async () => ({ json: { status: "ok", foo: "bar" }, text: "ignored" }),
      );
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      status: "ok",
      foo: "bar",
      notices: [{ kind: "skills_modified", message: "modified" }],
    });
  });

  it("wraps non-object JSON results under `result` and adds notices", async () => {
    vi.mocked(gatherNotices).mockResolvedValue([]);

    const result = await capture(async () => {
      await withNotices(
        { commandName: "test", json: true, env: {} as NodeJS.ProcessEnv },
        async () => ({ json: ["a", "b"], text: "" }),
      );
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({ result: ["a", "b"], notices: [] });
  });

  it("prints the text payload to stdout in non-JSON mode", async () => {
    const result = await capture(async () => {
      await withNotices(
        { commandName: "test", json: false, env: {} as NodeJS.ProcessEnv },
        async () => ({ json: {}, text: "hello world" }),
      );
    });

    expect(result.stdout).toBe("hello world\n");
  });

  it("emits a stderr footer when notices exist, TTY, no opt-out", async () => {
    vi.mocked(gatherNotices).mockResolvedValue([
      { kind: "skills_modified", message: "drift" },
    ]);
    const originalIsTTY = process.stdout.isTTY;
    (process.stdout as { isTTY: boolean }).isTTY = true;

    try {
      const result = await capture(async () => {
        await withNotices(
          { commandName: "test", json: false, env: {} as NodeJS.ProcessEnv },
          async () => ({ json: {}, text: "ok" }),
        );
      });

      expect(result.stderr).toContain("weave-it: 1 notice(s)");
    } finally {
      (process.stdout as { isTTY: boolean | undefined }).isTTY = originalIsTTY ?? false;
    }
  });

  it("suppresses the stderr footer when WEAVE_NO_NOTICES=1", async () => {
    vi.mocked(gatherNotices).mockResolvedValue([
      { kind: "skills_modified", message: "drift" },
    ]);
    const originalIsTTY = process.stdout.isTTY;
    (process.stdout as { isTTY: boolean }).isTTY = true;

    try {
      const result = await capture(async () => {
        await withNotices(
          {
            commandName: "test",
            json: false,
            env: { WEAVE_NO_NOTICES: "1" } as NodeJS.ProcessEnv,
          },
          async () => ({ json: {}, text: "ok" }),
        );
      });

      expect(result.stderr).toBe("");
    } finally {
      (process.stdout as { isTTY: boolean | undefined }).isTTY = originalIsTTY ?? false;
    }
  });

  it("suppresses the stderr footer when CI is truthy", async () => {
    vi.mocked(gatherNotices).mockResolvedValue([
      { kind: "skills_modified", message: "drift" },
    ]);
    const originalIsTTY = process.stdout.isTTY;
    (process.stdout as { isTTY: boolean }).isTTY = true;

    try {
      const result = await capture(async () => {
        await withNotices(
          { commandName: "test", json: false, env: { CI: "true" } as NodeJS.ProcessEnv },
          async () => ({ json: {}, text: "ok" }),
        );
      });

      expect(result.stderr).toBe("");
    } finally {
      (process.stdout as { isTTY: boolean | undefined }).isTTY = originalIsTTY ?? false;
    }
  });

  it("suppresses the stderr footer when stdout is not a TTY (piped)", async () => {
    vi.mocked(gatherNotices).mockResolvedValue([
      { kind: "skills_modified", message: "drift" },
    ]);
    const originalIsTTY = process.stdout.isTTY;
    (process.stdout as { isTTY: boolean }).isTTY = false;

    try {
      const result = await capture(async () => {
        await withNotices(
          { commandName: "test", json: false, env: {} as NodeJS.ProcessEnv },
          async () => ({ json: {}, text: "ok" }),
        );
      });

      expect(result.stderr).toBe("");
    } finally {
      (process.stdout as { isTTY: boolean | undefined }).isTTY = originalIsTTY ?? false;
    }
  });

  it("propagates exitCode from the action", async () => {
    const result = await capture(async () => {
      await withNotices(
        { commandName: "test", json: false, env: {} as NodeJS.ProcessEnv },
        async () => ({ json: {}, text: "no session", exitCode: 1 }),
      );
    });

    expect(result.exitCode).toBe(1);
  });

  it("degrades to no notices when gatherNotices throws (still prints action output)", async () => {
    vi.mocked(gatherNotices).mockRejectedValue(new Error("boom"));

    const result = await capture(async () => {
      await withNotices(
        { commandName: "test", json: true, env: {} as NodeJS.ProcessEnv },
        async () => ({ json: { status: "ok" }, text: "" }),
      );
    });

    const parsed = JSON.parse(result.stdout);
    expect(parsed).toEqual({ status: "ok", notices: [] });
  });
});
