import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Ambulance, Navigation, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shell } from "@/components/Shell";
import { MapLegend, TrafficMap } from "@/components/TrafficMap";
import { JunctionEditor } from "@/components/JunctionEditor";
import {
  JUNCTIONS,
  defaultSimInput,
  fastestRoute,
  junctionById,
  simulate,
} from "@/lib/traffic";
import { ROLE_LABEL, isActive, sinceLabel, useApp, type SosReport } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/responder")({
  head: () => ({
    meta: [
      { title: "Responder Console — Live SOS Dispatch" },
      {
        name: "description",
        content:
          "Police and ambulance console: live SOS pins, congestion-aware fastest routes, acknowledge and resolve incidents, and override junction signals on scene.",
      },
      { property: "og:title", content: "Responder Console — Live SOS Dispatch" },
      {
        property: "og:description",
        content: "Live SOS queue, fastest congestion-aware routing and on-scene signal control.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResponderView,
});

function ResponderView() {
  const { user, state, updateSos, ready } = useApp();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [base, setBase] = useState("J5");
  const [focus, setFocus] = useState<string | null>(null);
  const [junction, setJunction] = useState<string | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth" });
  }, [ready, user, navigate]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const input = { ...defaultSimInput(), greenOverrides: state.overrides };
  const result = useMemo(() => simulate(input, "base"), [JSON.stringify(input)]);

  const active = state.reports.filter(isActive);
  const overrideCorridors = active.map((r) => r.corridorId).filter(Boolean) as string[];

  // realtime alert on new SOS arriving from a citizen tab
  useEffect(() => {
    const fresh = active.filter((r) => r.status === "new" && !seen.includes(r.id));
    if (fresh.length) {
      setSeen((s) => [...s, ...fresh.map((f) => f.id)]);
      for (const f of fresh) {
        toast.error(`New SOS — ${f.type}`, {
          description: `${junctionById(f.nearestJunction)?.name} · reported by ${f.reporter}`,
        });
      }
    }
  }, [active.map((a) => a.id).join(","), seen]);

  const ranked = [...active].sort((a, b) => {
    const da = dist(base, a);
    const db = dist(base, b);
    return a.createdAt === b.createdAt ? da - db : b.createdAt - a.createdAt;
  });

  const target = ranked.find((r) => r.id === focus) ?? ranked[0] ?? null;
  const route = target ? fastestRoute(base, target.nearestJunction, result) : null;

  if (!user) return null;

  const isResponder = user.role === "police" || user.role === "ambulance";

  return (
    <Shell
      right={
        <Badge variant="outline" className="hidden sm:inline-flex">
          {ROLE_LABEL[user.role]}
        </Badge>
      }
    >
      <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_1fr_320px]">
        <aside className="min-h-0 space-y-3 overflow-y-auto border-b border-border bg-surface p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-1.5 text-sm font-semibold">
              {user.role === "ambulance" ? (
                <Ambulance className="h-4 w-4 text-critical" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-critical" />
              )}
              Active SOS queue
            </h1>
            <span className="num text-xs text-muted-foreground">{active.length}</span>
          </div>

          <div className="panel p-2.5">
            <div className="label-xs">Your unit station</div>
            <select
              value={base}
              onChange={(e) => setBase(e.target.value)}
              className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
            >
              {JUNCTIONS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>

          {ranked.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No active SOS. New citizen reports appear here instantly with a live pin and alert.
            </p>
          )}

          <ul className="space-y-2">
            {ranked.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "panel cursor-pointer p-3 transition-colors hover:bg-accent",
                  target?.id === r.id && "border-primary",
                )}
                onClick={() => setFocus(r.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium capitalize">
                      {r.type}
                      {r.highway && (
                        <span className="ml-1.5 text-[10px] text-peak">HIGHWAY</span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {junctionById(r.nearestJunction)?.name}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize",
                      r.status === "new" && "border-critical/60 text-critical",
                    )}
                  >
                    {r.status}
                  </Badge>
                </div>
                <div className="num mt-1.5 flex gap-3 text-[11px] text-muted-foreground">
                  <span>{sinceLabel(r.createdAt, now)}</span>
                  <span>{dist(base, r).toFixed(1)} km</span>
                  <span>{r.reporter}</span>
                </div>
                {r.note && <p className="mt-1 text-[11px] text-muted-foreground">{r.note}</p>}
                {isResponder && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.status === "new" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSos(r.id, { status: "acknowledged", handledBy: user.contact });
                          toast.success("Acknowledged");
                        }}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {r.status !== "enroute" && r.status !== "new" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSos(r.id, { status: "enroute" });
                          toast.info("Marked en route");
                        }}
                      >
                        En route
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSos(r.id, { status: "resolved", moving: false });
                        toast.success("Resolved — corridor reverted to its normal signal plan.");
                      }}
                    >
                      Resolve
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <section className="relative min-h-[50vh] border-b border-border lg:border-b-0 lg:border-r">
          <TrafficMap
            result={result}
            reports={active}
            overrideCorridors={overrideCorridors}
            reroute={route?.path ?? []}
            selected={junction}
            onSelectJunction={setJunction}
            playhead={now / 1000}
          />
          <div className="panel absolute bottom-3 left-3 px-3 py-2">
            <MapLegend />
          </div>
          {target && route && (
            <div className="panel absolute left-3 top-3 max-w-xs p-3">
              <div className="label-xs flex items-center gap-1.5">
                <Navigation className="h-3.5 w-3.5 text-primary" /> Fastest response route
              </div>
              <div className="num mt-1 text-lg font-semibold">{route.minutes.toFixed(1)} min</div>
              <div className="num text-[11px] text-muted-foreground">{route.path.join(" → ")}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Congestion-aware, not straight-line. Signals along the path are held in incident
                override.
              </p>
            </div>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto bg-surface">
          {junction ? (
            <JunctionEditor
              junctionId={junction}
              input={input}
              canEdit={user.role === "police" || user.role === "authority"}
              onClose={() => setJunction(null)}
            />
          ) : (
            <div className="space-y-3 p-4">
              <h2 className="text-sm font-semibold">Corridor overrides</h2>
              {overrideCorridors.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No corridor is currently in incident override.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {active.map((r) => (
                    <li key={r.id} className="panel p-2.5 text-[11px]">
                      <div className="text-sm capitalize">{r.type} override</div>
                      <div className="text-muted-foreground">
                        {junctionById(r.nearestJunction)?.name} · surrounding junctions rebalanced
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
                Click any junction on the map to extend or shorten its green phase and clear the way
                for your unit. Every edit is logged for the planning authority.
              </p>
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function dist(baseId: string, r: SosReport) {
  const b = junctionById(baseId)!;
  return Math.hypot(b.x - r.x, b.y - r.y) * 0.32;
}
