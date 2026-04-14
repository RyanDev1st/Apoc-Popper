import type { CombatStats } from "@/lib/game/loot";

export type Bullet = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
};

const BULLET_TTL_MS = 1200;
const BASE_BULLET_SPEED = 480;
const SPEED_PER_TIER = 60;

export function fireBullet(
  player: { uid: string; x: number; y: number },
  aimX: number,
  aimY: number,
  now: number,
  stats: CombatStats,
  lastShotAt: number,
): Bullet | null {
  if (now - lastShotAt < stats.fireRateMs) return null;
  const mag = Math.hypot(aimX, aimY);
  if (mag === 0) return null;
  const nx = aimX / mag;
  const ny = aimY / mag;
  const speed = BASE_BULLET_SPEED + stats.weaponTier * SPEED_PER_TIER;
  return {
    id: `b-${player.uid}-${now}`,
    x: player.x,
    y: player.y,
    vx: nx * speed,
    vy: ny * speed,
    ttl: now + BULLET_TTL_MS,
  };
}

export function tickBullets(
  bullets: Bullet[],
  deltaMs: number,
  now: number,
  arenaSize: number,
): Bullet[] {
  const dt = deltaMs / 1000;
  return bullets
    .filter((b) => b.ttl > now && b.x >= 0 && b.x <= arenaSize && b.y >= 0 && b.y <= arenaSize)
    .map((b) => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt }));
}
