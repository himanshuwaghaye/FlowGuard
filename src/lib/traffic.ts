/**
 * FlowGuard traffic model + simulation engine.
 *
 * NOTE: the network topology and demand profiles below are a realistic
 * synthetic dataset. Swap `NETWORK` for live sensor/ATCS feeds when a
 * backend is connected.
 */

export type Zone = "north" | "central" | "east" | "south" | "west";

export interface Junction {
  id: string;
  name: string;
  zone: Zone;
  x: number; // 0-100 map space
  y: number;
  baseGreen: number; // seconds of green in the base plan
  demand: number; // relative vehicle demand 0.4 - 1.6
}

export interface Corridor {
  id: string;
  name: string;
  from: string;
  to: string;
  lanes: number;
  highway: boolean;
  capacity: number; // vehicles / hour
}

export const ZONE_LABEL: Record<Zone, string> = {
  north: "North Sector",
  central: "Central Business District",
  east: "East Industrial Belt",
  south: "South Ring",
  west: "West Corridor",
};

export const JUNCTIONS: Junction[] = [
  { id: "J1", name: "Ring Road / Sector 9", zone: "north", x: 22, y: 14, baseGreen: 38, demand: 1.15 },
  { id: "J2", name: "Civic Center Chowk", zone: "central", x: 48, y: 26, baseGreen: 45, demand: 1.5 },
  { id: "J3", name: "Station Approach", zone: "central", x: 68, y: 18, baseGreen: 40, demand: 1.35 },
  { id: "J4", name: "Mill Gate Junction", zone: "east", x: 84, y: 40, baseGreen: 32, demand: 1.1 },
  { id: "J5", name: "Grand Trunk Flyover", zone: "central", x: 50, y: 50, baseGreen: 52, demand: 1.6 },
  { id: "J6", name: "Old Market Cross", zone: "west", x: 20, y: 44, baseGreen: 30, demand: 0.95 },
  { id: "J7", name: "Riverside Bypass", zone: "west", x: 14, y: 70, baseGreen: 36, demand: 0.8 },
  { id: "J8", name: "Southgate Interchange", zone: "south", x: 44, y: 78, baseGreen: 48, demand: 1.3 },
  { id: "J9", name: "Tech Park Loop", zone: "east", x: 78, y: 68, baseGreen: 42, demand: 1.25 },
  { id: "J10", name: "Hospital Road Signal", zone: "south", x: 64, y: 88, baseGreen: 28, demand: 0.75 },
  { id: "J11", name: "North Toll Plaza", zone: "north", x: 40, y: 8, baseGreen: 34, demand: 0.9 },
  { id: "J12", name: "Depot Circle", zone: "east", x: 90, y: 58, baseGreen: 26, demand: 0.7 },
];

export const CORRIDORS: Corridor[] = [
  { id: "C1", name: "NH-48 Ring Arterial", from: "J1", to: "J11", lanes: 3, highway: true, capacity: 5200 },
  { id: "C2", name: "Civic Avenue", from: "J11", to: "J2", lanes: 3, highway: false, capacity: 4200 },
  { id: "C3", name: "Station Link Road", from: "J2", to: "J3", lanes: 2, highway: false, capacity: 3200 },
  { id: "C4", name: "East Industrial Way", from: "J3", to: "J4", lanes: 3, highway: true, capacity: 4800 },
  { id: "C5", name: "Grand Trunk Road", from: "J2", to: "J5", lanes: 4, highway: true, capacity: 6000 },
  { id: "C6", name: "Market Spur", from: "J6", to: "J5", lanes: 2, highway: false, capacity: 2600 },
  { id: "C7", name: "Ring Road West", from: "J1", to: "J6", lanes: 2, highway: false, capacity: 3000 },
  { id: "C8", name: "Riverside Drive", from: "J6", to: "J7", lanes: 2, highway: false, capacity: 2400 },
  { id: "C9", name: "South Ring Expressway", from: "J7", to: "J8", lanes: 3, highway: true, capacity: 5000 },
  { id: "C10", name: "Southgate Radial", from: "J5", to: "J8", lanes: 3, highway: false, capacity: 4400 },
  { id: "C11", name: "Tech Park Feeder", from: "J5", to: "J9", lanes: 2, highway: false, capacity: 3400 },
  { id: "C12", name: "Mill Gate Descent", from: "J4", to: "J9", lanes: 2, highway: false, capacity: 3000 },
  { id: "C13", name: "Hospital Access Road", from: "J8", to: "J10", lanes: 2, highway: false, capacity: 2200 },
  { id: "C14", name: "Depot Connector", from: "J9", to: "J12", lanes: 2, highway: false, capacity: 2000 },
  { id: "C15", name: "Outer Loop South", from: "J10", to: "J9", lanes: 2, highway: false, capacity: 2600 },
  { id: "C16", name: "Depot–Mill Link", from: "J12", to: "J4", lanes: 2, highway: false, capacity: 2100 },
];

export const junctionById = (id: string) => JUNCTIONS.find((j) => j.id === id);

export function neighbours(id: string): string[] {
  const out = new Set<string>();
  for (const c of CORRIDORS) {
    if (c.from === id) out.add(c.to);
    if (c.to === id) out.add(c.from);
  }
  return [...out];
}

/* ---------------------------------------------------------------- demand */

export const PRESETS = {
  morning: { label: "Morning peak", start: 9, end: 12 },
  evening: { label: "Evening peak", start: 16, end: 19 },
} as const;

export type DayKey = "weekday" | "saturday" | "sunday";
export type Weather = "clear" | "rain" | "fog";
export type VehicleMix = "all" | "cars" | "twowheeler" | "freight" | "transit";

export interface SimInput {
  start: number; // hour, e.g. 9
  end: number;
  day: DayKey;
  weather: Weather;
  vehicles: VehicleMix;
  greenOverrides: Record<string, number>;
  closedCorridors: string[];
  divert?: { from: Zone; to: Zone; pct: number } | null;
}

const DAY_FACTOR: Record<DayKey, number> = { weekday: 1, saturday: 0.78, sunday: 0.6 };
const WEATHER_FACTOR: Record<Weather, number> = { clear: 1, rain: 1.18, fog: 1.3 };
const VEHICLE_FACTOR: Record<VehicleMix, number> = {
  all: 1,
  cars: 0.62,
  twowheeler: 0.24,
  freight: 0.14,
  transit: 0.09,
};

/** Peak intensity curve across a 24h clock. */
export function hourIntensity(hour: number) {
  const m = Math.exp(-(((hour - 10.2) / 1.6) ** 2));
  const e = Math.exp(-(((hour - 17.8) / 1.7) ** 2));
  return 0.42 + 0.72 * m + 0.85 * e;
}

export interface JunctionResult {
  id: string;
  green: number;
  congestion: number; // 0-1
  waitSeconds: number;
  throughput: number; // veh/h
  queue: number;
}

export interface CorridorResult {
  id: string;
  load: number; // 0-1+
  speedKph: number;
  volume: number;
}

export interface SimResult {
  junctions: Record<string, JunctionResult>;
  corridors: Record<string, CorridorResult>;
  avgWait: number;
  congestionIndex: number;
  throughput: number;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/** Deterministic core model. `plan` = "base" (current) or "rebalanced". */
export function simulate(input: SimInput, plan: "base" | "rebalanced"): SimResult {
  const hours = Math.max(0.5, input.end - input.start);
  let intensity = 0;
  for (let h = input.start; h < input.end; h += 0.25) intensity += hourIntensity(h) * 0.25;
  intensity /= hours;

  const global =
    intensity *
    DAY_FACTOR[input.day] *
    WEATHER_FACTOR[input.weather] *
    VEHICLE_FACTOR[input.vehicles];

  // zone demand shifts from a "what-if" diversion
  const zoneShift: Partial<Record<Zone, number>> = {};
  if (input.divert && input.divert.pct > 0) {
    zoneShift[input.divert.from] = -input.divert.pct / 100;
    zoneShift[input.divert.to] = input.divert.pct / 100;
  }

  const closed = new Set(input.closedCorridors);

  // extra demand pushed onto neighbours of a closed corridor
  const spill: Record<string, number> = {};
  for (const c of CORRIDORS) {
    if (!closed.has(c.id)) continue;
    for (const n of [...neighbours(c.from), ...neighbours(c.to), c.from, c.to]) {
      spill[n] = (spill[n] ?? 0) + 0.12;
    }
  }

  const junctions: Record<string, JunctionResult> = {};
  for (const j of JUNCTIONS) {
    const shift = zoneShift[j.zone] ?? 0;
    const demand = j.demand * global * (1 + shift) * (1 + (spill[j.id] ?? 0));

    let green = input.greenOverrides[j.id] ?? j.baseGreen;
    if (plan === "rebalanced") {
      // proportional-to-demand reallocation, bounded to realistic phase lengths
      const target = clamp(j.baseGreen * (0.72 + 0.55 * demand), 15, 90);
      green = clamp((green + target * 2) / 3, 15, 90);
    }

    const cycle = 110;
    const capacityShare = green / cycle;
    const saturation = demand / (capacityShare * 2.1);
    const congestion = clamp(saturation / 1.6, 0.04, 1);
    // Webster-flavoured delay
    const wait = clamp(
      (cycle * (1 - capacityShare) ** 2) / (2 * (1 - Math.min(0.96, saturation * 0.55))) +
        congestion * 26,
      6,
      190,
    );
    const throughput = Math.round(1900 * capacityShare * clamp(1.65 - congestion, 0.35, 1.3) * 2.1);
    junctions[j.id] = {
      id: j.id,
      green: Math.round(green),
      congestion,
      waitSeconds: Math.round(wait),
      throughput,
      queue: Math.round(congestion * demand * 46),
    };
  }

  const corridors: Record<string, CorridorResult> = {};
  for (const c of CORRIDORS) {
    if (closed.has(c.id)) {
      corridors[c.id] = { id: c.id, load: 0, speedKph: 0, volume: 0 };
      continue;
    }
    const a = junctions[c.from]!;
    const b = junctions[c.to]!;
    const load = clamp((a.congestion + b.congestion) / 2 + (c.highway ? -0.06 : 0.04), 0.03, 1.25);
    const free = c.highway ? 80 : 48;
    corridors[c.id] = {
      id: c.id,
      load,
      speedKph: Math.round(clamp(free * (1 - 0.72 * load), 6, free)),
      volume: Math.round(c.capacity * clamp(load * 0.95, 0.05, 0.98)),
    };
  }

  const list = Object.values(junctions);
  return {
    junctions,
    corridors,
    avgWait: list.reduce((s, j) => s + j.waitSeconds, 0) / list.length,
    congestionIndex: list.reduce((s, j) => s + j.congestion, 0) / list.length,
    throughput: list.reduce((s, j) => s + j.throughput, 0),
  };
}

export function defaultSimInput(preset: keyof typeof PRESETS = "morning"): SimInput {
  return {
    start: PRESETS[preset].start,
    end: PRESETS[preset].end,
    day: "weekday",
    weather: "clear",
    vehicles: "all",
    greenOverrides: {},
    closedCorridors: [],
    divert: null,
  };
}

/** 7-day historical trend for a junction (synthetic but stable per id). */
export function historyFor(id: string, hour: number) {
  const seed = [...id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return Array.from({ length: 12 }, (_, i) => {
    const h = 7 + i;
    const wobble = ((Math.sin(seed * 0.7 + i * 1.3) + 1) / 2) * 0.18;
    const v = hourIntensity(h) * 0.55 + wobble;
    return {
      hour: `${String(h).padStart(2, "0")}:00`,
      congestion: Math.round(clamp(v, 0.05, 1) * 100),
      current: h === Math.floor(hour),
    };
  });
}

export function congestionTone(c: number) {
  if (c >= 0.75) return "critical" as const;
  if (c >= 0.5) return "peak" as const;
  return "flow" as const;
}

export function fmtWait(seconds: number) {
  return `${Math.round(seconds)}s`;
}

/** Cheap Dijkstra over corridors weighted by travel time. */
export function fastestRoute(
  from: string,
  to: string,
  result: SimResult,
  blocked: string[] = [],
): { path: string[]; minutes: number } {
  const blockedSet = new Set(blocked);
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set(JUNCTIONS.map((j) => j.id));
  for (const j of JUNCTIONS) dist[j.id] = Infinity;
  dist[from] = 0;

  while (unvisited.size) {
    let cur: string | null = null;
    for (const id of unvisited) if (cur === null || dist[id]! < dist[cur]!) cur = id;
    if (cur === null || dist[cur] === Infinity) break;
    unvisited.delete(cur);
    if (cur === to) break;
    for (const c of CORRIDORS) {
      if (blockedSet.has(c.id)) continue;
      const other = c.from === cur ? c.to : c.to === cur ? c.from : null;
      if (!other || !unvisited.has(other)) continue;
      const a = junctionById(c.from)!;
      const b = junctionById(c.to)!;
      const km = Math.hypot(a.x - b.x, a.y - b.y) * 0.32;
      const speed = Math.max(6, result.corridors[c.id]?.speedKph ?? 30);
      const cost = (km / speed) * 60 + (result.junctions[other]?.waitSeconds ?? 30) / 60;
      if (dist[cur]! + cost < dist[other]!) {
        dist[other] = dist[cur]! + cost;
        prev[other] = cur;
      }
    }
  }

  const path: string[] = [];
  let node: string | null = to;
  while (node) {
    path.unshift(node);
    node = prev[node] ?? null;
  }
  return { path: path[0] === from ? path : [], minutes: dist[to] === Infinity ? 0 : dist[to]! };
}

export function corridorBetween(a: string, b: string) {
  return CORRIDORS.find(
    (c) => (c.from === a && c.to === b) || (c.from === b && c.to === a),
  );
}
