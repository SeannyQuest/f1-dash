export interface Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name: string;
  circuit_key: number;
  circuit_short_name: string;
  location: string;
  country_key: number;
  country_code: string;
  country_name: string;
  date_start: string;
  date_end: string;
  gmt_offset: string;
  year: number;
}

export interface Session {
  session_key: number;
  session_name: string;
  session_type: string;
  meeting_key: number;
  date_start: string;
  date_end: string;
  gmt_offset: string;
  year: number;
  circuit_key: number;
  circuit_short_name: string;
  country_name: string;
}

export interface Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  first_name: string;
  last_name: string;
  team_name: string;
  team_colour: string;
  country_code: string;
  session_key: number;
  headshot_url: string | null;
}

export interface Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed: number | null;
  i2_speed: number | null;
  st_speed: number | null;
  is_pit_out_lap: boolean;
  date_start: string;
  session_key: number;
}

export interface Position {
  driver_number: number;
  position: number;
  date: string;
  session_key: number;
  meeting_key: number;
}

export interface Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET";
  tyre_age_at_start: number;
  session_key: number;
}

export interface Weather {
  air_temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  track_temperature: number;
  wind_direction: number;
  wind_speed: number;
  date: string;
  session_key: number;
  meeting_key: number;
}

export interface RaceControlMessage {
  date: string;
  category: string;
  flag?: string;
  message: string;
  scope?: string;
  sector?: number;
  driver_number?: number;
  lap_number?: number;
  session_key: number;
  meeting_key: number;
}

export interface Interval {
  driver_number: number;
  gap_to_leader: number | null;
  interval: number | null;
  date: string;
  session_key: number;
}

export interface CarData {
  driver_number: number;
  speed: number;
  throttle: number;
  brake: number;
  n_gear: number;
  rpm: number;
  drs: number;
  date: string;
  session_key: number;
}

export type PanelId =
  | "timing-tower"
  | "track-map"
  | "tire-strategy"
  | "lap-chart"
  | "weather"
  | "race-control"
  | "driver-comparison"
  | "session-selector";
