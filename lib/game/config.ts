import type { ChestSnapshot, MatchMeta } from "@/lib/game/types";

export const ROOM_ID = "presentation-room";
export const ARENA_SIZE = 1_536;
export const PLAYER_RADIUS = 18;
export const CHEST_RADIUS = 72;
export const SAFE_RING_RADIUS = 116;
export const PLAYER_SYNC_MS = 100;
export const DASH_DURATION_MS = 400;
export const DASH_COOLDOWN_MS = 2_000;
export const REVIVE_WINDOW_MS = 25_000;
export const REVIVE_HOLD_MS = 3_000;

export const DEFAULT_META: MatchMeta = {
  status: "waiting",
  startedAt: null,
  endedAt: null,
  hostUid: null,
  timelineVersion: 1,
  connectedCount: 0,
  globalKillCount: 0,
};

export const CHEST_LAYOUT: Pick<ChestSnapshot, "id" | "x" | "y">[] = [
  { id: "chest-1", x: 220, y: 300 },
  { id: "chest-2", x: 1_300, y: 260 },
  { id: "chest-3", x: 520, y: 1_240 },
  { id: "chest-4", x: 760, y: 760 },
  { id: "chest-5", x: 1_280, y: 1_120 },
  { id: "chest-6", x: 260, y: 1_120 },
];

export const SPAWN_POINTS = [
  { x: 128, y: 128 },
  { x: 1_408, y: 128 },
  { x: 128, y: 1_408 },
  { x: 1_408, y: 1_408 },
  { x: 768, y: 768 },
];

export function clampToArena(value: number): number {
  return Math.max(PLAYER_RADIUS, Math.min(ARENA_SIZE - PLAYER_RADIUS, value));
}
