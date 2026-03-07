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

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error(`OpenF1 token error: ${res.status} ${errBody}`);
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

  const headers: Record<string, string> = {};
  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenF1 API error ${res.status}: ${body || res.statusText}`,
    );
  }

  return res.json() as Promise<T>;
}
