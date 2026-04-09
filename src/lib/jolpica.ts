const BASE_URL = "https://api.jolpi.ca/ergast/f1";

// --- Types ---

export interface JolpicaSession {
  date: string;
  time: string;
}

export interface JolpicaCircuit {
  circuitId: string;
  circuitName: string;
  Location: {
    lat: string;
    long: string;
    locality: string;
    country: string;
  };
}

export interface JolpicaRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time: string;
  Circuit: JolpicaCircuit;
  FirstPractice?: JolpicaSession;
  SecondPractice?: JolpicaSession;
  ThirdPractice?: JolpicaSession;
  Qualifying?: JolpicaSession;
  Sprint?: JolpicaSession;
  SprintQualifying?: JolpicaSession;
}

interface JolpicaResponse {
  MRData: {
    RaceTable: {
      season: string;
      Races: JolpicaRace[];
    };
  };
}

// --- Cache (in-memory with TTL) ---

const cache = new Map<string, { data: unknown; expiresAt: number }>();

const ONE_HOUR = 60 * 60 * 1000;

// --- API ---

export async function fetchRaces(year: string): Promise<JolpicaRace[]> {
  const cacheKey = `races-${year}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data as JolpicaRace[];
  }

  const res = await fetch(`${BASE_URL}/${year}.json?limit=100`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Jolpica API error ${res.status}: ${body || res.statusText}`,
    );
  }

  const json = (await res.json()) as JolpicaResponse;
  const races = json.MRData.RaceTable.Races;

  cache.set(cacheKey, { data: races, expiresAt: Date.now() + ONE_HOUR });

  return races;
}
