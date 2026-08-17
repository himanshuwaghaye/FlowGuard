/**
 * FlowGuard client state: accounts, OTP session, SOS pipeline, signal overrides.
 *
 * BACKEND NOTE: everything here is persisted to localStorage and broadcast
 * across tabs via the `storage` event, which simulates realtime. Connect
 * a live backend / Supabase to swap this for real auth + OTP delivery + a live database.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { JUNCTIONS, junctionById } from "./traffic";

export type Role = "citizen" | "police" | "ambulance" | "authority";

export const ROLE_LABEL: Record<Role, string> = {
  citizen: "Citizen",
  police: "Police",
  ambulance: "Ambulance / Emergency",
  authority: "Planning Authority",
};

export const ROLE_HOME: Record<Role, string> = {
  citizen: "/",
  police: "/responder",
  ambulance: "/responder",
  authority: "/planner",
};

export interface Account {
  id: string;
  contact: string;
  role: Role;
  badgeId?: string | undefined;
  verified: boolean;
  createdAt: number;
}

export type SosStatus = "new" | "acknowledged" | "enroute" | "resolved" | "cancelled";
export type SosType = "accident" | "breakdown" | "fire" | "medical" | "other" | "pothole" | "signal";

export interface SosReport {
  id: string;
  type: SosType;
  status: SosStatus;
  createdAt: number;
  updatedAt: number;
  x: number;
  y: number;
  nearestJunction: string;
  corridorId?: string | undefined;
  highway: boolean;
  reporter: string;
  note?: string | undefined;
  photo?: string | undefined;
  moving: boolean;
  handledBy?: string | undefined;
}

export interface SignalEdit {
  id: string;
  junctionId: string;
  junctionName?: string;
  ward?: string;
  from: number;
  to: number;
  by: string;
  role: Role;
  at: number;
  reason: string;
  directions?: { north?: number; south?: number; east?: number; west?: number };
}

interface AppState {
  accounts: Account[];
  session: string | null;
  reports: SosReport[];
  overrides: Record<string, number>;
  edits: SignalEdit[];
}

const EMPTY: AppState = { accounts: [], session: null, reports: [], overrides: {}, edits: [] };
const KEY = "flowguard.state.v1";

function load(): AppState {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as AppState) };
  } catch {
    return { ...EMPTY };
  }
}

interface Ctx {
  ready: boolean;
  state: AppState;
  user: Account | null;
  canEdit: boolean;
  signIn: (contact: string, role: Role, badgeId?: string) => Account;
  signOut: () => void;
  accountFor: (contact: string) => Account | undefined;
  createSos: (r: Omit<SosReport, "id" | "createdAt" | "updatedAt" | "status">) => SosReport;
  updateSos: (id: string, patch: Partial<SosReport>) => void;
  setOverride: (
    junctionId: string,
    value: number,
    reason: string,
    directions?: { north?: number; south?: number; east?: number; west?: number },
  ) => void;
  clearOverride: (junctionId: string) => void;
  resetAllOverrides: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function canEditSignals(user: Account | null | undefined): boolean {
  return user?.role === "police" || user?.role === "authority";
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({ ...EMPTY });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(load());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((next: AppState) => {
    setState(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* quota — non fatal */
    }
  }, []);

  const user = useMemo(
    () => state.accounts.find((a) => a.id === state.session) ?? null,
    [state.accounts, state.session],
  );

  const canEdit = useMemo(() => canEditSignals(user), [user]);

  const value: Ctx = {
    ready,
    state,
    user,
    canEdit,
    accountFor: (contact) => state.accounts.find((a) => a.contact === contact),
    signIn: (contact, role, badgeId) => {
      const existing = state.accounts.find((a) => a.contact === contact);
      const account: Account = existing ?? {
        id: `u_${Math.random().toString(36).slice(2, 9)}`,
        contact,
        role,
        badgeId,
        verified: role === "citizen" ? true : Boolean(badgeId),
        createdAt: Date.now(),
      };
      const accounts = existing
        ? state.accounts.map((a) => (a.id === account.id ? account : a))
        : [...state.accounts, account];
      commit({ ...state, accounts, session: account.id });
      return account;
    },
    signOut: () => commit({ ...state, session: null }),
    createSos: (r) => {
      const report: SosReport = {
        ...r,
        id: `sos_${Date.now().toString(36)}`,
        status: "new",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      commit({ ...state, reports: [report, ...state.reports] });
      return report;
    },
    updateSos: (id, patch) =>
      commit({
        ...state,
        reports: state.reports.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r,
        ),
      }),
    setOverride: (junctionId, value, reason, directions) => {
      const junc = junctionById(junctionId);
      const prev = state.overrides[junctionId] ?? junc?.baseGreen ?? 40;
      const edit: SignalEdit = {
        id: `e_${Date.now().toString(36)}`,
        junctionId,
        junctionName: junc?.name,
        ward: junc?.ward,
        from: prev,
        to: value,
        by: user?.contact ?? "Duty Officer",
        role: user?.role ?? "authority",
        at: Date.now(),
        reason: reason || "Manual traffic regulation",
        directions,
      };
      commit({
        ...state,
        overrides: { ...state.overrides, [junctionId]: value },
        edits: [edit, ...state.edits],
      });
    },
    clearOverride: (junctionId) => {
      const next = { ...state.overrides };
      delete next[junctionId];
      commit({ ...state, overrides: next });
    },
    resetAllOverrides: () => {
      commit({ ...state, overrides: {} });
    },
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}

export function nearestJunction(x: number, y: number) {
  return JUNCTIONS.reduce((best, j) =>
    Math.hypot(j.x - x, j.y - y) < Math.hypot(best.x - x, best.y - y) ? j : best,
  );
}

export const activeStatuses: SosStatus[] = ["new", "acknowledged", "enroute"];

export function isActive(r: SosReport) {
  return activeStatuses.includes(r.status);
}

export function sinceLabel(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export const SOS_TYPES: { id: SosType; label: string }[] = [
  { id: "accident", label: "Accident" },
  { id: "breakdown", label: "Breakdown" },
  { id: "fire", label: "Fire" },
  { id: "medical", label: "Medical" },
  { id: "other", label: "Other" },
];

export const REPORT_TYPES: { id: SosType; label: string }[] = [
  { id: "accident", label: "Accident" },
  { id: "pothole", label: "Pothole" },
  { id: "signal", label: "Signal fault" },
  { id: "other", label: "Construction" },
];
