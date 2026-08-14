import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Clock, MapPin, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shell, LastUpdated } from "@/components/Shell";
import { MapLegend, TrafficMap } from "@/components/TrafficMap";
import { SosButton, SosDialog } from "@/components/SosFlow";
import {
  CORRIDORS,
  JUNCTIONS,
  defaultSimInput,
  fastestRoute,
  junctionById,
  simulate,
} from "@/lib/traffic";
import { isActive, sinceLabel, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlowGuard Live Traffic Map & Emergency SOS" },
      {
        name: "description",
        content:
          "See live congestion, incident zones and signal states across the city, get alternate routes during incidents, and raise an emergency SOS from your location.",
      },
      { property: "og:title", content: "FlowGuard Live Traffic Map & Emergency SOS" },
      {
        property: "og:description",
        content:
          "Live congestion, incident overrides, reroute suggestions and one-tap emergency SOS for citizens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CitizenView,
});

function CitizenView() {
  const { state, user } = useApp();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const [origin, setOrigin] = useState("J1");
  const [destination, setDestination] = useState("J9");
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
    .slice(0, 4);

  return (
    <Shell right={<SosButton className="hidden md:flex" />}>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_360px]">
        <section className="relative min-h-[58vh] border-b border-border lg:border-b-0 lg:border-r">
          <TrafficMap
            result={result}
            reports={active}
            overrideCorridors={overrideCorridors}
            reroute={affected ? detour.path : []}
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
          <div className="pointer-events-none absolute left-4 top-4 max-w-[75%] space-y-2">
            <div className="panel pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">
                Tap anywhere on the map to drop a pin and report
              </span>
            </div>
            {active.length > 0 && (
              <div className="panel pointer-events-auto flex items-center gap-2 border-critical/50 bg-critical/10 px-3 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-critical" />
                <span className="text-xs">
                  {active.length} active incident{active.length > 1 ? "s" : ""} — corridors in
                  override
                </span>
              </div>
            )}
          </div>
          <div className="panel absolute bottom-4 left-4 px-3 py-2">
            <MapLegend />
          </div>
          <SosButton className="absolute bottom-5 right-5 md:hidden" />
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto bg-surface p-4">
          <div>
            <div className="flex items-center justify-between">
              <h1 className="text-sm font-semibold">Your route</h1>
              <LastUpdated />
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <JunctionSelect value={origin} onChange={setOrigin} />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <JunctionSelect value={destination} onChange={setDestination} />
            </div>
            <div className="mt-3 space-y-2">
              <RouteCard
                label="Usual route"
                minutes={normal.minutes}
                path={normal.path}
                tone={affected ? "critical" : "flow"}
                note={affected ? "Passes an incident override" : "Clear"}
              />
              {affected && saved > 0.2 && (
                <RouteCard
                  label="Suggested reroute"
                  minutes={detour.minutes}
                  path={detour.path}
                  tone="primary"
                  note={`Saves ~${saved.toFixed(1)} min right now`}
                />
              )}
            </div>
          </div>

          <div>
            <h2 className="label-xs">Congestion right now</h2>
            <ul className="mt-2 space-y-1.5">
              {worst.map((j) => {
                const c = result.junctions[j.id]!;
                return (
                  <li key={j.id} className="panel flex items-center gap-3 p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{j.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        wait <span className="num">{c.waitSeconds}s</span> · green{" "}
                        <span className="num">{c.green}s</span>
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
                      <div className="num mt-1 text-right text-[11px] text-muted-foreground">
                        {Math.round(c.congestion * 100)}%
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h2 className="label-xs">Recent reports</h2>
            {state.reports.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No reports yet. Drop a pin on the map or press SOS in an emergency.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {state.reports.slice(0, 6).map((r) => (
                  <li key={r.id} className="panel flex items-center gap-2 p-2.5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        r.status === "resolved"
                          ? "bg-flow"
                          : r.status === "cancelled"
                            ? "bg-muted-foreground"
                            : "bg-critical",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm capitalize">
                        {r.type} · {junctionById(r.nearestJunction)?.name}
                      </div>
                      <div className="num text-[11px] text-muted-foreground">
                        {sinceLabel(r.createdAt, now)}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {r.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!user && (
            <div className="panel p-3">
              <div className="text-sm font-medium">Sign in to report or use SOS</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Browsing the map is public. Reporting needs a verified account.
              </p>
              <Button size="sm" className="mt-3 w-full" onClick={() => navigate({ to: "/auth" })}>
                Verify with OTP
              </Button>
            </div>
          )}

          <p className="mt-auto pt-2 text-[11px] leading-relaxed text-muted-foreground">
            Demo data. Live sensor feeds, OTP delivery and persistent storage require a connected
            backend.
          </p>
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
      <SelectContent>
        {JUNCTIONS.map((j) => (
          <SelectItem key={j.id} value={j.id} className="text-xs">
            {j.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RouteCard({
  label,
  minutes,
  path,
  tone,
  note,
}: {
  label: string;
  minutes: number;
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
        <span className="num flex items-center gap-1 text-sm font-semibold">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {minutes.toFixed(1)} min
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <RouteIcon className="h-3 w-3" />
        <span className="num truncate">{path.join(" → ") || "no route"}</span>
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
