/**
 * Manages the accumulated F1 live timing state.
 * SignalR sends incremental delta updates that must be deep-merged
 * into the full state to produce a complete picture.
 */

export interface F1State {
  TimingData: Record<string, unknown>;
  TimingStats: Record<string, unknown>;
  TimingAppData: Record<string, unknown>;
  CarData: unknown;
  Position: unknown;
  WeatherData: Record<string, unknown>;
  WeatherDataSeries: Record<string, unknown>;
  TrackStatus: Record<string, unknown>;
  DriverList: Record<string, unknown>;
  RaceControlMessages: Record<string, unknown>;
  SessionInfo: Record<string, unknown>;
  SessionData: Record<string, unknown>;
  SessionStatus: Record<string, unknown>;
  ExtrapolatedClock: Record<string, unknown>;
  LapCount: Record<string, unknown>;
  TopThree: Record<string, unknown>;
  TeamRadio: Record<string, unknown>;
  PitLaneTimeCollection: Record<string, unknown>;
  ChampionshipPrediction: Record<string, unknown>;
  DriverRaceInfo: Record<string, unknown>;
  TyreStintSeries: Record<string, unknown>;
  CurrentTyres: Record<string, unknown>;
  Heartbeat: unknown;
  _lastUpdate: number;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

/**
 * Deep merge source into target, mutating target in place.
 * This is how F1 SignalR delta updates work — nested partial updates
 * that must be merged into the accumulated state.
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];

    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      deepMerge(tgtVal, srcVal);
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}

export class StateManager {
  private state: F1State = {
    TimingData: {},
    TimingStats: {},
    TimingAppData: {},
    CarData: null,
    Position: null,
    WeatherData: {},
    WeatherDataSeries: {},
    TrackStatus: {},
    DriverList: {},
    RaceControlMessages: {},
    SessionInfo: {},
    SessionData: {},
    SessionStatus: {},
    ExtrapolatedClock: {},
    LapCount: {},
    TopThree: {},
    TeamRadio: {},
    PitLaneTimeCollection: {},
    ChampionshipPrediction: {},
    DriverRaceInfo: {},
    TyreStintSeries: {},
    CurrentTyres: {},
    Heartbeat: null,
    _lastUpdate: 0,
  };

  /**
   * Process an incoming data update for a topic.
   * For object-based topics, deep-merge the delta.
   * For array/primitive topics, replace entirely.
   */
  update(topic: string, data: unknown): void {
    const key = topic as keyof F1State;

    if (key === "_lastUpdate") return;

    if (isPlainObject(data) && isPlainObject(this.state[key])) {
      deepMerge(
        this.state[key] as Record<string, unknown>,
        data as Record<string, unknown>,
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.state as any)[key] = data;
    }

    this.state._lastUpdate = Date.now();
  }

  /**
   * Get the full accumulated state.
   */
  getState(): F1State {
    return this.state;
  }

  /**
   * Reset all state (e.g., on session change).
   */
  reset(): void {
    this.state = {
      TimingData: {},
      TimingStats: {},
      TimingAppData: {},
      CarData: null,
      Position: null,
      WeatherData: {},
      WeatherDataSeries: {},
      TrackStatus: {},
      DriverList: {},
      RaceControlMessages: {},
      SessionInfo: {},
      SessionData: {},
      SessionStatus: {},
      ExtrapolatedClock: {},
      LapCount: {},
      TopThree: {},
      TeamRadio: {},
      PitLaneTimeCollection: {},
      ChampionshipPrediction: {},
      DriverRaceInfo: {},
      TyreStintSeries: {},
      CurrentTyres: {},
      Heartbeat: null,
      _lastUpdate: 0,
    };
  }

  /**
   * Check if we have any meaningful data.
   */
  hasData(): boolean {
    return (
      Object.keys(this.state.DriverList).length > 0 ||
      Object.keys(this.state.TimingData).length > 0
    );
  }
}
