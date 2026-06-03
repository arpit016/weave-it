import { readJsonCache, writeJsonCache } from "./files.js";
import { getNpmVersionCachePath } from "./user-paths.js";

const NPM_REGISTRY_URL = "https://registry.npmjs.org/weave-it/latest";
const FETCH_TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

export interface NpmVersionCache {
  latest: string;
  fetched_at: string;
}

export interface NpmVersionInfo {
  cachedLatest: string | null;
  isStale: boolean;
  fetchedAt: Date | null;
}

export interface GetNpmVersionInfoOptions {
  now?: Date;
  fetchImpl?: typeof fetch;
  cachePath?: string;
  env?: NodeJS.ProcessEnv;
  packageVersion: string;
}

export async function getNpmVersionInfo(options: GetNpmVersionInfoOptions): Promise<NpmVersionInfo> {
  const env = options.env ?? process.env;
  if (env.NO_UPDATE_NOTIFIER === "1" || env.WEAVE_NO_NOTICES === "1") {
    return { cachedLatest: null, isStale: true, fetchedAt: null };
  }

  const now = options.now ?? new Date();
  const cachePath = options.cachePath ?? getNpmVersionCachePath(env);
  const cache = await readJsonCache<NpmVersionCache>(cachePath);

  let cachedLatest: string | null = null;
  let fetchedAt: Date | null = null;
  let isStale = true;

  if (cache && typeof cache.latest === "string" && typeof cache.fetched_at === "string") {
    const parsed = Date.parse(cache.fetched_at);
    if (!Number.isNaN(parsed)) {
      cachedLatest = cache.latest;
      fetchedAt = new Date(parsed);
      isStale = now.getTime() - parsed > CACHE_TTL_MS;
    }
  }

  if (isStale) {
    void refreshNpmVersionCache({
      cachePath,
      now,
      fetchImpl: options.fetchImpl ?? fetch,
      packageVersion: options.packageVersion,
    });
  }

  return { cachedLatest, isStale, fetchedAt };
}

interface RefreshOptions {
  cachePath: string;
  now: Date;
  fetchImpl: typeof fetch;
  packageVersion: string;
}

async function refreshNpmVersionCache(opts: RefreshOptions): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await opts.fetchImpl(NPM_REGISTRY_URL, {
      signal: controller.signal,
      headers: { "user-agent": `weave-it/${opts.packageVersion}` },
    });
    if (!response.ok) return;
    const parsed = (await response.json()) as { version?: unknown };
    if (typeof parsed?.version !== "string") return;

    await writeJsonCache<NpmVersionCache>(opts.cachePath, {
      latest: parsed.version,
      fetched_at: opts.now.toISOString(),
    });
  } catch {
    // Swallow network / abort / parse / write errors; the cache simply stays stale.
  } finally {
    clearTimeout(timeout);
  }
}
