import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(url, key);
export const CHANNEL_NAME = "quiz-survivors-room";

export function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem("quiz-survivors-uid");
  if (stored) return stored;
  const id = `player-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem("quiz-survivors-uid", id);
  return id;
}
