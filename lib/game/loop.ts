import { ARENA_SIZE, DASH_COOLDOWN_MS, DASH_DURATION_MS } from "@/lib/game/config";
import { getPlayerMoveScale } from "@/lib/game/ai";
import type { CombatStats } from "@/lib/game/loot";
import type { PlayerSnapshot, ChestSnapshot } from "@/lib/game/types";
import { fireBullet, tickBullets, type Bullet } from "@/lib/game/weapon";
import { tickMobs, damageZombie, type Zombie } from "@/lib/game/mob";

export type InputState = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  firing: boolean;
  dashPressed: boolean;
};

export type DashState = {
  activeUntil: number;
  cooldownUntil: number;
};

export type TickInput = {
  player: PlayerSnapshot;
  stats: CombatStats;
  input: InputState;
  dash: DashState;
  bullets: Bullet[];
  zombies: Zombie[];
  remotePlayers: PlayerSnapshot[];
  chests: ChestSnapshot[];
  deltaMs: number;
  now: number;
  lastShotAt: number;
};

export type TickOutput = {
  player: PlayerSnapshot;
  dash: DashState;
  bullets: Bullet[];
  zombies: Zombie[];
  newBullet: Bullet | null;
  lastShotAt: number;
  damageDealt: number;
  killCount: number;
};

const PLAYER_RADIUS = 18;

export function tickGame(input: TickInput): TickOutput {
  const { player, stats, input: ctrl, dash, now, deltaMs } = input;
  const dt = deltaMs / 1000;

  // dash
  let nextDash = dash;
  if (ctrl.dashPressed && now > dash.cooldownUntil) {
    nextDash = { activeUntil: now + DASH_DURATION_MS, cooldownUntil: now + DASH_COOLDOWN_MS };
  }
  const dashActive = now < nextDash.activeUntil;

  // movement
  const scale = getPlayerMoveScale({ downed: player.downed, dashActive, firing: ctrl.firing });
  const moveLen = Math.hypot(ctrl.moveX, ctrl.moveY);
  const nmx = moveLen > 0 ? ctrl.moveX / moveLen : 0;
  const nmy = moveLen > 0 ? ctrl.moveY / moveLen : 0;
  const nx = Math.max(PLAYER_RADIUS, Math.min(ARENA_SIZE - PLAYER_RADIUS, player.x + nmx * stats.speed * scale * dt));
  const ny = Math.max(PLAYER_RADIUS, Math.min(ARENA_SIZE - PLAYER_RADIUS, player.y + nmy * stats.speed * scale * dt));

  // fire
  let newBullet: Bullet | null = null;
  let lastShotAt = input.lastShotAt;
  if (ctrl.firing && !player.downed) {
    newBullet = fireBullet(player, ctrl.aimX, ctrl.aimY, now, stats, lastShotAt);
    if (newBullet) lastShotAt = now;
  }

  // tick bullets
  const allBullets = newBullet ? [...input.bullets, newBullet] : input.bullets;
  const movedBullets = tickBullets(allBullets, deltaMs, now, ARENA_SIZE);

  // bullet-zombie AABB collision
  let zombies = input.zombies;
  let damageDealt = 0;
  let killCount = 0;
  const survivingBullets: Bullet[] = [];

  for (const bullet of movedBullets) {
    let hit = false;
    zombies = zombies.map((z) => {
      if (hit) return z;
      if (Math.abs(bullet.x - z.x) < 20 && Math.abs(bullet.y - z.y) < 20) {
        hit = true;
        const next = damageZombie(z, stats.damage, now);
        damageDealt += stats.damage;
        if (next.hp <= 0) killCount += 1;
        return next;
      }
      return z;
    });
    if (!hit) survivingBullets.push(bullet);
  }

  // remove dead
  zombies = zombies.filter((z) => z.hp > 0);

  // mob tick
  const allPlayers: PlayerSnapshot[] = [{ ...player, x: nx, y: ny }, ...input.remotePlayers];
  zombies = tickMobs(zombies, allPlayers, input.chests, deltaMs, now);

  // zombie contact damage
  let hp = player.hp;
  if (!player.downed) {
    for (const z of zombies) {
      if (Math.hypot(z.x - nx, z.y - ny) < 22) {
        hp -= z.damage * (1 - (stats.armorMitigation ?? 0)) * dt;
      }
    }
  }
  hp = Math.max(0, Math.min(player.maxHp, hp));

  return {
    player: { ...player, x: nx, y: ny, hp, downed: hp <= 0, updatedAt: now },
    dash: nextDash,
    bullets: survivingBullets,
    zombies,
    newBullet,
    lastShotAt,
    damageDealt,
    killCount,
  };
}
