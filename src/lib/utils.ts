import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLapTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
  }
  return secs.toFixed(3);
}

export function formatGap(gap: number | null): string {
  if (gap === null || gap === undefined) return "—";
  if (gap === 0) return "Leader";
  return `+${gap.toFixed(3)}`;
}

export function formatInterval(interval: number | null): string {
  if (interval === null || interval === undefined) return "—";
  if (interval === 0) return "—";
  return `+${interval.toFixed(3)}`;
}
