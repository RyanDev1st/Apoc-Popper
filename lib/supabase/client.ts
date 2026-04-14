import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const CHANNEL_NAME = "quiz-survivors-room";

// Lazy client — avoids throwing at module load when env vars are absent
let _supabase: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!_supabase) {
    if (!url || !key) throw new Error("Supabase env vars not configured");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Backward-compat export used by room.ts helpers
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export function hasSupabaseConfig(): boolean {
  return Boolean(url && key);
}

export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem("quiz-survivors-uid");
  if (stored) return stored;
  const id = `player-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem("quiz-survivors-uid", id);
  return id;
}
