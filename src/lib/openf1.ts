const BASE_URL = "https://api.openf1.org/v1";

export async function fetchOpenF1<T>(
  endpoint: string,
  params: Record<string, string> = {},
  options: { revalidate?: number } = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const res = await fetch(url.toString(), {
    next: { revalidate: options.revalidate ?? 3600 },
  });

  if (!res.ok) {
    throw new Error(`OpenF1 API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
