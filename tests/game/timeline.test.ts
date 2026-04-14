import {
  GAME_DURATION_MS,
  CHEST_EVENTS,
  WAVE_EVENTS,
  getActiveChest,
  getElapsedPhase,
  getUpcomingEvents,
  isGameOver,
} from "@/lib/game/timeline";

describe("timeline", () => {
  it("defines the locked six-minute match cadence", () => {
    expect(GAME_DURATION_MS).toBe(360_000);
    expect(WAVE_EVENTS.map((event) => event.atMs)).toEqual([0, 90_000, 180_000, 270_000, 330_000, 360_000]);
    expect(CHEST_EVENTS.map((event) => event.atMs)).toEqual([30_000, 60_000, 120_000, 180_000, 240_000, 300_000]);
  });

  it("returns the active chest during its 23 second window", () => {
    expect(getActiveChest(31_000)?.id).toBe("chest-1");
    expect(getActiveChest(54_000)).toBeNull();
  });

  it("exposes the current phase and upcoming events", () => {
    expect(getElapsedPhase(0)).toBe("live");
    expect(getElapsedPhase(360_000)).toBe("sudden-end");
    expect(isGameOver(360_000)).toBe(true);
    expect(getUpcomingEvents(175_000, 2).map((event) => event.id)).toEqual(["wave-3", "chest-4"]);
  });
});
