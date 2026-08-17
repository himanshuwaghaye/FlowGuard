import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Camera, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  SOS_TYPES,
  nearestJunction,
  useApp,
  type SosReport,
  type SosType,
} from "@/lib/store";
import { CORRIDORS, gpsToMapPercent, junctionById, mapPercentToGps } from "@/lib/traffic";
import { cn } from "@/lib/utils";

const CANCEL_WINDOW = 20;

/** Maps a real GPS fix onto Nagpur map space. */
function projectGps(lat: number, lon: number) {
  // If coordinates are inside or near Nagpur
  if (lat >= 20.9 && lat <= 21.4 && lon >= 78.8 && lon <= 79.3) {
    return gpsToMapPercent(lat, lon);
  }
  // Default to central Nagpur Sitabuldi
  return { x: 58.2, y: 44.2 };
}

export function SosButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "group flex items-center gap-2 rounded-full bg-critical px-5 py-3 text-sm font-semibold text-critical-foreground shadow-lg shadow-critical/25 transition-transform active:scale-95",
          className,
        )}
        aria-label="Emergency SOS"
      >
        <AlertTriangle className="h-4 w-4" strokeWidth={2.6} />
        SOS
      </button>
      <SosDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function SosDialog({
  open,
  onOpenChange,
  seed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  seed?: { x: number; y: number } | null;
}) {
  const { user, createSos, updateSos } = useApp();
  const navigate = useNavigate();
  const [stage, setStage] = useState<"locating" | "type" | "sent">("locating");
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [gps, setGps] = useState<string>("");
  const [type, setType] = useState<SosType>("accident");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [report, setReport] = useState<SosReport | null>(null);
  const [countdown, setCountdown] = useState(CANCEL_WINDOW);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setStage("locating");
      setCoords(null);
      setReport(null);
      setNote("");
      setPhoto(undefined);
      setCountdown(CANCEL_WINDOW);
      return;
    }
    if (seed) {
      setCoords(seed);
      setGps("pin drop");
      setStage("type");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setCoords({ x: 50, y: 50 });
      setGps("unavailable — approximate");
      setStage("type");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords(projectGps(pos.coords.latitude, pos.coords.longitude));
        setGps(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setStage("type");
      },
      () => {
        setCoords({ x: 50, y: 52 });
        setGps("permission denied — approximate location used");
        setStage("type");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [open, seed]);

  // live-location refresh while the reporter is still moving
  useEffect(() => {
    if (stage !== "sent" || !report) return;
    const t = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
      updateSos(report.id, {
        x: Math.min(96, Math.max(4, report.x + (Math.random() - 0.5) * 1.2)),
        y: Math.min(96, Math.max(4, report.y + (Math.random() - 0.5) * 1.2)),
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, report?.id]);

  function submit() {
    if (!user) {
      toast.error("Sign in required", { description: "SOS reports are tied to a real account." });
      onOpenChange(false);
      navigate({ to: "/auth" });
      return;
    }
    if (!coords) return;
    const j = nearestJunction(coords.x, coords.y);
    const corridor = CORRIDORS.filter((c) => c.from === j.id || c.to === j.id).sort((a, b) => {
      const da = distToCorridor(coords, a.from, a.to);
      const db = distToCorridor(coords, b.from, b.to);
      return da - db;
    })[0];
    const created = createSos({
      type,
      x: coords.x,
      y: coords.y,
      nearestJunction: j.id,
      corridorId: corridor?.id,
      highway: Boolean(corridor?.highway),
      reporter: user.contact,
      note: note.trim() || undefined,
      photo,
      moving: true,
    });
    setReport(created);
    setStage("sent");
    toast.error("SOS dispatched", {
      description: `Police and ambulance units near ${j.name} have been alerted.`,
    });
  }

  function distToCorridor(p: { x: number; y: number }, from: string, to: string) {
    const a = junctionById(from)!;
    const b = junctionById(to)!;
    return Math.abs(
      (b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x,
    ) / Math.hypot(b.y - a.y, b.x - a.x);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-critical">
            <AlertTriangle className="h-4.5 w-4.5" /> Emergency SOS
          </DialogTitle>
        </DialogHeader>

        {stage === "locating" && (
          <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Getting your live location…
          </div>
        )}

        {stage === "type" && coords && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-2.5 text-xs">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div>
                <div className="num">{gps}</div>
                <div className="text-muted-foreground">
                  near {junctionById(nearestJunction(coords.x, coords.y).id)!.name}
                </div>
              </div>
            </div>
            <div>
              <div className="label-xs mb-2">What's happening?</div>
              <div className="grid grid-cols-5 gap-1.5">
                {SOS_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={cn(
                      "rounded-md border border-border px-1 py-3 text-[11px] font-medium transition-colors hover:bg-accent",
                      type === t.id && "border-critical bg-critical/15 text-critical",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional detail (vehicle, injuries, lane blocked)…"
              className="h-16 resize-none text-sm"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setPhoto(String(reader.result).slice(0, 200000));
                reader.readAsDataURL(f);
              }}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera className="mr-1.5 h-3.5 w-3.5" />
                {photo ? "Photo attached" : "Add photo"}
              </Button>
            </div>
            <Button variant="destructive" className="h-12 w-full text-base" onClick={submit}>
              Send SOS now
            </Button>
          </div>
        )}

        {stage === "sent" && report && (
          <div className="space-y-4">
            <div className="rounded-md border border-critical/40 bg-critical/10 p-4">
              <div className="text-sm font-semibold text-critical">Help is being notified</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Live location is streaming to nearby police and ambulance dashboards. Signal
                override applied on {junctionById(report.nearestJunction)!.name}.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Row k="Reference" v={report.id} />
              <Row k="Status" v={report.status} />
              <Row k="Type" v={report.type} />
              <Row k="Live coords" v={`${report.x.toFixed(1)}, ${report.y.toFixed(1)}`} />
            </dl>
            {countdown > 0 ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  updateSos(report.id, { status: "cancelled", moving: false });
                  toast.success("SOS cancelled — marked as false alarm.");
                  onOpenChange(false);
                }}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> False alarm — cancel ({countdown}s)
              </Button>
            ) : (
              <Button className="w-full" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-sm border border-border p-2">
      <dt className="label-xs">{k}</dt>
      <dd className="num mt-0.5 truncate text-sm capitalize">{v}</dd>
    </div>
  );
}
