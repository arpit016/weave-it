import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getNpmVersionInfo } from "../src/lib/npm-version.js";

async function tempCachePath(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "weave-npm-cache-"));
  return path.join(dir, "npm-version.json");
}

function buildFetch(response: { ok?: boolean; json?: () => Promise<unknown> }): typeof fetch {
  return (async () => {
    return {
      ok: response.ok ?? true,
      json: response.json ?? (async () => ({ version: "0.2.0" })),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

async function waitForCacheLatest(
  cachePath: string,
  expectedLatest: string,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const parsed = JSON.parse(await readFile(cachePath, "utf8")) as { latest?: unknown };
      if (parsed?.latest === expectedLatest) return;
    } catch {
      // not yet written or still corrupt; retry
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Cache did not reach latest=${expectedLatest} within ${timeoutMs}ms`);
}

describe("getNpmVersionInfo", () => {
  it("returns cached value synchronously when fresh", async () => {
    const cachePath = await tempCachePath();
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(
      cachePath,
      JSON.stringify({ latest: "0.5.0", fetched_at: new Date("2026-06-03T12:00:00Z").toISOString() }),
    );

    const info = await getNpmVersionInfo({
      cachePath,
      now: new Date("2026-06-03T13:00:00Z"),
      fetchImpl: vi.fn(),
      packageVersion: "0.1.0",
    });

    expect(info.cachedLatest).toBe("0.5.0");
    expect(info.isStale).toBe(false);
  });

  it("returns null with isStale=true on a cold cache and schedules a background fetch", async () => {
    const cachePath = await tempCachePath();
    const fetchImpl = buildFetch({ json: async () => ({ version: "0.2.0" }) });

    const info = await getNpmVersionInfo({
      cachePath,
      now: new Date(),
      fetchImpl,
      packageVersion: "0.1.0",
    });

    expect(info.cachedLatest).toBeNull();
    expect(info.isStale).toBe(true);

    await waitForCacheLatest(cachePath, "0.2.0");
  });

  it("fetches the scoped package metadata from npm", async () => {
    const cachePath = await tempCachePath();
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({ version: "0.2.0" }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    await getNpmVersionInfo({
      cachePath,
      now: new Date(),
      fetchImpl,
      packageVersion: "0.1.0",
    });

    await waitForCacheLatest(cachePath, "0.2.0");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://registry.npmjs.org/@weave-tools%2fweave-it/latest",
      expect.objectContaining({
        headers: { "user-agent": "weave-it/0.1.0" },
      }),
    );
  });

  it("triggers a background refresh when the cache is older than 24 hours", async () => {
    const cachePath = await tempCachePath();
    await mkdir(path.dirname(cachePath), { recursive: true });
    const oldFetchedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await writeFile(
      cachePath,
      JSON.stringify({ latest: "0.5.0", fetched_at: oldFetchedAt.toISOString() }),
    );

    const fetchImpl = buildFetch({ json: async () => ({ version: "0.6.0" }) });
    const info = await getNpmVersionInfo({
      cachePath,
      now: new Date(),
      fetchImpl,
      packageVersion: "0.5.0",
    });

    expect(info.cachedLatest).toBe("0.5.0");
    expect(info.isStale).toBe(true);

    await waitForCacheLatest(cachePath, "0.6.0");
  });

  it("returns null and does not fetch when NO_UPDATE_NOTIFIER=1", async () => {
    const cachePath = await tempCachePath();
    const fetchImpl = vi.fn();

    const info = await getNpmVersionInfo({
      cachePath,
      env: { NO_UPDATE_NOTIFIER: "1" } as NodeJS.ProcessEnv,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      packageVersion: "0.1.0",
    });

    expect(info.cachedLatest).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns null and does not fetch when WEAVE_NO_NOTICES=1", async () => {
    const cachePath = await tempCachePath();
    const fetchImpl = vi.fn();

    const info = await getNpmVersionInfo({
      cachePath,
      env: { WEAVE_NO_NOTICES: "1" } as NodeJS.ProcessEnv,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      packageVersion: "0.1.0",
    });

    expect(info.cachedLatest).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("tolerates a corrupted cache file by ignoring it and scheduling a background refresh", async () => {
    const cachePath = await tempCachePath();
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, "{not valid json");

    const fetchImpl = buildFetch({ json: async () => ({ version: "0.9.0" }) });
    const info = await getNpmVersionInfo({
      cachePath,
      now: new Date(),
      fetchImpl,
      packageVersion: "0.1.0",
    });

    expect(info.cachedLatest).toBeNull();
    expect(info.isStale).toBe(true);
    await waitForCacheLatest(cachePath, "0.9.0");
  });

  it("does not throw when the registry responds with a non-200 status", async () => {
    const cachePath = await tempCachePath();
    const fetchImpl = buildFetch({ ok: false });

    const info = await getNpmVersionInfo({
      cachePath,
      now: new Date(),
      fetchImpl,
      packageVersion: "0.1.0",
    });

    expect(info.cachedLatest).toBeNull();
    expect(info.isStale).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(readFile(cachePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not throw when the registry response is missing the version field", async () => {
    const cachePath = await tempCachePath();
    const fetchImpl = buildFetch({ json: async () => ({ unrelated: true }) });

    const info = await getNpmVersionInfo({
      cachePath,
      now: new Date(),
      fetchImpl,
      packageVersion: "0.1.0",
    });

    expect(info.cachedLatest).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(readFile(cachePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("aborts the fetch when it takes longer than 3 seconds", async () => {
    const cachePath = await tempCachePath();
    let abortedSignal: AbortSignal | undefined;
    const fetchImpl = (async (_url: string, init: { signal?: AbortSignal }) => {
      abortedSignal = init?.signal;
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }) as unknown as typeof fetch;

    vi.useFakeTimers();
    try {
      const info = await getNpmVersionInfo({
        cachePath,
        now: new Date(),
        fetchImpl,
        packageVersion: "0.1.0",
      });
      expect(info.cachedLatest).toBeNull();

      vi.advanceTimersByTime(4_000);
      expect(abortedSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }

    await expect(readFile(cachePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
