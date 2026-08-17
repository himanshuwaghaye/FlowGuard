import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  historyFor,
  junctionById,
  neighbours,
  simulate,
  type SimInput,
} from "@/lib/traffic";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Lock, ShieldAlert, Sparkles, Sliders, CheckCircle2, ArrowRight } from "lucide-react";

const MIN_GREEN = 15;
const MAX_GREEN = 90;

export function JunctionEditor({
  junctionId,
  input,
  canEdit,
  onClose,
}: {
  junctionId: string;
  input: SimInput;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { state, setOverride, clearOverride, user } = useApp();
  const junction = junctionById(junctionId);

  if (!junction) return null;

  const current = state.overrides[junctionId] ?? junction.baseGreen;
  const [draft, setDraft] = useState(current);
  const [reason, setReason] = useState("Peak traffic volume regulation");

  // Directional phases
  const [northGreen, setNorthGreen] = useState(junction.directions.north);
  const [southGreen, setSouthGreen] = useState(junction.directions.south);
  const [eastGreen, setEastGreen] = useState(junction.directions.east);
  const [westGreen, setWestGreen] = useState(junction.directions.west);

  const before = useMemo(() => simulate(input, "base"), [input]);
  const after = useMemo(
    () =>
      simulate(
        { ...input, greenOverrides: { ...input.greenOverrides, [junctionId]: draft } },
        "base",
      ),
    [input, junctionId, draft],
  );

  const b = before.junctions[junctionId] ?? { congestion: 0.3, waitSeconds: 30, throughput: 1500, green: 40 };
  const a = after.junctions[junctionId] ?? { congestion: 0.3, waitSeconds: 30, throughput: 1500, green: draft };
  const delta = a.waitSeconds - b.waitSeconds;

  const ripple = neighbours(junctionId)
    .map((id) => ({
      id,
      name: junctionById(id)?.name ?? id,
      delta: (after.junctions[id]?.waitSeconds ?? 30) - (before.junctions[id]?.waitSeconds ?? 30),
    }))
    .filter((r) => Math.abs(r.delta) >= 1);

  const history = historyFor(junctionId, input.start);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="label-xs">{junction.id} · Nagpur Signal Node</span>
          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/30">
            {junction.zone.toUpperCase()}
          </Badge>
        </div>
        <h2 className="mt-1 text-base font-semibold leading-tight text-foreground">{junction.name}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{junction.ward}</p>
        {junction.landmark && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80 italic">📍 {junction.landmark}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Congestion" value={`${Math.round(b.congestion * 100)}%`} />
        <Stat label="Avg wait" value={`${b.waitSeconds}s`} />
        <Stat label="Throughput" value={`${b.throughput.toLocaleString()}`} unit="veh/h" />
      </div>

      <div>
        <div className="label-xs mb-1">Today's Congestion Trend (%)</div>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--peak)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--peak)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                interval={2}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}%`, "congestion"]}
              />
              <Area
                type="monotone"
                dataKey="congestion"
                stroke="var(--peak)"
                strokeWidth={1.5}
                fill="url(#trend)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-primary" />
            <span className="label-xs">Green Phase Timing</span>
          </div>
          <span className="num text-sm font-bold text-primary">{draft}s</span>
        </div>

        <Slider
          className="mt-1"
          value={[draft]}
          min={MIN_GREEN}
          max={MAX_GREEN}
          step={1}
          disabled={!canEdit}
          onValueChange={([v]) => {
            if (v !== undefined) {
              setDraft(v);
              // Scale directional phases proportionally
              const ratio = v / (current || 40);
              setNorthGreen(Math.round(junction.directions.north * ratio));
              setSouthGreen(Math.round(junction.directions.south * ratio));
              setEastGreen(Math.round(junction.directions.east * ratio));
              setWestGreen(Math.round(junction.directions.west * ratio));
            }
          }}
        />
        <div className="num flex justify-between text-[10px] text-muted-foreground">
          <span>{MIN_GREEN}s min</span>
          <span>Base: {junction.baseGreen}s</span>
          <span>{MAX_GREEN}s max</span>
        </div>

        {/* Directional Signal Allocations */}
        <div className="border-t border-border/60 pt-2.5">
          <div className="label-xs mb-2">Directional Signal Duration</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-background/60 p-2 border border-border">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>North Spine</span>
                <span className="font-semibold text-foreground">{northGreen}s</span>
              </div>
              <Slider
                className="mt-1.5"
                value={[northGreen]}
                min={10}
                max={75}
                disabled={!canEdit}
                onValueChange={([v]) => v && setNorthGreen(v)}
              />
            </div>
            <div className="rounded bg-background/60 p-2 border border-border">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>South Radial</span>
                <span className="font-semibold text-foreground">{southGreen}s</span>
              </div>
              <Slider
                className="mt-1.5"
                value={[southGreen]}
                min={10}
                max={75}
                disabled={!canEdit}
                onValueChange={([v]) => v && setSouthGreen(v)}
              />
            </div>
            <div className="rounded bg-background/60 p-2 border border-border">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>East Arterial</span>
                <span className="font-semibold text-foreground">{eastGreen}s</span>
              </div>
              <Slider
                className="mt-1.5"
                value={[eastGreen]}
                min={10}
                max={75}
                disabled={!canEdit}
                onValueChange={([v]) => v && setEastGreen(v)}
              />
            </div>
            <div className="rounded bg-background/60 p-2 border border-border">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>West Arterial</span>
                <span className="font-semibold text-foreground">{westGreen}s</span>
              </div>
              <Slider
                className="mt-1.5"
                value={[westGreen]}
                min={10}
                max={75}
                disabled={!canEdit}
                onValueChange={([v]) => v && setWestGreen(v)}
              />
            </div>
          </div>
        </div>

        {/* Before vs After Impact */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-sm border border-border p-2">
            <div className="label-xs">Current Wait</div>
            <div className="num mt-0.5 text-sm font-semibold">{b.waitSeconds}s</div>
          </div>
          <div
            className={cn(
              "rounded-sm border p-2",
              delta < 0 ? "border-flow/60 bg-flow/10" : delta > 0 ? "border-critical/50 bg-critical/10" : "border-border",
            )}
          >
            <div className="label-xs">Simulated Outcome</div>
            <div className="num mt-0.5 text-sm font-semibold">
              {a.waitSeconds}s wait{" "}
              <span className={delta < 0 ? "text-flow" : delta > 0 ? "text-critical" : ""}>
                ({delta > 0 ? "+" : ""}
                {delta}s)
              </span>
            </div>
          </div>
        </div>

        {/* Ripple Effect to Connected Nagpur Junctions */}
        {ripple.length > 0 && (
          <div className="pt-1">
            <div className="label-xs">Ripple Effect on Connected Corridors</div>
            <ul className="mt-1.5 space-y-1 max-h-24 overflow-y-auto">
              {ripple.map((r) => (
                <li key={r.id} className="flex justify-between text-[11px] bg-background/40 px-2 py-1 rounded">
                  <span className="truncate text-muted-foreground">{r.name}</span>
                  <span className={cn("num font-semibold", r.delta > 0 ? "text-critical" : "text-flow")}>
                    {r.delta > 0 ? "+" : ""}
                    {r.delta}s wait
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Role-Specific Action or Read-Only Notice */}
        {canEdit ? (
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div>
              <label className="label-xs">Reason for Override (Logged to Audit)</label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., VIP Corridor, Peak Congestion Flush"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 text-xs"
                disabled={draft === current && state.overrides[junctionId] !== undefined}
                onClick={() => {
                  setOverride(junctionId, draft, reason, {
                    north: northGreen,
                    south: southGreen,
                    east: eastGreen,
                    west: westGreen,
                  });
                  toast.success(`${junction.name}: Signal updated to ${draft}s`, {
                    description:
                      delta < 0
                        ? `Expected ~${Math.abs(delta)}s lower wait time per vehicle.`
                        : "Timing adjustment logged in Planning Authority audit.",
                  });
                }}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Apply Signal Plan
              </Button>
              {state.overrides[junctionId] !== undefined && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    clearOverride(junctionId);
                    setDraft(junction.baseGreen);
                    setNorthGreen(junction.directions.north);
                    setSouthGreen(junction.directions.south);
                    setEastGreen(junction.directions.east);
                    setWestGreen(junction.directions.west);
                    toast.info("Reverted to base municipal signal plan.");
                  }}
                >
                  Revert
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded border border-border bg-background/50 p-2.5 text-xs text-muted-foreground flex items-start gap-2">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Read-Only Signal View:</span> Only authorized{" "}
              <span className="font-medium text-foreground">Nagpur Traffic Police</span> and{" "}
              <span className="font-medium text-foreground">Planning Authority</span> officers can edit junction wait times.
            </div>
          </div>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onClose} className="mt-auto">
        Close Inspector
      </Button>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="panel p-2">
      <div className="label-xs">{label}</div>
      <div className="num mt-0.5 text-sm font-semibold">
        {value}
        {unit && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

