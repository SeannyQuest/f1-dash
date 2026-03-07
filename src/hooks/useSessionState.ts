"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";

export interface SessionSelection {
  sessionKey: string;
  circuitKey?: string;
  year?: string;
}

export function useSessionState() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionKey = searchParams.get("session_key");
  const circuitKey = searchParams.get("circuit_key");
  const year = searchParams.get("year");

  const setSession = useCallback(
    (info: SessionSelection) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("session_key", info.sessionKey);
      if (info.circuitKey) params.set("circuit_key", info.circuitKey);
      if (info.year) params.set("year", info.year);
      router.push(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  return { sessionKey, circuitKey, year, setSession };
}
