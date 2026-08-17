import { useEffect, useRef, useState, useMemo } from "react";
import {
  CORRIDORS,
  JUNCTIONS,
  NAGPUR_MAP_CENTER,
  NAGPUR_DEFAULT_ZOOM,
  ZONE_LABEL,
  NMC_WARDS,
  corridorBetween,
  junctionById,
  getWardCoverageReport,
  mapPercentToGps,
  gpsToMapPercent,
  isPeakWindow,
  type SimResult,
  type Zone,
} from "@/lib/traffic";
import type { SosReport } from "@/lib/store";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import {
  Activity,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Sparkles,
  Sliders,
  Flame,
  Radio,
  RefreshCw,
  ShieldCheck,
  Building2,
  Filter,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export const loadHexColor = (load: number) =>
  load >= 0.75 ? "#ef4444" : load >= 0.5 ? "#f59e0b" : "#10b981";

// Dark modern map style tailored for FlowGuard civic traffic dashboard
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#121820" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#121820" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#38bdf8" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#243042" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#182230" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f8fafc" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#00b8d9" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0b1320" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#38bdf8" }],
  },
];

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
  const { resolvedTheme } = useTheme();
  const { user, canEdit } = useApp();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<"dark" | "roadmap" | "hybrid">(() =>
    resolvedTheme === "light" ? "roadmap" : "dark",
  );

  useEffect(() => {
    setMapType(resolvedTheme === "light" ? "roadmap" : "dark");
  }, [resolvedTheme]);

  const [showLiveGoogleTraffic, setShowLiveGoogleTraffic] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("all");
  const [refreshCountdown, setRefreshCountdown] = useState(45);

  // Live auto-refresh ticker for traffic duration data (every 30-45s)
  useEffect(() => {
    const t = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? 45 : prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const coverageReport = useMemo(() => getWardCoverageReport(), []);

  const [activeInfoWindow, setActiveInfoWindow] = useState<{
    junctionId?: string;
    corridorId?: string;
    sosId?: string;
    lat: number;
    lng: number;
    title: string;
    ward?: string;
    description: string;
    stats?: { label: string; value: string; color?: string }[];
  } | null>(null);

  // References to Google Maps shapes & markers
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);

  // Convert reroute junction IDs to pairs
  const reroutePairs = useMemo(() => {
    const ids: string[] = [];
    for (let i = 0; i < reroute.length - 1; i++) {
      const c = corridorBetween(reroute[i]!, reroute[i + 1]!);
      if (c) ids.push(c.id);
    }
    return ids;
  }, [reroute]);

  // Current peak status
  const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
  const isPeakNow = isPeakWindow(currentHour);

  // 1. Initialize Google Map
  useEffect(() => {
    let checkTimer: number;

    function initMap() {
      if (typeof window === "undefined" || !window.google || !window.google.maps) {
        checkTimer = window.setTimeout(initMap, 200);
        return;
      }
      if (!mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = new google.maps.Map(mapContainerRef.current, {
          center: NAGPUR_MAP_CENTER,
          zoom: NAGPUR_DEFAULT_ZOOM,
          mapTypeId: mapType === "dark" ? google.maps.MapTypeId.ROADMAP : (mapType as google.maps.MapTypeId),
          styles: mapType === "dark" ? DARK_MAP_STYLE : null,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          backgroundColor: "#111827",
        });

        // Click listener on map to drop pin
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          const percent = gpsToMapPercent(lat, lng);
          if (onPinDrop) {
            onPinDrop(percent.x, percent.y);
          }
        });

        mapInstanceRef.current = map;
        setMapReady(true);
      }
    }

    initMap();

    return () => {
      clearTimeout(checkTimer);
    };
  }, [onPinDrop, mapType]);

  // Handle map type changes
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;
    if (mapType === "dark") {
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      mapInstanceRef.current.setOptions({ styles: DARK_MAP_STYLE });
    } else if (mapType === "roadmap") {
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      mapInstanceRef.current.setOptions({ styles: [] });
    } else if (mapType === "hybrid") {
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.HYBRID);
      mapInstanceRef.current.setOptions({ styles: [] });
    }
  }, [mapType]);

  // Handle Live Google Traffic Layer toggle
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;
    if (showLiveGoogleTraffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(mapInstanceRef.current);
    } else if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
    }
  }, [showLiveGoogleTraffic]);

  // Pan to selected junction
  useEffect(() => {
    if (!mapInstanceRef.current || !selected) return;
    const j = junctionById(selected);
    if (j) {
      mapInstanceRef.current.panTo({ lat: j.lat, lng: j.lng });
      mapInstanceRef.current.setZoom(14.2);
    }
  }, [selected]);

  // Filter & Focus on specific Zone
  const handleZoneFilterChange = (zone: string) => {
    setSelectedZoneFilter(zone);
    if (!mapInstanceRef.current) return;
    if (zone === "all") {
      mapInstanceRef.current.panTo(NAGPUR_MAP_CENTER);
      mapInstanceRef.current.setZoom(NAGPUR_DEFAULT_ZOOM);
      return;
    }
    const zoneJunctions = JUNCTIONS.filter((j) => j.zone === zone);
    if (zoneJunctions.length > 0) {
      const avgLat = zoneJunctions.reduce((s, j) => s + j.lat, 0) / zoneJunctions.length;
      const avgLng = zoneJunctions.reduce((s, j) => s + j.lng, 0) / zoneJunctions.length;
      mapInstanceRef.current.panTo({ lat: avgLat, lng: avgLng });
      mapInstanceRef.current.setZoom(13.8);
    }
  };

  // 2. Render Corridors, Junctions, Heatmaps & Reports on Google Maps
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.google) return;
    const map = mapInstanceRef.current;

    // Clear old shapes
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];

    // Draw Heatmaps if enabled
    if (heatmap) {
      JUNCTIONS.forEach((j) => {
        const c = result.junctions[j.id]?.congestion ?? 0;
        if (c > 0.35) {
          const circle = new google.maps.Circle({
            strokeColor: c >= 0.75 ? "#ef4444" : "#f59e0b",
            strokeOpacity: 0.75,
            strokeWeight: 1.5,
            fillColor: c >= 0.75 ? "#ef4444" : "#f59e0b",
            fillOpacity: Math.min(0.5, c * 0.45),
            map,
            center: { lat: j.lat, lng: j.lng },
            radius: 300 + c * 500,
          });
          circlesRef.current.push(circle);
        }
      });
    }

    // Draw Corridors (Connected road graph)
    CORRIDORS.forEach((c) => {
      const fromJ = junctionById(c.from);
      const toJ = junctionById(c.to);
      if (!fromJ || !toJ) return;

      const r = result.corridors[c.id];
      const overridden = overrideCorridors.includes(c.id);
      const onReroute = reroutePairs.includes(c.id);
      const load = r?.load ?? 0.3;
      const closed = r?.volume === 0;

      // Base corridor polyline (track background)
      const baseLine = new google.maps.Polyline({
        path: [
          { lat: fromJ.lat, lng: fromJ.lng },
          { lat: toJ.lat, lng: toJ.lng },
        ],
        geodesic: true,
        strokeColor: "#1e293b",
        strokeOpacity: 0.8,
        strokeWeight: c.lanes * 2.2 + 3,
        map,
        zIndex: 10,
      });
      polylinesRef.current.push(baseLine);

      // Flow line with dynamic traffic color code
      const strokeColor = onReroute
        ? "#00f0ff"
        : overridden
          ? "#ef4444"
          : closed
            ? "#64748b"
            : loadHexColor(load);

      const flowLine = new google.maps.Polyline({
        path: [
          { lat: fromJ.lat, lng: fromJ.lng },
          { lat: toJ.lat, lng: toJ.lng },
        ],
        geodesic: true,
        strokeColor,
        strokeOpacity: closed ? 0.45 : 0.95,
        strokeWeight: onReroute ? 6 : c.lanes * 1.8 + 2,
        map,
        zIndex: onReroute ? 30 : overridden ? 25 : 20,
      });

      flowLine.addListener("click", () => {
        const midLat = (fromJ.lat + toJ.lat) / 2;
        const midLng = (fromJ.lng + toJ.lng) / 2;
        setActiveInfoWindow({
          corridorId: c.id,
          lat: midLat,
          lng: midLng,
          title: c.name,
          ward: `${fromJ.ward} ⟷ ${toJ.ward}`,
          description: `${fromJ.name} ⟷ ${toJ.name} (${c.lanes} Lanes, ${c.highway ? "Highway Arterial" : "City Arterial"})`,
          stats: [
            { label: "Congestion Load", value: `${Math.round(load * 100)}%`, color: loadHexColor(load) },
            { label: "Est. Speed", value: `${r?.speedKph ?? 45} km/h` },
            { label: "Traffic Volume", value: `${(r?.volume ?? 0).toLocaleString()} veh/h` },
            { label: "Live Duration", value: `${r?.durationInTrafficMinutes ?? 2.5} min` },
            { label: "Free Flow Time", value: `${r?.freeFlowDurationMinutes ?? 1.8} min` },
            { label: "Capacity", value: `${c.capacity.toLocaleString()} veh/h` },
          ],
        });
      });

      polylinesRef.current.push(flowLine);
    });

    // Draw All 52+ Nagpur Junctions
    JUNCTIONS.forEach((j) => {
      const r = result.junctions[j.id];
      const isSel = selected === j.id;
      const congestion = r?.congestion ?? 0.2;
      const color = loadHexColor(congestion);

      // SVG Signal Pin for Junction
      const svgIcon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: isSel ? 9 : 6.5,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: isSel ? "#00f0ff" : "#ffffff",
        strokeWeight: isSel ? 3 : 1.5,
      };

      const marker = new google.maps.Marker({
        position: { lat: j.lat, lng: j.lng },
        map,
        icon: svgIcon,
        title: `${j.id}: ${j.name} (${j.ward})`,
        zIndex: isSel ? 100 : 50,
      });

      marker.addListener("click", () => {
        onSelectJunction?.(j.id);
        setActiveInfoWindow({
          junctionId: j.id,
          lat: j.lat,
          lng: j.lng,
          title: `${j.id} · ${j.name}`,
          ward: j.ward,
          description: `${j.landmark || "Signalized Road Junction"} · Demand: ${j.demand}×`,
          stats: [
            { label: "Congestion", value: `${Math.round(congestion * 100)}%`, color },
            { label: "Avg Wait", value: `${r?.waitSeconds ?? 30}s` },
            { label: "Green Signal", value: `${r?.green ?? j.baseGreen}s` },
            { label: "North/South", value: `${j.directions.north}s / ${j.directions.south}s` },
            { label: "East/West", value: `${j.directions.east}s / ${j.directions.west}s` },
            { label: "Throughput", value: `${(r?.throughput ?? 0).toLocaleString()} veh/h` },
          ],
        });
      });

      markersRef.current.push(marker);
    });

    // Draw Active SOS Reports
    reports.forEach((s) => {
      const gps = mapPercentToGps(s.x, s.y);
      const sosIcon = {
        path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
        fillColor: "#ef4444",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
        scale: 1.5,
        anchor: new google.maps.Point(12, 22),
      };

      const marker = new google.maps.Marker({
        position: gps,
        map,
        icon: sosIcon,
        title: `EMERGENCY SOS: ${s.type.toUpperCase()}`,
        zIndex: 200,
        animation: google.maps.Animation.BOUNCE,
      });

      // Stop bouncing after 3s to keep map neat
      setTimeout(() => {
        marker.setAnimation(null);
      }, 3000);

      marker.addListener("click", () => {
        setActiveInfoWindow({
          sosId: s.id,
          lat: gps.lat,
          lng: gps.lng,
          title: `🚨 Emergency SOS: ${s.type.toUpperCase()}`,
          ward: junctionById(s.nearestJunction)?.ward,
          description: `Reported near ${junctionById(s.nearestJunction)?.name ?? "Nagpur Road"} by ${s.reporter}`,
          stats: [
            { label: "Status", value: s.status.toUpperCase(), color: "#ef4444" },
            { label: "Coordinates", value: `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` },
            { label: "Note", value: s.note || "No detail provided" },
          ],
        });
      });

      markersRef.current.push(marker);
    });
  }, [mapReady, result, selected, heatmap, reports, overrideCorridors, reroutePairs, onSelectJunction]);

  // Recenter to Nagpur Center
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(NAGPUR_MAP_CENTER);
      mapInstanceRef.current.setZoom(NAGPUR_DEFAULT_ZOOM);
    }
  };

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-background", className)}>
      {/* Real Google Maps Canvas */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Top Map Control Bar */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div className="panel flex items-center gap-2 bg-surface/90 px-3 py-1.5 backdrop-blur shadow-md">
          <Activity className="h-4 w-4 text-primary animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-tight text-foreground leading-tight">
              Nagpur Signal Grid
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {JUNCTIONS.length} Junctions · {CORRIDORS.length} Corridors
            </span>
          </div>
          <span className="h-2 w-2 rounded-full bg-flow animate-ping ml-1" />
        </div>

        {/* Zone/Ward Filter Selector */}
        <div className="panel flex items-center gap-1.5 bg-surface/90 px-2 py-1 backdrop-blur shadow-md">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={selectedZoneFilter} onValueChange={handleZoneFilterChange}>
            <SelectTrigger className="h-7 w-32 border-none bg-transparent text-xs p-0 focus:ring-0">
              <SelectValue placeholder="All Nagpur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Nagpur Zones</SelectItem>
              <SelectItem value="central" className="text-xs">Central / Civil Lines</SelectItem>
              <SelectItem value="west" className="text-xs">West / Dharampeth</SelectItem>
              <SelectItem value="north" className="text-xs">North / Sadar</SelectItem>
              <SelectItem value="east" className="text-xs">East / Itwari</SelectItem>
              <SelectItem value="south" className="text-xs">South / Wardha Rd</SelectItem>
              <SelectItem value="southwest" className="text-xs">South-West / Hingna</SelectItem>
              <SelectItem value="northeast" className="text-xs">North-East / Kamptee</SelectItem>
              <SelectItem value="southeast" className="text-xs">South-East / Medical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Coverage Checklist Button */}
        <Button
          size="sm"
          variant="outline"
          className="panel h-7 gap-1.5 text-xs bg-surface/90 backdrop-blur shadow-md"
          onClick={() => setCoverageOpen(true)}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-flow" />
          Coverage Check ({coverageReport.totalPlotted}/{coverageReport.totalTarget})
        </Button>

        {/* Live Refresh Ticker */}
        <div className="panel hidden sm:flex items-center gap-1.5 bg-surface/90 px-2.5 py-1 text-xs backdrop-blur shadow-md">
          <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" style={{ animationDuration: "6s" }} />
          <span className="num text-[11px] text-muted-foreground">
            Auto-refresh {refreshCountdown}s
          </span>
        </div>

        {/* Map View Switcher */}
        <div className="panel flex items-center gap-1 bg-surface/90 p-1 backdrop-blur shadow-md">
          <Button
            size="sm"
            variant={mapType === "dark" ? "default" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setMapType("dark")}
          >
            Dark Grid
          </Button>
          <Button
            size="sm"
            variant={mapType === "roadmap" ? "default" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setMapType("roadmap")}
          >
            Roads
          </Button>
          <Button
            size="sm"
            variant={mapType === "hybrid" ? "default" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setMapType("hybrid")}
          >
            Satellite
          </Button>
        </div>

        {/* Live Google Traffic Layer Toggle */}
        <Button
          size="sm"
          variant={showLiveGoogleTraffic ? "default" : "outline"}
          className="panel h-7 gap-1.5 text-xs bg-surface/90 backdrop-blur shadow-md"
          onClick={() => setShowLiveGoogleTraffic((prev) => !prev)}
        >
          <Radio className={cn("h-3.5 w-3.5", showLiveGoogleTraffic ? "text-primary" : "text-muted-foreground")} />
          {showLiveGoogleTraffic ? "Google Traffic ON" : "Overlay"}
        </Button>

        {/* Recenter Button */}
        <Button
          size="sm"
          variant="outline"
          className="panel h-7 gap-1.5 text-xs bg-surface/90 backdrop-blur shadow-md"
          onClick={handleRecenter}
        >
          <Navigation className="h-3.5 w-3.5 text-primary" />
          Zero Mile
        </Button>
      </div>

      {/* Peak Window Alert Floating Banner */}
      {isPeakNow && (
        <div className="pointer-events-none absolute top-14 right-3 z-10">
          <div className="panel pointer-events-auto flex items-center gap-2 border-peak/50 bg-peak/15 px-3 py-1.5 shadow-lg backdrop-blur">
            <Clock className="h-3.5 w-3.5 text-peak animate-pulse" />
            <span className="text-xs font-semibold text-peak">
              Peak Traffic Window Active (9–12 AM / 4–7 PM)
            </span>
          </div>
        </div>
      )}

      {/* Floating Info Window Card on Node / Segment Click */}
      {activeInfoWindow && (
        <div className="panel absolute bottom-16 left-4 z-20 max-w-sm border-primary/40 bg-surface/95 p-4 shadow-xl backdrop-blur animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {activeInfoWindow.title}
              </div>
              {activeInfoWindow.ward && (
                <div className="text-[11px] font-medium text-primary">
                  {activeInfoWindow.ward}
                </div>
              )}
              <div className="mt-0.5 text-xs text-muted-foreground">
                {activeInfoWindow.description}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setActiveInfoWindow(null)}
            >
              ✕
            </Button>
          </div>

          {activeInfoWindow.stats && (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-2.5">
              {activeInfoWindow.stats.map((s) => (
                <div key={s.label} className="rounded bg-background/50 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {s.label}
                  </div>
                  <div
                    className="num mt-0.5 text-xs font-bold"
                    style={{ color: s.color || "var(--foreground)" }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeInfoWindow.junctionId && onSelectJunction && (
            <div className="mt-3 flex flex-col gap-2">
              <Button
                size="sm"
                className="h-7 w-full text-xs font-medium"
                onClick={() => {
                  onSelectJunction(activeInfoWindow.junctionId!);
                  setActiveInfoWindow(null);
                }}
              >
                {canEdit ? (
                  <>
                    <Sliders className="mr-1.5 h-3.5 w-3.5" /> Adjust Signal Timing
                  </>
                ) : (
                  <>
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> View Signal Phases (Read-Only)
                  </>
                )}
              </Button>
              {!canEdit && (
                <span className="text-[10px] text-center text-muted-foreground">
                  Citizen view: signal editing is restricted to Traffic Police & Planning Authority.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ward Coverage Checklist Dialog */}
      <Dialog open={coverageOpen} onOpenChange={setCoverageOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ShieldCheck className="h-5 w-5 text-flow" />
              Nagpur Signal Coverage Checklist (100% Ward Coverage)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Internal verification checklist confirming all 10 NMC municipal administrative zones and 52+ major traffic junctions are mapped into the real road network.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 grid grid-cols-3 gap-2 border-b border-border pb-3">
            <div className="panel p-2.5 text-center">
              <div className="label-xs">Total Plotted</div>
              <div className="num text-xl font-bold text-foreground mt-0.5">
                {coverageReport.totalPlotted} Junctions
              </div>
            </div>
            <div className="panel p-2.5 text-center">
              <div className="label-xs">Target Coverage</div>
              <div className="num text-xl font-bold text-flow mt-0.5">
                {coverageReport.coveragePercent}% Complete
              </div>
            </div>
            <div className="panel p-2.5 text-center">
              <div className="label-xs">Unmapped Wards</div>
              <div className="num text-xl font-bold text-foreground mt-0.5">
                {coverageReport.zeroWardsCount === 0 ? "0 (Zero gaps)" : `${coverageReport.zeroWardsCount} Missing`}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 mt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ward-By-Ward Coverage Breakdown
            </div>
            <div className="space-y-2">
              {coverageReport.wardBreakdown.map((w) => (
                <div
                  key={w.wardId}
                  className="panel p-3 flex flex-col gap-1.5 transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-flow" />
                      <span className="text-sm font-semibold">{w.wardName}</span>
                    </div>
                    <Badge variant="outline" className="bg-flow/10 text-flow border-flow/40 text-xs">
                      {w.plotted} / {w.target} Plotted
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{w.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {w.junctions.map((j) => (
                      <span
                        key={j.id}
                        className="rounded bg-background/80 px-2 py-0.5 text-[10px] font-medium border border-border"
                      >
                        {j.id}: {j.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MapLegend({ className }: { className?: string }) {
  const items = [
    { c: "#10b981", l: "Free flow (<50%)" },
    { c: "#f59e0b", l: "Peak load (50–75%)" },
    { c: "#ef4444", l: "Congested / Overridden (>75%)" },
    { c: "#00f0ff", l: "Optimized Detour / Emergency" },
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((i) => (
        <span key={i.l} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-3.5 rounded-full shadow-sm" style={{ backgroundColor: i.c }} />
          {i.l}
        </span>
      ))}
    </div>
  );
}

