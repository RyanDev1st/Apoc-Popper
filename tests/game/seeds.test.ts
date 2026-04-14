import { buildBurstPlan } from "@/lib/game/spawns";

describe("spawn planning", () => {
  it("produces deterministic burst plans from the same seed and player count", () => {
    const first = buildBurstPlan({ waveIndex: 2, playerCount: 5, seed: "wave-2-seed" });
    const second = buildBurstPlan({ waveIndex: 2, playerCount: 5, seed: "wave-2-seed" });

    expect(second).toEqual(first);
    expect(first.zombies.length).toBeLessThanOrEqual(40);
  });

  it("scales burst intensity down for lower player counts", () => {
    const duo = buildBurstPlan({ waveIndex: 3, playerCount: 2, seed: "wave-3-seed" });
    const squad = buildBurstPlan({ waveIndex: 3, playerCount: 8, seed: "wave-3-seed" });

    expect(duo.zombies.length).toBeLessThan(squad.zombies.length);
    expect(duo.profile.hpMultiplier).toBeLessThan(squad.profile.hpMultiplier);
  });
});
