export type TimelineEventKind = "wave" | "chest" | "meteor" | "gas" | "end";

export type TimelineEvent = {
  id: string;
  atMs: number;
  label: string;
  kind: TimelineEventKind;
  durationMs?: number;
};

export const GAME_DURATION_MS = 360_000;
export const CHEST_DURATION_MS = 23_000;

export const WAVE_EVENTS: TimelineEvent[] = [
  { id: "wave-1", atMs: 0, label: "Wave 1", kind: "wave" },
  { id: "wave-2", atMs: 90_000, label: "Wave 2", kind: "wave" },
  { id: "wave-3", atMs: 180_000, label: "Wave 3", kind: "wave" },
  { id: "wave-4", atMs: 270_000, label: "Wave 4", kind: "wave" },
  { id: "wave-5", atMs: 330_000, label: "Wave 5", kind: "wave" },
  { id: "wave-end", atMs: GAME_DURATION_MS, label: "Sudden End", kind: "end" },
];

export const CHEST_EVENTS: TimelineEvent[] = [
  { id: "chest-1", atMs: 30_000, label: "Chest 1", kind: "chest", durationMs: CHEST_DURATION_MS },
  { id: "chest-2", atMs: 60_000, label: "Chest 2", kind: "chest", durationMs: CHEST_DURATION_MS },
  { id: "chest-3", atMs: 120_000, label: "Chest 3", kind: "chest", durationMs: CHEST_DURATION_MS },
  { id: "chest-4", atMs: 180_000, label: "Chest 4", kind: "chest", durationMs: CHEST_DURATION_MS },
  { id: "chest-5", atMs: 240_000, label: "Chest 5", kind: "chest", durationMs: CHEST_DURATION_MS },
  { id: "chest-6", atMs: 300_000, label: "Chest 6", kind: "chest", durationMs: CHEST_DURATION_MS },
];

export const CATASTROPHE_EVENTS: TimelineEvent[] = [
  { id: "meteor-1", atMs: 90_000, label: "Meteor Catastrophe", kind: "meteor", durationMs: 14_000 },
  { id: "gas-1", atMs: 270_000, label: "Poison Gas", kind: "gas", durationMs: 20_000 },
  { id: "meteor-2", atMs: 330_000, label: "Meteor Catastrophe", kind: "meteor", durationMs: 14_000 },
  { id: "gas-2", atMs: 330_000, label: "Poison Gas", kind: "gas", durationMs: 20_000 },
];

export const ALL_TIMELINE_EVENTS = [...WAVE_EVENTS, ...CHEST_EVENTS, ...CATASTROPHE_EVENTS].sort(
  (left, right) => left.atMs - right.atMs,
);

export function getActiveChest(elapsedMs: number): TimelineEvent | null {
  return (
    CHEST_EVENTS.find((event) => elapsedMs >= event.atMs && elapsedMs <= event.atMs + (event.durationMs ?? 0)) ?? null
  );
}

export function getElapsedPhase(elapsedMs: number): "pregame" | "live" | "sudden-end" | "postgame" {
  if (elapsedMs < 0) {
    return "pregame";
  }

  if (elapsedMs < GAME_DURATION_MS) {
    return "live";
  }

  if (elapsedMs === GAME_DURATION_MS) {
    return "sudden-end";
  }

  return "postgame";
}

export function isGameOver(elapsedMs: number): boolean {
  return elapsedMs >= GAME_DURATION_MS;
}

export function getUpcomingEvents(elapsedMs: number, count = 3): TimelineEvent[] {
  return ALL_TIMELINE_EVENTS.filter((event) => event.atMs > elapsedMs).slice(0, count);
}

