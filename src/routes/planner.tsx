import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Flame, Pause, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shell, Metric } from "@/components/Shell";
import { MapLegend, TrafficMap } from "@/components/TrafficMap";
import { JunctionEditor } from "@/components/JunctionEditor";
import {
  CORRIDORS,
  JUNCTIONS,
  PRESETS,
  ZONE_LABEL,
  defaultSimInput,
  junctionById,
  simulate,
  type DayKey,
  type SimInput,
  type VehicleMix,
  type Weather,
  type Zone,
} from "@/lib/traffic";
import { ROLE_LABEL, isActive, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Planner Dashboard — Peak-Hour Traffic Simulation" },
      {
        name: "description",
        content:
          "Run peak-hour signal simulations, compare current and rebalanced plans, model what-if closures and export corridor reports.",
      },
      { property: "og:title", content: "Planner Dashboard — Peak-Hour Traffic Simulation" },
      {
        property: "og:description",
        content:
          "Signal-timing simulation, congestion heatmaps and corridor analytics for planning authorities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlannerView,
});

function PlannerView() {
  const { user, state, ready } = useApp();
  const navigate = useNavigate();
  const [input, setInput] = useState<SimInput>(() => defaultSimInput("morning"));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [progress, setProgress] = useState(0);
  const [heatmap, setHeatmap] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoneA, setZoneA] = useState<Zone>("central");
  const [zoneB, setZoneB] = useState<Zone>("east");

  const allowed = user?.role === "authority" || user?.role === "police";

  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth" });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setProgress((p) => (p >= 1 ? 0 : p + 0.004 * speed));
    }, 40);
    return () => clearInterval(t);
  }, [playing, speed]);

  const live = { ...input, greenOverrides: { ...input.greenOverrides, ...state.overrides } };
  const before = useMemo(() => simulate(live, "base"), [JSON.stringify(live)]);
  const after = useMemo(() => simulate(live, "rebalanced"), [JSON.stringify(live)]);

  const waitDelta = before.avgWait - after.avgWait;
  const savedPct = (waitDelta / before.avgWait) * 100;

  useEffect(() => {
    if (savedPct > 12) {
      toast.success(`Quick win: rebalanced plan cuts average wait ${savedPct.toFixed(0)}%`, {
        id: "quickwin",
        description: `≈ ${Math.round(waitDelta)}s per vehicle across ${JUNCTIONS.length} junctions.`,
      });
    }
  }, [Math.round(savedPct)]);

  const active = state.reports.filter(isActive);
  const overrideCorridors = active.map((r) => r.corridorId).filter(Boolean) as string[];

  const corridorRanking = [...CORRIDORS]
    .map((c) => ({ c, r: before.corridors[c.id]! }))
    .sort((x, y) => y.r.load - x.r.load)
    .slice(0, 5);

  const chartData = JUNCTIONS.map((j) => ({
    name: j.id,
    current: before.junctions[j.id]!.waitSeconds,
    rebalanced: after.junctions[j.id]!.waitSeconds,
  }));

  const zoneStats = (z: Zone) => {
    const js = JUNCTIONS.filter((j) => j.zone === z);
    const c = js.reduce((s, j) => s + before.junctions[j.id]!.congestion, 0) / js.length;
    const w = js.reduce((s, j) => s + before.junctions[j.id]!.waitSeconds, 0) / js.length;
    const t = js.reduce((s, j) => s + before.junctions[j.id]!.throughput, 0);
    return { junctions: js.length, congestion: c, wait: w, throughput: t };
  };

  function exportCsv() {
    const rows = [
      ["junction", "name", "zone", "green_s", "wait_s_current", "wait_s_rebalanced", "congestion_pct", "throughput_vph"],
      ...JUNCTIONS.map((j) => [
        j.id,
        j.name,
        ZONE_LABEL[j.zone],
        String(before.junctions[j.id]!.green),
        String(before.junctions[j.id]!.waitSeconds),
        String(after.junctions[j.id]!.waitSeconds),
        String(Math.round(before.junctions[j.id]!.congestion * 100)),
        String(before.junctions[j.id]!.throughput),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowguard-sim-${input.start}-${input.end}h.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Simulation report exported (CSV)");
  }

  if (!user) return null;

  return (
    <Shell
      right={
        <Badge variant="outline" className="hidden sm:inline-flex">
          {ROLE_LABEL[user.role]}
        </Badge>
      }
    >
      <div className="grid min-h-0 flex-1 xl:grid-cols-[300px_1fr_340px]">
        {/* controls rail */}
        <aside className="space-y-4 overflow-y-auto border-b border-border bg-surface p-4 xl:border-b-0 xl:border-r">
          <div>
            <h1 className="text-sm font-semibold">Simulation window</h1>
            <div className="mt-2 flex gap-2">
              {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={
                    input.start === PRESETS[k].start && input.end === PRESETS[k].end
                      ? "default"
                      : "outline"
                  }
                  className="flex-1 text-xs"
                  onClick={() =>
                    setInput({ ...input, start: PRESETS[k].start, end: PRESETS[k].end })
                  }
                >
                  {PRESETS[k].start > 12 ? "4–7 PM" : "9–12 AM"}
                </Button>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Custom range</span>
                <span className="num">
                  {String(input.start).padStart(2, "0")}:00 – {String(input.end).padStart(2, "0")}:00
                </span>
              </div>
              <Slider
                className="mt-2"
                value={[input.start, input.end]}
                min={5}
                max={23}
                step={1}
                onValueChange={([s, e]) =>
                  setInput({ ...input, start: s ?? 9, end: Math.max((s ?? 9) + 1, e ?? 12) })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Field label="Day">
              <Select
                value={input.day}
                onValueChange={(v) => setInput({ ...input, day: v as DayKey })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekday">Weekday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Weather">
              <Select
                value={input.weather}
                onValueChange={(v) => setInput({ ...input, weather: v as Weather })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">Clear</SelectItem>
                  <SelectItem value="rain">Rain</SelectItem>
                  <SelectItem value="fog">Fog</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vehicle class">
              <Select
                value={input.vehicles}
                onValueChange={(v) => setInput({ ...input, vehicles: v as VehicleMix })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vehicles</SelectItem>
                  <SelectItem value="cars">Cars</SelectItem>
                  <SelectItem value="twowheeler">Two-wheelers</SelectItem>
                  <SelectItem value="freight">Freight</SelectItem>
                  <SelectItem value="transit">Buses / transit</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="panel space-y-3 p-3">
            <div className="label-xs">What-if scenario</div>
            <Field label="Close a corridor">
              <Select
                value={input.closedCorridors[0] ?? "none"}
                onValueChange={(v) =>
                  setInput({ ...input, closedCorridors: v === "none" ? [] : [v] })
                }
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No closure</SelectItem>
                  {CORRIDORS.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Divert {ZONE_LABEL[zoneA]} → {ZONE_LABEL[zoneB]}</span>
                <span className="num">{input.divert?.pct ?? 0}%</span>
              </div>
              <Slider
                className="mt-2"
                value={[input.divert?.pct ?? 0]}
                min={0}
                max={40}
                step={5}
                onValueChange={([v]) =>
                  setInput({
                    ...input,
                    divert: v ? { from: zoneA, to: zoneB, pct: v } : null,
                  })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="heat" className="flex items-center gap-1.5 text-xs">
              <Flame className="h-3.5 w-3.5 text-peak" /> Hotspot heatmap
            </Label>
            <Switch id="heat" checked={heatmap} onCheckedChange={setHeatmap} />
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export report (CSV)
          </Button>
        </aside>

        {/* map + metrics */}
        <section className="flex min-h-0 flex-col">
          <div className="grid grid-cols-2 gap-2 border-b border-border p-3 lg:grid-cols-4">
            <Metric label="Active incidents" value={active.length} tone={active.length ? "critical" : "default"} />
            <Metric
              label="City congestion"
              value={`${Math.round(before.congestionIndex * 100)}%`}
              tone={before.congestionIndex > 0.6 ? "peak" : "flow"}
            />
            <Metric
              label="Junctions in peak mode"
              value={JUNCTIONS.filter((j) => before.junctions[j.id]!.congestion > 0.5).length}
              unit={`of ${JUNCTIONS.length}`}
            />
            <Metric
              label="Time saved (simulated)"
              value={`${Math.max(0, Math.round(waitDelta))}s`}
              unit="per vehicle"
              tone="flow"
              delta={`${savedPct > 0 ? "−" : "+"}${Math.abs(savedPct).toFixed(1)}% average wait`}
            />
          </div>

          <div className="relative min-h-[46vh] flex-1 border-b border-border">
            <TrafficMap
              result={before}
              heatmap={heatmap}
              reports={active}
              overrideCorridors={overrideCorridors}
              selected={selected}
              onSelectJunction={setSelected}
              playhead={progress * 12}
            />
            <div className="panel absolute bottom-3 left-3 flex items-center gap-3 px-3 py-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause simulation" : "Run simulation"}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <div className="w-40">
                <Slider
                  value={[progress * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setProgress((v ?? 0) / 100)}
                />
              </div>
              <span className="num text-xs text-muted-foreground">
                {clockAt(input.start, input.end, progress)}
              </span>
              <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
                <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0.5, 1, 2, 4].map((s) => (
                    <SelectItem key={s} value={String(s)} className="text-xs">
                      {s}×
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="panel absolute right-3 top-3 px-3 py-2">
              <MapLegend />
            </div>
          </div>

          <div className="grid gap-3 p-3 lg:grid-cols-2">
            <div className="panel p-3">
              <div className="label-xs">Average wait per junction — current vs rebalanced (s)</div>
              <div className="mt-2 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={36} unit="s" />
                    <Tooltip
                      cursor={{ fill: "var(--accent)" }}
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="current" name="Current plan" fill="var(--peak)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="rebalanced" name="Rebalanced" fill="var(--flow)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-3">
              <div className="label-xs">Zone comparison</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  [zoneA, setZoneA] as const,
                  [zoneB, setZoneB] as const,
                ].map(([z, set], i) => {
                  const s = zoneStats(z);
                  return (
                    <div key={i} className="rounded-sm border border-border p-2">
                      <Select value={z} onValueChange={(v) => set(v as Zone)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ZONE_LABEL) as Zone[]).map((k) => (
                            <SelectItem key={k} value={k} className="text-xs">
                              {ZONE_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <dl className="mt-2 space-y-1 text-[11px]">
                        <Line k="Junctions" v={String(s.junctions)} />
                        <Line k="Congestion" v={`${Math.round(s.congestion * 100)}%`} />
                        <Line k="Avg wait" v={`${Math.round(s.wait)}s`} />
                        <Line k="Throughput" v={`${s.throughput.toLocaleString()} veh/h`} />
                      </dl>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* detail rail */}
        <aside className="min-h-0 overflow-y-auto border-t border-border bg-surface xl:border-l xl:border-t-0">
          {selected ? (
            <JunctionEditor
              junctionId={selected}
              input={live}
              canEdit={Boolean(allowed)}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="space-y-4 p-4">
              <div>
                <h2 className="text-sm font-semibold">Top 5 congested corridors</h2>
                <ul className="mt-2 space-y-1.5">
                  {corridorRanking.map(({ c, r }, i) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelected(c.from)}
                        className="panel w-full p-2.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="num text-[11px] text-muted-foreground">#{i + 1}</span>
                          <span
                            className={cn(
                              "num text-xs font-semibold",
                              r.load >= 0.75 ? "text-critical" : r.load >= 0.5 ? "text-peak" : "text-flow",
                            )}
                          >
                            {Math.round(r.load * 100)}%
                          </span>
                        </div>
                        <div className="truncate text-sm">{c.name}</div>
                        <div className="num text-[11px] text-muted-foreground">
                          {r.speedKph} km/h · {r.volume.toLocaleString()} veh/h ·{" "}
                          {junctionById(c.from)!.id}–{junctionById(c.to)!.id}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Manual override log
                </h2>
                {state.edits.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No manual signal edits yet. Click a junction on the map to adjust its green
                    phase.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {state.edits.slice(0, 8).map((e) => (
                      <li key={e.id} className="panel p-2.5 text-[11px]">
                        <div className="text-sm">{junctionById(e.junctionId)?.name}</div>
                        <div className="num text-muted-foreground">
                          {e.from}s → {e.to}s · {ROLE_LABEL[e.role]} · {e.by}
                        </div>
                        <div className="num text-muted-foreground">
                          {new Date(e.at).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Simulation runs client-side on a synthetic network model. Connect a backend for live
                ATCS feeds, persisted plans and shared override logs.
              </p>
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-xs mb-1">{label}</div>
      {children}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}

function clockAt(start: number, end: number, p: number) {
  const t = start + (end - start) * p;
  const h = Math.floor(t);
  const m = Math.floor((t - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
