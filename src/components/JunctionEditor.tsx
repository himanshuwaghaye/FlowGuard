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
import {
  historyFor,
  junctionById,
  neighbours,
  simulate,
  type SimInput,
} from "@/lib/traffic";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

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
  const { state, setOverride, clearOverride } = useApp();
  const junction = junctionById(junctionId)!;
  const current = state.overrides[junctionId] ?? junction.baseGreen;
  const [draft, setDraft] = useState(current);

  const before = useMemo(() => simulate(input, "base"), [input]);
  const after = useMemo(
    () =>
      simulate(
        { ...input, greenOverrides: { ...input.greenOverrides, [junctionId]: draft } },
        "base",
      ),
    [input, junctionId, draft],
  );

  const b = before.junctions[junctionId]!;
  const a = after.junctions[junctionId]!;
  const delta = a.waitSeconds - b.waitSeconds;

  const ripple = neighbours(junctionId)
    .map((id) => ({
      id,
      name: junctionById(id)!.name,
      delta: after.junctions[id]!.waitSeconds - before.junctions[id]!.waitSeconds,
    }))
    .filter((r) => Math.abs(r.delta) >= 1);

  const history = historyFor(junctionId, input.start);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="label-xs">{junction.id} · signal detail</div>
        <h2 className="mt-0.5 text-base font-semibold leading-tight">{junction.name}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Congestion" value={`${Math.round(b.congestion * 100)}%`} />
        <Stat label="Avg wait" value={`${b.waitSeconds}s`} />
        <Stat label="Throughput" value={`${b.throughput.toLocaleString()}`} unit="veh/h" />
      </div>

      <div>
        <div className="label-xs mb-1">Congestion trend today (%)</div>
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

      <div className="panel p-3">
        <div className="flex items-center justify-between">
          <span className="label-xs">Green phase duration</span>
          <span className="num text-sm font-semibold">{draft}s</span>
        </div>
        <Slider
          className="mt-3"
          value={[draft]}
          min={MIN_GREEN}
          max={MAX_GREEN}
          step={1}
          disabled={!canEdit}
          onValueChange={([v]) => setDraft(v ?? draft)}
        />
        <div className="num mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{MIN_GREEN}s min</span>
          <span>{MAX_GREEN}s max</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-sm border border-border p-2">
            <div className="label-xs">Before</div>
            <div className="num mt-0.5 text-sm">{b.waitSeconds}s wait</div>
          </div>
          <div
            className={cn(
              "rounded-sm border p-2",
              delta < 0 ? "border-flow/60 bg-flow/10" : delta > 0 ? "border-critical/50" : "border-border",
            )}
          >
            <div className="label-xs">After</div>
            <div className="num mt-0.5 text-sm">
              {a.waitSeconds}s wait{" "}
              <span className={delta < 0 ? "text-flow" : delta > 0 ? "text-critical" : ""}>
                ({delta > 0 ? "+" : ""}
                {delta}s)
              </span>
            </div>
          </div>
        </div>

        {ripple.length > 0 && (
          <div className="mt-3">
            <div className="label-xs">Ripple to nearby junctions</div>
            <ul className="mt-1 space-y-1">
              {ripple.map((r) => (
                <li key={r.id} className="flex justify-between text-[11px]">
                  <span className="truncate text-muted-foreground">{r.name}</span>
                  <span className={cn("num", r.delta > 0 ? "text-critical" : "text-flow")}>
                    {r.delta > 0 ? "+" : ""}
                    {r.delta}s
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canEdit ? (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={draft === current}
              onClick={() => {
                setOverride(junctionId, draft, "manual override");
                toast.success(`${junction.name}: green set to ${draft}s`, {
                  description:
                    delta < 0
                      ? `Estimated ${Math.abs(delta)}s less wait per vehicle.`
                      : "Change logged for authority review.",
                });
              }}
            >
              Apply change
            </Button>
            {state.overrides[junctionId] !== undefined && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clearOverride(junctionId);
                  setDraft(junction.baseGreen);
                  toast.info("Reverted to the standard plan.");
                }}
              >
                Revert
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Signal editing is restricted to police and planning authority accounts.
          </p>
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onClose}>
        Close panel
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
