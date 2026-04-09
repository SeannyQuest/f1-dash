const BASE_URL = "https://api.openf1.org/v1";
const TOKEN_URL = "https://api.openf1.org/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;
  if (!username || !password) return null;

  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300_000) {
    return cachedToken.token;
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }).toString(),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`OpenF1 token error: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: string;
      token_type: string;
    };

    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + parseInt(data.expires_in, 10) * 1000,
    };

    return cachedToken.token;
  } catch {
    return null;
  }
}

export class RateLimitError extends Error {
  status = 429;
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

// In-memory response cache to avoid hitting OpenF1 rate limits (60 req/min).
// Entries persist even after expiry so we can serve stale data during rate limits.
const responseCache = new Map<
  string,
  { data: unknown; expiresAt: number }
>();

// Track in-flight requests to deduplicate concurrent calls for the same URL.
const inflightRequests = new Map<string, Promise<unknown>>();

async function doFetch<T>(
  url: string,
  authHeaders: Record<string, string>,
): Promise<Response> {
  const res = await fetch(url, { headers: authHeaders, cache: "no-store" });

  // If rate-limited with auth, retry without auth (different rate limit bucket)
  if (res.status === 429 && authHeaders["Authorization"]) {
    const retryRes = await fetch(url, { cache: "no-store" });
    return retryRes;
  }

  return res;
}

export async function fetchOpenF1<T>(
  endpoint: string,
  params: Record<string, string> = {},
  options: { revalidate?: number } = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const cacheKey = url.toString();

  // Serve from in-memory cache if still valid
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data as T;
  }

  // Deduplicate concurrent requests for the same URL
  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const request = (async () => {
    const headers: Record<string, string> = {};
    const token = await getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await doFetch<T>(url.toString(), headers);

    if (res.status === 429) {
      // Serve stale cache if available rather than failing
      if (cached) {
        cached.expiresAt = Date.now() + 30_000;
        return cached.data as T;
      }
      throw new RateLimitError("OpenF1 rate limit exceeded (60 req/min)");
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `OpenF1 API error ${res.status}: ${body || res.statusText}`,
      );
    }

    const data = (await res.json()) as T;

    // Cache response — default 30s, or use the caller's revalidate value
    const ttl = (options.revalidate ?? 30) * 1000;
    responseCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttl,
    });

    return data;
  })();

  inflightRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inflightRequests.delete(cacheKey);
  }
}
