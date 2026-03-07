export const TIRE_COLORS: Record<string, string> = {
  SOFT: "#ff1818",
  MEDIUM: "#ffd000",
  HARD: "#ffffff",
  INTERMEDIATE: "#00d25a",
  WET: "#008cff",
  UNKNOWN: "#888888",
};

export const TIRE_LABELS: Record<string, string> = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
  INTERMEDIATE: "I",
  WET: "W",
  UNKNOWN: "?",
};

export const FLAG_COLORS: Record<string, string> = {
  GREEN: "#00d25a",
  YELLOW: "#ffd000",
  RED: "#ff1818",
  "DOUBLE YELLOW": "#ffa500",
  BLUE: "#3b82f6",
  CHEQUERED: "#ffffff",
  BLACK: "#000000",
  "BLACK AND ORANGE": "#ff6600",
};

export const DEFAULT_PANELS: Record<string, boolean> = {
  "timing-tower": true,
  "track-map": true,
  "tire-strategy": true,
  "lap-chart": true,
  weather: true,
  "race-control": true,
  "driver-comparison": true,
  "session-selector": true,
};

export const POLL_INTERVALS = {
  positions: 3000,
  laps: 5000,
  intervals: 3000,
  weather: 30000,
  raceControl: 5000,
  carData: 2000,
  stints: 10000,
  drivers: 60000,
} as const;

export const SECTOR_COLORS: Record<string, string> = {
  personalBest: "#00e664",
  overallBest: "#b45aff",
  slower: "#ffdc00",
  noData: "#222233",
};

export const POSITION_TINTS: Record<number, string> = {
  1: "rgba(255,215,0,0.10)",
  2: "rgba(192,192,192,0.07)",
  3: "rgba(205,127,50,0.07)",
};

export const RACE_CONTROL_CATEGORIES: Record<
  string,
  { color: string; label: string }
> = {
  Flag: { color: "#ffd000", label: "FLAG" },
  SafetyCar: { color: "#ff8c00", label: "SC" },
  Drs: { color: "#00d25a", label: "DRS" },
  CarEvent: { color: "#3b82f6", label: "CAR" },
  Other: { color: "#666", label: "INFO" },
};
