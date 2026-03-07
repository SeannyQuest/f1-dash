"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";

export function useSessionState() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionKey = searchParams.get("session_key");

  const setSessionKey = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("session_key", key);
      router.push(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  return { sessionKey, setSessionKey };
}
