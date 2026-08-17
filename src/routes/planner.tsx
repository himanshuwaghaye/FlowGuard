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
import { Download, Flame, Pause, Play, Sparkles, History, Search, RefreshCw, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
      { title: "FlowGuard Planner Dashboard — Nagpur Traffic Network Simulation" },
      {
        name: "description",
        content:
          "City-wide peak-hour signal simulation for 52+ Nagpur junctions, rebalanced timing models, what-if closures, and signal audit logs.",
      },
      { property: "og:title", content: "FlowGuard Planner Dashboard — Nagpur Traffic Network Simulation" },
      {
        property: "og:description",
        content:
          "Signal-timing simulation, congestion heatmaps, and corridor analytics for Nagpur planning authorities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlannerView,
});

function PlannerView() {
  const { user, state, ready, resetAllOverrides } = useApp();
  const navigate = useNavigate();
  const [input, setInput] = useState<SimInput>(() => defaultSimInput("morning"));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [progress, setProgress] = useState(0);
  const [heatmap, setHeatmap] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoneA, setZoneA] = useState<Zone>("central");
  const [zoneB, setZoneB] = useState<Zone>("west");
  const [chartZone, setChartZone] = useState<string>("all");
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

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
    if (savedPct > 10) {
      toast.success(`Simulation: rebalanced plan cuts average wait ${savedPct.toFixed(0)}%`, {
        id: "quickwin",
        description: `≈ ${Math.round(waitDelta)}s saved per vehicle across ${JUNCTIONS.length} Nagpur junctions.`,
      });
    }
  }, [Math.round(savedPct)]);

  const active = state.reports.filter(isActive);
  const overrideCorridors = active.map((r) => r.corridorId).filter(Boolean) as string[];

  const corridorRanking = [...CORRIDORS]
    .map((c) => ({ c, r: before.corridors[c.id] ?? { load: 0.3, speedKph: 45, volume: 1000 } }))
    .sort((x, y) => y.r.load - x.r.load)
    .slice(0, 6);

  const filteredJunctionsForChart = useMemo(() => {
    if (chartZone === "all") return JUNCTIONS.slice(0, 16);
    return JUNCTIONS.filter((j) => j.zone === chartZone);
  }, [chartZone]);

  const chartData = filteredJunctionsForChart.map((j) => ({
    name: j.id,
    fullName: j.name,
    current: before.junctions[j.id]?.waitSeconds ?? 30,
    rebalanced: after.junctions[j.id]?.waitSeconds ?? 25,
  }));

  const zoneStats = (z: Zone) => {
    const js = JUNCTIONS.filter((j) => j.zone === z);
    if (!js.length) return { junctions: 0, congestion: 0, wait: 0, throughput: 0 };
    const c = js.reduce((s, j) => s + (before.junctions[j.id]?.congestion ?? 0.3), 0) / js.length;
    const w = js.reduce((s, j) => s + (before.junctions[j.id]?.waitSeconds ?? 30), 0) / js.length;
    const t = js.reduce((s, j) => s + (before.junctions[j.id]?.throughput ?? 1000), 0);
    return { junctions: js.length, congestion: c, wait: w, throughput: t };
  };

  const filteredEdits = useMemo(() => {
    if (!auditSearch.trim()) return state.edits;
    const q = auditSearch.toLowerCase();
    return state.edits.filter(
      (e) =>
        e.junctionName?.toLowerCase().includes(q) ||
        e.junctionId.toLowerCase().includes(q) ||
        e.by.toLowerCase().includes(q) ||
        e.reason.toLowerCase().includes(q) ||
        e.ward?.toLowerCase().includes(q),
    );
  }, [state.edits, auditSearch]);

  function exportCsv() {
    const rows = [
      ["junction_id", "name", "ward", "zone", "green_s", "wait_s_current", "wait_s_rebalanced", "congestion_pct", "throughput_vph", "landmark"],
      ...JUNCTIONS.map((j) => [
        j.id,
        j.name,
        j.ward,
        ZONE_LABEL[j.zone],
        String(before.junctions[j.id]?.green ?? j.baseGreen),
        String(before.junctions[j.id]?.waitSeconds ?? 30),
        String(after.junctions[j.id]?.waitSeconds ?? 25),
        String(Math.round((before.junctions[j.id]?.congestion ?? 0.3) * 100)),
        String(before.junctions[j.id]?.throughput ?? 1500),
        j.landmark || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nagpur-traffic-sim-${input.start}-${input.end}h.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Nagpur network simulation report exported (CSV)");
  }

  if (!user) return null;

  return (
    <Shell
      right={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1.5"
            onClick={() => setAuditModalOpen(true)}
          >
            <History className="h-3.5 w-3.5 text-primary" />
            Signal Audit Log ({state.edits.length})
          </Button>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {ROLE_LABEL[user.role]}
          </Badge>
        </div>
      }
    >
      <div className="grid min-h-0 flex-1 xl:grid-cols-[300px_1fr_340px]">
        {/* controls rail */}
        <aside className="space-y-4 overflow-y-auto border-b border-border bg-surface p-4 xl:border-b-0 xl:border-r">
          <div>
            <h1 className="text-sm font-semibold">Simulation Window</h1>
            <div className="mt-2 flex gap-2">
              {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).slice(0, 2).map((k) => (
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
                  {PRESETS[k].start > 12 ? "4–7 PM (Peak)" : "9–12 AM (Peak)"}
                </Button>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Custom Range</span>
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
            <Field label="Weather Condition">
              <Select
                value={input.weather}
                onValueChange={(v) => setInput({ ...input, weather: v as Weather })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">Clear Skies</SelectItem>
                  <SelectItem value="rain">Monsoon Rain (Nagpur)</SelectItem>
                  <SelectItem value="fog">Winter Morning Fog</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vehicle Class Composition">
              <Select
                value={input.vehicles}
                onValueChange={(v) => setInput({ ...input, vehicles: v as VehicleMix })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles (Default Mix)</SelectItem>
                  <SelectItem value="cars">Private Cars Heavy</SelectItem>
                  <SelectItem value="twowheeler">Two-Wheelers Majority</SelectItem>
                  <SelectItem value="freight">Commercial Freight</SelectItem>
                  <SelectItem value="transit">City Buses & Transit</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="panel space-y-3 p-3">
            <div className="label-xs">What-If Scenario Simulation</div>
            <Field label="Simulate Corridor Closure">
              <Select
                value={input.closedCorridors[0] ?? "none"}
                onValueChange={(v) =>
                  setInput({ ...input, closedCorridors: v === "none" ? [] : [v] })
                }
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">No Road Closures</SelectItem>
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
                <span>Divert {ZONE_LABEL[zoneA].split(" ")[0]} → {ZONE_LABEL[zoneB].split(" ")[0]}</span>
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
              <Flame className="h-3.5 w-3.5 text-peak" /> Hotspot Heatmap
            </Label>
            <Switch id="heat" checked={heatmap} onCheckedChange={setHeatmap} />
          </div>

          <Button variant="outline" size="sm" className="w-full text-xs" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export All 52 Junctions (CSV)
          </Button>

          {Object.keys(state.overrides).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                resetAllOverrides();
                toast.info("All signal overrides reset to standard municipal plan.");
              }}
            >
              Reset All Manual Overrides ({Object.keys(state.overrides).length})
            </Button>
          )}
        </aside>

        {/* map + metrics */}
        <section className="flex min-h-0 flex-col">
          <div className="grid grid-cols-2 gap-2 border-b border-border p-3 lg:grid-cols-4">
            <Metric label="Active Incidents" value={active.length} tone={active.length ? "critical" : "default"} />
            <Metric
              label="City Congestion Index"
              value={`${Math.round(before.congestionIndex * 100)}%`}
              tone={before.congestionIndex > 0.6 ? "peak" : "flow"}
            />
            <Metric
              label="Peak Junctions"
              value={JUNCTIONS.filter((j) => (before.junctions[j.id]?.congestion ?? 0) > 0.5).length}
              unit={`of ${JUNCTIONS.length}`}
            />
            <Metric
              label="Simulated Wait Saved"
              value={`${Math.max(0, Math.round(waitDelta))}s`}
              unit="per veh"
              tone="flow"
              delta={`${savedPct > 0 ? "−" : "+"}${Math.abs(savedPct).toFixed(1)}% average delay`}
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
              <div className="flex items-center justify-between">
                <div className="label-xs">Wait Comparison — Current vs Rebalanced Plan (s)</div>
                <Select value={chartZone} onValueChange={setChartZone}>
                  <SelectTrigger className="h-6 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Top 16 Nodes</SelectItem>
                    {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
                      <SelectItem key={z} value={z} className="text-xs">{z.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={36} unit="s" />
                    <Tooltip
                      cursor={{ fill: "var(--accent)" }}
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                      formatter={(v: number, name: string) => [`${v}s wait`, name === "current" ? "Current Plan" : "Rebalanced Plan"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="current" name="Current Plan" fill="var(--peak)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="rebalanced" name="AI Rebalanced" fill="var(--flow)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel p-3">
              <div className="label-xs">Nagpur Zone Congestion Comparison</div>
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
                        <SelectContent className="max-h-48">
                          {(Object.keys(ZONE_LABEL) as Zone[]).map((k) => (
                            <SelectItem key={k} value={k} className="text-xs">
                              {ZONE_LABEL[k].split(" (")[0]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <dl className="mt-2 space-y-1 text-[11px]">
                        <Line k="Junctions" v={String(s.junctions)} />
                        <Line k="Congestion" v={`${Math.round(s.congestion * 100)}%`} />
                        <Line k="Avg Wait" v={`${Math.round(s.wait)}s`} />
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
                <h2 className="text-sm font-semibold">Top Congested Corridors</h2>
                <ul className="mt-2 space-y-1.5">
                  {corridorRanking.map(({ c, r }, i) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelected(c.from)}
                        className="panel w-full p-2.5 text-left transition-colors hover:bg-accent cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="num text-[11px] text-muted-foreground">#{i + 1}</span>
                          <span
                            className={cn(
                              "num text-xs font-semibold",
                              r.load >= 0.75 ? "text-critical" : r.load >= 0.5 ? "text-peak" : "text-flow",
                            )}
                          >
                            {Math.round(r.load * 100)}% Load
                          </span>
                        </div>
                        <div className="truncate text-sm font-medium">{c.name}</div>
                        <div className="num text-[11px] text-muted-foreground">
                          {r.speedKph} km/h · {r.volume.toLocaleString()} veh/h · {c.lanes}L
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Recent Override Log
                  </h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] p-1"
                    onClick={() => setAuditModalOpen(true)}
                  >
                    View All
                  </Button>
                </div>
                {state.edits.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No manual signal edits yet. Click any junction on the map to adjust its green duration.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {state.edits.slice(0, 5).map((e) => (
                      <li key={e.id} className="panel p-2.5 text-[11px]">
                        <div className="text-sm font-semibold">{e.junctionName || junctionById(e.junctionId)?.name}</div>
                        <div className="num text-muted-foreground">
                          {e.from}s → <span className="text-primary font-bold">{e.to}s</span> · {ROLE_LABEL[e.role]}
                        </div>
                        <div className="text-[10px] text-muted-foreground/80 truncate">
                          Reason: {e.reason}
                        </div>
                        <div className="num text-[10px] text-muted-foreground/60 mt-0.5">
                          {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · by {e.by}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-md border border-border/50 bg-background/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Planning Authority Mode:</span> All 52 Nagpur junctions and 75 corridors run client-side simulation. Changes immediately affect connected road load.
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Signal Audit Log Modal */}
      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <History className="h-5 w-5 text-primary" />
              Nagpur Signal Timing Audit Trail (Planning Authority)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete historical record of all manual signal overrides, directional split allocations, and operational reasons logged by duty officers.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by junction, officer, ward, or reason..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                const csv = [
                  ["id", "junction_id", "junction_name", "ward", "old_green", "new_green", "officer", "role", "timestamp", "reason"],
                  ...state.edits.map((e) => [
                    e.id,
                    e.junctionId,
                    e.junctionName || "",
                    e.ward || "",
                    String(e.from),
                    String(e.to),
                    e.by,
                    e.role,
                    new Date(e.at).toISOString(),
                    e.reason,
                  ]),
                ].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `nagpur-signal-audit-log-${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Signal audit log exported");
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export Audit CSV
            </Button>
          </div>

          <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
            {filteredEdits.length === 0 ? (
              <div className="panel p-6 text-center text-xs text-muted-foreground">
                No signal audit entries match your query.
              </div>
            ) : (
              filteredEdits.map((e) => (
                <div key={e.id} className="panel p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-sm">
                      {e.junctionName || junctionById(e.junctionId)?.name || e.junctionId}
                    </span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {e.role}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                    <span>
                      Green Phase: <span className="num font-semibold">{e.from}s</span> →{" "}
                      <span className="num font-bold text-primary">{e.to}s</span>
                    </span>
                    <span>Officer: <strong className="text-foreground">{e.by}</strong></span>
                    <span>Time: {new Date(e.at).toLocaleString()}</span>
                  </div>
                  <div className="rounded bg-background/60 p-2 text-[11px] border border-border">
                    <span className="text-muted-foreground font-medium">Logged Reason:</span>{" "}
                    <span className="text-foreground">{e.reason}</span>
                  </div>
                  {e.directions && (
                    <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground pt-1">
                      <span>N: {e.directions.north}s</span>
                      <span>S: {e.directions.south}s</span>
                      <span>E: {e.directions.east}s</span>
                      <span>W: {e.directions.west}s</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
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

