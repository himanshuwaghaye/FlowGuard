import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Type definitions for Supabase Database tables
 */
export interface DbProfile {
  id?: string;
  contact: string;
  role: "citizen" | "police" | "ambulance" | "authority";
  badge_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbSignalOverride {
  id?: string;
  junction_id: string;
  green_seconds: number;
  directions?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  reason?: string;
  officer_contact?: string;
  officer_role?: string;
  created_at?: string;
}

export interface DbSosReport {
  id?: string;
  type: string;
  latitude: number;
  longitude: number;
  nearest_junction: string;
  status: "new" | "acknowledged" | "en_route" | "on_scene" | "resolved" | "cancelled";
  reporter_contact: string;
  note?: string | null;
  highway?: boolean;
  created_at?: string;
}
