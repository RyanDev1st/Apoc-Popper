import { resolveZombieTarget } from "@/lib/game/ai";
import type { ZombieSpawnPlan } from "@/lib/game/spawns";
import type { PlayerSnapshot, ChestSnapshot } from "@/lib/game/types";
import { ARENA_SIZE, SAFE_RING_RADIUS } from "@/lib/game/config";

export type Zombie = {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  targetUid: string | null;
  lastTargetResolvedAt: number;
  hitFlashUntil: number;
};

const TARGET_REEVAL_MS = 500;
const SEPARATION_RADIUS = 48;
const SEPARATION_FORCE = 0.6;
const MAX_ZOMBIES = 40;

export function createZombie(plan: ZombieSpawnPlan, now: number): Zombie {
  return {
    id: plan.id,
    x: plan.x,
    y: plan.y,
    hp: plan.hp,
    maxHp: plan.hp,
    speed: plan.speed,
    damage: plan.damage,
    targetUid: null,
    lastTargetResolvedAt: now,
    hitFlashUntil: 0,
  };
}

export function tickMobs(
  zombies: Zombie[],
  players: PlayerSnapshot[],
  chests: ChestSnapshot[],
  deltaMs: number,
  now: number,
): Zombie[] {
  const dt = deltaMs / 1000;
  const activePlayers = players.filter((p) => !p.spectating && !p.downed);
  const openChests = chests.filter((c) => c.active);

  return zombies.map((zombie) => {
    let { targetUid, lastTargetResolvedAt } = zombie;

    if (now - lastTargetResolvedAt > TARGET_REEVAL_MS) {
      targetUid = resolveZombieTarget({ x: zombie.x, y: zombie.y, targetUid }, activePlayers);
      lastTargetResolvedAt = now;
    }

    const target = activePlayers.find((p) => p.uid === targetUid);
    if (!target) return { ...zombie, targetUid, lastTargetResolvedAt };

    const dx = target.x - zombie.x;
    const dy = target.y - zombie.y;
    const dist = Math.hypot(dx, dy);
    let vx = dist > 0 ? (dx / dist) * zombie.speed : 0;
    let vy = dist > 0 ? (dy / dist) * zombie.speed : 0;

    // separation force
    for (const other of zombies) {
      if (other.id === zombie.id) continue;
      const sdx = zombie.x - other.x;
      const sdy = zombie.y - other.y;
      const sdist = Math.hypot(sdx, sdy);
      if (sdist > 0 && sdist < SEPARATION_RADIUS) {
        vx += (sdx / sdist) * SEPARATION_FORCE * zombie.speed;
        vy += (sdy / sdist) * SEPARATION_FORCE * zombie.speed;
      }
    }

    // chest deflection
    for (const chest of openChests) {
      const cdx = zombie.x - chest.x;
      const cdy = zombie.y - chest.y;
      const cdist = Math.hypot(cdx, cdy);
      if (cdist < SAFE_RING_RADIUS && cdist > 0) {
        vx += (-cdy / cdist) * zombie.speed * 0.8;
        vy += (cdx / cdist) * zombie.speed * 0.8;
      }
    }

    return {
      ...zombie,
      x: Math.max(12, Math.min(ARENA_SIZE - 12, zombie.x + vx * dt)),
      y: Math.max(12, Math.min(ARENA_SIZE - 12, zombie.y + vy * dt)),
      targetUid,
      lastTargetResolvedAt,
    };
  });
}

export function damageZombie(zombie: Zombie, damage: number, now: number): Zombie {
  return { ...zombie, hp: zombie.hp - damage, hitFlashUntil: now + 80 };
}

export function enforceZombieCap(existing: Zombie[], incoming: Zombie[]): Zombie[] {
  const combined = [...existing, ...incoming];
  if (combined.length <= MAX_ZOMBIES) return combined;
  return combined.slice(combined.length - MAX_ZOMBIES);
}
