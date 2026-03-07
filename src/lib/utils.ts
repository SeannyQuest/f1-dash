import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLapTime(seconds: number | string | null): string {
  if (seconds === null || seconds === undefined) return "—";
  const n = Number(seconds);
  if (isNaN(n)) return "—";
  const mins = Math.floor(n / 60);
  const secs = n % 60;
  if (mins > 0) {
    return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
  }
  return secs.toFixed(3);
}

export function formatGap(gap: number | string | null): string {
  if (gap === null || gap === undefined) return "—";
  const n = Number(gap);
  if (isNaN(n)) return "—";
  if (n === 0) return "Leader";
  return `+${n.toFixed(3)}`;
}

export function formatInterval(interval: number | string | null): string {
  if (interval === null || interval === undefined) return "—";
  const n = Number(interval);
  if (isNaN(n)) return "—";
  if (n === 0) return "—";
  return `+${n.toFixed(3)}`;
}

export function classifySectorTime(
  current: number | null,
  personalBest: number | null,
  overallBest: number | null,
): "overallBest" | "personalBest" | "slower" | "noData" {
  if (current === null) return "noData";
  if (overallBest !== null && current <= overallBest) return "overallBest";
  if (personalBest !== null && current <= personalBest) return "personalBest";
  return "slower";
}
