/**
 * Mapping from Ergast/Jolpica circuit IDs to MultiViewer circuit keys
 * used by the TrackMap component.
 */
export const CIRCUIT_KEY_MAP: Record<string, number> = {
  albert_park: 10,
  shanghai: 49,
  suzuka: 46,
  bahrain: 63,
  sakhir: 63,
  jeddah: 149,
  jeddah_corniche_circuit: 149,
  miami: 151,
  villeneuve: 23,
  monaco: 22,
  catalunya: 15,
  red_bull_ring: 19,
  silverstone: 2,
  spa: 7,
  hungaroring: 4,
  zandvoort: 55,
  monza: 39,
  madring: 153,
  baku: 144,
  marina_bay: 61,
  americas: 9,
  rodriguez: 65,
  interlagos: 14,
  vegas: 152,
  losail: 150,
  yas_marina: 70,
  imola: 6,
  portimao: 26,
  istanbul_park: 109,
  mugello: 127,
  nurburgring: 123,
};

export function getCircuitKey(circuitId: string): number | null {
  return CIRCUIT_KEY_MAP[circuitId] ?? null;
}
