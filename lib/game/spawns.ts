import seedrandom from "seedrandom";

export type BurstPlanInput = {
  waveIndex: number;
  playerCount: number;
  seed: string;
};

export type ZombieSpawnPlan = {
  id: string;
  x: number;
  y: number;
  hp: number;
  speed: number;
  damage: number;
};

export type BurstPlan = {
  profile: {
    hpMultiplier: number;
    speedMultiplier: number;
    damageMultiplier: number;
  };
  zombies: ZombieSpawnPlan[];
};

const ARENA_SIZE = 1_536;
const MAX_ZOMBIES = 40;

export function buildBurstPlan(input: BurstPlanInput): BurstPlan {
  const rng = seedrandom(`${input.seed}:${input.waveIndex}:${input.playerCount}`);
  const playerScale = 0.75 + Math.max(0, Math.min(input.playerCount, 8) - 1) * 0.075;
  const waveScale = Math.pow(1.34, Math.max(0, input.waveIndex - 1));
  const count = Math.min(MAX_ZOMBIES, Math.max(8, Math.round((10 + input.waveIndex * 4) * playerScale)));
  const hpMultiplier = roundStat(waveScale * playerScale);
  const speedMultiplier = roundStat((1 + input.waveIndex * 0.07) * (0.96 + input.playerCount * 0.02));
  const damageMultiplier = roundStat((1 + input.waveIndex * 0.12) * (0.92 + input.playerCount * 0.03));
  const zombies: ZombieSpawnPlan[] = [];

  for (let index = 0; index < count; index += 1) {
    const edge = Math.floor(rng() * 4);
    const offset = Math.round(rng() * ARENA_SIZE);
    const variance = Math.round((rng() - 0.5) * 64);
    const [x, y] =
      edge === 0
        ? [variance, offset]
        : edge === 1
          ? [ARENA_SIZE + variance, offset]
          : edge === 2
            ? [offset, variance]
            : [offset, ARENA_SIZE + variance];

    zombies.push({
      id: `z-${input.waveIndex}-${index}`,
      x,
      y,
      hp: Math.round(32 * hpMultiplier + rng() * 12),
      speed: roundStat(42 * speedMultiplier + rng() * 8),
      damage: Math.round(8 * damageMultiplier + rng() * 3),
    });
  }

  return {
    profile: {
      hpMultiplier,
      speedMultiplier,
      damageMultiplier,
    },
    zombies,
  };
}

function roundStat(value: number): number {
  return Math.round(value * 100) / 100;
}
