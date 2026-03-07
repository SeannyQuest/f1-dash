"use client";

import { useState, useCallback, useEffect } from "react";
import { DEFAULT_PANELS } from "@/lib/constants";
import type { PanelId } from "@/types";

const STORAGE_KEY = "f1-dash-panels";

export function usePanelLayout() {
  const [panels, setPanels] = useState<Record<string, boolean>>(DEFAULT_PANELS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPanels({ ...DEFAULT_PANELS, ...JSON.parse(stored) });
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const togglePanel = useCallback((id: PanelId) => {
    setPanels((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    setPanels(DEFAULT_PANELS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const isVisible = useCallback(
    (id: PanelId) => panels[id] ?? true,
    [panels]
  );

  return { panels, togglePanel, resetLayout, isVisible };
}
