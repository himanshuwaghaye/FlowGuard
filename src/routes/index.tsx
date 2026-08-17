import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Clock, MapPin, Route as RouteIcon, Sliders, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shell, LastUpdated } from "@/components/Shell";
import { MapLegend, TrafficMap } from "@/components/TrafficMap";
import { JunctionEditor } from "@/components/JunctionEditor";
import { SosButton, SosDialog } from "@/components/SosFlow";
import {
  CORRIDORS,
  JUNCTIONS,
  ZONE_LABEL,
  defaultSimInput,
  fastestRoute,
  junctionById,
  simulate,
  type Zone,
} from "@/lib/traffic";
import { isActive, sinceLabel, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlowGuard Nagpur Live Signal Network & Emergency Map" },
      {
        name: "description",
        content:
          "City-wide live traffic signal network for Nagpur. View real-time signal waiting times, connected road congestion, and emergency SOS alerts across all zones.",
      },
      { property: "og:title", content: "FlowGuard Nagpur Live Signal Network & Emergency Map" },
      {
        property: "og:description",
        content:
          "Live signal-wise path, red/green road congestion simulator, and one-tap emergency SOS across all Nagpur municipal wards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CitizenView,
});

function CitizenView() {
  const { state, user, canEdit } = useApp();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const [origin, setOrigin] = useState("J20"); // Dharampeth Coffee House
  const [destination, setDestination] = useState("J28"); // Medical Square
  const [selectedJunction, setSelectedJunction] = useState<string | null>(null);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setTick((v) => v + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  const input = useMemo(
    () => ({
      ...defaultSimInput(),
      start: Math.floor(hour),
      end: Math.floor(hour) + 1,
      greenOverrides: state.overrides,
    }),
    [hour, state.overrides],
  );
  const result = useMemo(() => simulate(input, "base"), [input]);

  const active = state.reports.filter(isActive);
  const overrideCorridors = active.map((r) => r.corridorId).filter(Boolean) as string[];

  const normal = fastestRoute(origin, destination, result);
  const detour = fastestRoute(origin, destination, result, overrideCorridors);
  const affected = normal.path.some((id, i) => {
    const next = normal.path[i + 1];
    if (!next) return false;
    const c = CORRIDORS.find(
      (x) => (x.from === id && x.to === next) || (x.to === id && x.from === next),
    );
    return c ? overrideCorridors.includes(c.id) : false;
  });
  const saved = Math.max(0, normal.minutes - detour.minutes);

  const worst = [...JUNCTIONS]
    .sort((a, b) => result.junctions[b.id]!.congestion - result.junctions[a.id]!.congestion)
    .slice(0, 5);

  return (
    <Shell right={<SosButton className="hidden md:flex" />}>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_380px]">
        <section className="relative min-h-[58vh] border-b border-border lg:border-b-0 lg:border-r">
          <TrafficMap
            result={result}
            reports={active}
            overrideCorridors={overrideCorridors}
            reroute={affected ? detour.path : []}
            selected={selectedJunction}
            onSelectJunction={setSelectedJunction}
            playhead={tick / 20}
            onPinDrop={(x, y) => {
              if (!user) {
                toast.error("Sign in to report", {
                  description: "Reports are traceable to a verified account.",
                });
                navigate({ to: "/auth" });
                return;
              }
              setPin({ x, y });
              setPinOpen(true);
            }}
          />
          {/* Floating Helper Panel on Top Left of Map */}
          <div className="pointer-events-none absolute left-3 top-14 z-10 max-w-sm space-y-2">
            <div className="panel pointer-events-auto flex items-start gap-2.5 bg-surface/95 p-2.5 shadow-lg backdrop-blur">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="text-xs">
                <span className="font-semibold text-foreground">City-Wide Signal Network:</span>{" "}
                <span className="text-muted-foreground">
                  Tap any junction to view waiting times and signal phases. Tap any road to drop an emergency report.
                </span>
              </div>
            </div>

            {active.length > 0 && (
              <div className="panel pointer-events-auto flex items-center gap-2 border-critical/50 bg-critical/15 p-2.5 shadow-lg backdrop-blur">
                <AlertTriangle className="h-4 w-4 shrink-0 text-critical animate-pulse" />
                <span className="text-xs font-medium text-critical">
                  {active.length} active emergency incident{active.length > 1 ? "s" : ""} across Nagpur — signals adjusted.
                </span>
              </div>
            )}
          </div>

          <div className="panel absolute bottom-4 left-4 z-10 bg-surface/90 px-3 py-2 shadow-md backdrop-blur">
            <MapLegend />
          </div>
          <SosButton className="absolute bottom-5 right-5 z-20 md:hidden" />
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto bg-surface p-4 border-l border-border">
          {selectedJunction ? (
            <JunctionEditor
              junctionId={selectedJunction}
              input={input}
              canEdit={Boolean(canEdit)}
              onClose={() => setSelectedJunction(null)}
            />
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <h1 className="text-sm font-semibold tracking-tight">Nagpur Commute Route</h1>
                  <LastUpdated />
                </div>

                {/* Quick Route Presets */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { from: "J20", to: "J28", label: "Dharampeth → Medical Sq" },
                    { from: "J10", to: "J9", label: "RBI Sadar → Chatrapati Sq" },
                    { from: "J3", to: "J1", label: "Station → Zero Mile" },
                    { from: "J16", to: "J41", label: "Koradi → Airport" },
                    { from: "J39", to: "J43", label: "Trimurti Nagar → Pardi" },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setOrigin(p.from);
                        setDestination(p.to);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        origin === p.from && destination === p.to
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <JunctionSelect value={origin} onChange={setOrigin} />
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <JunctionSelect value={destination} onChange={setDestination} />
                </div>

                <div className="mt-3 space-y-2">
                  <RouteCard
                    label="Direct Road Route"
                    minutes={normal.minutes}
                    distanceKm={normal.distanceKm}
                    path={normal.path}
                    tone={affected ? "critical" : "flow"}
                    note={affected ? "Passes an active incident override zone" : "Clear traffic flow"}
                  />
                  {affected && saved > 0.2 && (
                    <RouteCard
                      label="Suggested AI Reroute"
                      minutes={detour.minutes}
                      distanceKm={detour.distanceKm}
                      path={detour.path}
                      tone="primary"
                      note={`Saves ~${saved.toFixed(1)} min by bypassing congested corridor`}
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h2 className="label-xs">City-Wide Hotspot Junctions</h2>
                  <span className="text-[11px] text-muted-foreground">Highest Congestion</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {worst.map((j) => {
                    const c = result.junctions[j.id]!;
                    return (
                      <li
                        key={j.id}
                        className="panel flex items-center gap-3 p-2.5 transition-colors hover:bg-accent/50 cursor-pointer"
                        onClick={() => setSelectedJunction(j.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{j.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            wait <span className="num font-semibold">{c.waitSeconds}s</span> · green{" "}
                            <span className="num">{c.green}s</span> · {j.ward}
                          </div>
                        </div>
                        <div className="w-16">
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-[width] duration-700",
                                c.congestion >= 0.75
                                  ? "bg-critical"
                                  : c.congestion >= 0.5
                                    ? "bg-peak"
                                    : "bg-flow",
                              )}
                              style={{ width: `${Math.round(c.congestion * 100)}%` }}
                            />
                          </div>
                          <div className="num mt-1 text-right text-[11px] font-semibold text-muted-foreground">
                            {Math.round(c.congestion * 100)}%
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <h2 className="label-xs">Active Citizen Reports & SOS</h2>
                {state.reports.length === 0 ? (
                  <div className="panel mt-2 p-3 text-center">
                    <p className="text-xs text-muted-foreground">
                      No active incidents. Tap anywhere on the Nagpur map or press SOS to report an emergency.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {state.reports.slice(0, 6).map((r) => (
                      <li key={r.id} className="panel flex items-center gap-2 p-2.5">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full animate-pulse",
                            r.status === "resolved"
                              ? "bg-flow"
                              : r.status === "cancelled"
                                ? "bg-muted-foreground"
                                : "bg-critical",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm capitalize font-medium">
                            {r.type} · {junctionById(r.nearestJunction)?.name}
                          </div>
                          <div className="num text-[11px] text-muted-foreground">
                            {sinceLabel(r.createdAt, now)} · by {r.reporter}
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {r.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {!user && (
                <div className="panel p-3.5 border-primary/30 bg-primary/5">
                  <div className="text-sm font-semibold text-foreground">Sign in to report or trigger SOS</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Browsing the live Nagpur traffic map is public. Incident reporting requires a verified account.
                  </p>
                  <Button size="sm" className="mt-3 w-full font-medium" onClick={() => navigate({ to: "/auth" })}>
                    Verify with Mobile OTP
                  </Button>
                </div>
              )}

              <div className="mt-auto rounded-md border border-border/50 bg-background/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Live Nagpur Grid:</span> Powered by Google Maps, NMC Traffic Dataset & FlowGuard Signal Engine.
              </div>
            </>
          )}
        </aside>
      </div>
      <SosDialog open={pinOpen} onOpenChange={setPinOpen} seed={pin} />
    </Shell>
  );
}

function JunctionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {JUNCTIONS.map((j) => (
          <SelectItem key={j.id} value={j.id} className="text-xs">
            {j.name} ({j.ward.split(" ")[0]})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RouteCard({
  label,
  minutes,
  distanceKm,
  path,
  tone,
  note,
}: {
  label: string;
  minutes: number;
  distanceKm?: number;
  path: string[];
  tone: "flow" | "critical" | "primary";
  note: string;
}) {
  return (
    <div
      className={cn(
        "panel p-3",
        tone === "primary" && "border-primary/60 bg-primary/5",
        tone === "critical" && "border-critical/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="label-xs">{label}</span>
        <div className="flex items-center gap-2">
          {distanceKm && (
            <span className="num text-xs text-muted-foreground">{distanceKm} km</span>
          )}
          <span className="num flex items-center gap-1 text-sm font-semibold">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {minutes.toFixed(1)} min
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <RouteIcon className="h-3 w-3 shrink-0" />
        <span className="num truncate">
          {path.map((id) => junctionById(id)?.name.split(" ")[0] ?? id).join(" → ") || "no route"}
        </span>
      </div>
      <div
        className={cn(
          "mt-1 text-[11px]",
          tone === "critical" ? "text-critical" : tone === "primary" ? "text-primary" : "text-flow",
        )}
      >
        {note}
      </div>
    </div>
  );
}

