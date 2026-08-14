import { useMemo } from "react";
import {
  CORRIDORS,
  JUNCTIONS,
  corridorBetween,
  junctionById,
  type SimResult,
} from "@/lib/traffic";
import type { SosReport } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  result: SimResult;
  selected?: string | null;
  onSelectJunction?: (id: string) => void;
  onPinDrop?: (x: number, y: number) => void;
  heatmap?: boolean;
  reports?: SosReport[];
  overrideCorridors?: string[];
  reroute?: string[]; // junction path
  playhead?: number; // 0..1 animates flow dashes
  className?: string;
}

const loadColor = (load: number) =>
  load >= 0.75 ? "var(--critical)" : load >= 0.5 ? "var(--peak)" : "var(--flow)";

export function TrafficMap({
  result,
  selected,
  onSelectJunction,
  onPinDrop,
  heatmap = false,
  reports = [],
  overrideCorridors = [],
  reroute = [],
  playhead = 0,
  className,
}: Props) {
  const reroutePairs = useMemo(() => {
    const ids: string[] = [];
    for (let i = 0; i < reroute.length - 1; i++) {
      const c = corridorBetween(reroute[i]!, reroute[i + 1]!);
      if (c) ids.push(c.id);
    }
    return ids;
  }, [reroute]);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full touch-manipulation select-none", className)}
      role="img"
      aria-label="Live traffic network map"
      onClick={(e) => {
        if (!onPinDrop) return;
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = ((e.clientX - rect.left - (rect.width - size) / 2) / size) * 100;
        const y = ((e.clientY - rect.top - (rect.height - size) / 2) / size) * 100;
        onPinDrop(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
      }}
    >
      <defs>
        <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M5 0 L0 0 0 5" fill="none" stroke="var(--grid)" strokeWidth="0.12" />
        </pattern>
        <radialGradient id="heat">
          <stop offset="0%" stopColor="var(--critical)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--critical)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" fill="var(--background)" />
      <rect width="100" height="100" fill="url(#grid)" />

      {/* river / civic geography */}
      <path
        d="M-2 82 C 18 74, 30 92, 52 86 C 74 80, 84 96, 104 90"
        fill="none"
        stroke="oklch(0.34 0.04 230)"
        strokeWidth="2.6"
        opacity="0.7"
      />

      {heatmap &&
        JUNCTIONS.map((j) => {
          const c = result.junctions[j.id]?.congestion ?? 0;
          return (
            <circle
              key={`h-${j.id}`}
              cx={j.x}
              cy={j.y}
              r={4 + c * 14}
              fill="url(#heat)"
              opacity={c}
              className="transition-opacity duration-500"
            />
          );
        })}

      {CORRIDORS.map((c) => {
        const a = junctionById(c.from)!;
        const b = junctionById(c.to)!;
        const r = result.corridors[c.id]!;
        const overridden = overrideCorridors.includes(c.id);
        const onReroute = reroutePairs.includes(c.id);
        const closed = r.volume === 0;
        return (
          <g key={c.id}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="oklch(0.28 0.012 250)"
              strokeWidth={c.lanes * 0.55 + 1.1}
              strokeLinecap="round"
            />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={closed ? "var(--muted-foreground)" : loadColor(r.load)}
              strokeWidth={c.lanes * 0.42 + 0.5}
              strokeLinecap="round"
              strokeDasharray={closed ? "1 1.4" : "2.2 2.4"}
              strokeDashoffset={-playhead * 40 * (1 - r.load * 0.6)}
              opacity={closed ? 0.5 : 0.95}
              className="transition-[stroke] duration-500"
            />
            {overridden && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--critical)"
                strokeWidth={c.lanes * 0.7 + 1.6}
                strokeLinecap="round"
                opacity="0.32"
              />
            )}
            {onReroute && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--primary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="3 2"
                strokeDashoffset={-playhead * 30}
              />
            )}
          </g>
        );
      })}

      {JUNCTIONS.map((j) => {
        const r = result.junctions[j.id]!;
        const isSel = selected === j.id;
        return (
          <g
            key={j.id}
            className={onSelectJunction ? "cursor-pointer" : ""}
            onClick={(e) => {
              e.stopPropagation();
              onSelectJunction?.(j.id);
            }}
          >
            {isSel && <circle cx={j.x} cy={j.y} r="3.6" fill="var(--primary)" opacity="0.22" />}
            <circle
              cx={j.x}
              cy={j.y}
              r="2"
              fill="var(--surface)"
              stroke={loadColor(r.congestion)}
              strokeWidth="0.85"
              className="transition-[stroke] duration-500"
            />
            <circle cx={j.x} cy={j.y} r="0.7" fill={loadColor(r.congestion)} />
            <text
              x={j.x}
              y={j.y - 2.9}
              textAnchor="middle"
              fontSize="1.9"
              fill="var(--muted-foreground)"
              className="pointer-events-none font-medium"
            >
              {j.id}
            </text>
          </g>
        );
      })}

      {reports.map((s) => (
        <g key={s.id} className="pointer-events-none">
          <circle cx={s.x} cy={s.y} r="3.4" fill="var(--critical)" opacity="0.2">
            <animate attributeName="r" values="2.6;5.2;2.6" dur="2s" repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0.3;0.02;0.3"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
          <path
            d={`M${s.x} ${s.y - 3.2} L${s.x + 2.6} ${s.y + 1.6} L${s.x - 2.6} ${s.y + 1.6} Z`}
            fill="var(--critical)"
            stroke="var(--critical-foreground)"
            strokeWidth="0.25"
          />
        </g>
      ))}
    </svg>
  );
}

export function MapLegend({ className }: { className?: string }) {
  const items = [
    { c: "var(--flow)", l: "Free flow" },
    { c: "var(--peak)", l: "Peak-hour load" },
    { c: "var(--critical)", l: "Congested / override" },
    { c: "var(--primary)", l: "Suggested reroute" },
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((i) => (
        <span key={i.l} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: i.c }} />
          {i.l}
        </span>
      ))}
    </div>
  );
}
