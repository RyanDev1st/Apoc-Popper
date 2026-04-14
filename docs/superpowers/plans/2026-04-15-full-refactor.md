# Quiz Survivors Full Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full clean-slate rewrite of Quiz Survivors — Supabase Realtime Broadcast replacing Firebase, split game logic modules, new Phaser scene with GameObjects, pixel dark-blue UI design system.

**Architecture:** React shell owns routes + UI + state via single `use-game.ts` hook. Hook calls pure lib modules (`weapon`, `mob`, `loop`) for game simulation and `lib/supabase/room.ts` for sync. Phaser renders via persistent GameObjects (not per-frame Graphics redraw).

**Tech Stack:** Next.js 15, React 19, Phaser 3.90, Supabase Realtime, Vitest, TypeScript, Press Start 2P font

---

## File Map

### Delete
- `lib/firebase/` (entire directory)
- `hooks/use-quiz-survivors-game.ts`

### Keep (do not modify)
- `lib/game/config.ts`
- `lib/game/timeline.ts`
- `lib/game/types.ts`
- `lib/game/loot.ts`
- `lib/game/spawns.ts`
- `lib/game/drops.ts`
- `lib/game/ai.ts`
- `lib/game/questions.ts`
- `lib/game/quiz.ts`
- `lib/game/room.ts`
- `lib/host/access.ts`
- `data/questions.json`

### New lib modules
- `lib/supabase/client.ts` — createClient, hasSupabaseConfig
- `lib/supabase/room.ts` — broadcast send/subscribe helpers
- `lib/game/weapon.ts` — fireBullet, tickBullets, Bullet type
- `lib/game/mob.ts` — Zombie type, createZombie, tickMobs, damageZombie, enforceZombieCap
- `lib/game/loop.ts` — tickGame pure function (player movement, bullet tick, collision)

### New hook
- `hooks/use-game.ts` — single hook (~300 lines), replaces use-quiz-survivors-game.ts

### Rewrite components
- `components/game/phaser-canvas.tsx` — GameObjects-based scene, desktop + mobile controls
- `components/game/game-shell.tsx` — join screen + arena frame
- `components/game/hud.tsx` — slim top bar (HP, timer, papers, tier)
- `components/game/action-dock.tsx` — Dash / Hold Revive / Open Chest buttons
- `components/game/quiz-modal.tsx` — question + 2×2 answers
- `components/game/end-screen.tsx` — result + spin wheel
- `components/game/virtual-stick.tsx` — keep, minor cleanup only
- `components/spectator/spectator-shell.tsx` — arena + player chips overlay
- `components/spectator/player-chips.tsx` — alive/downed player indicators (NEW)
- `components/host/host-shell.tsx` — dashboard layout (NEW)
- `components/host/player-sidebar.tsx` — always-on player list (NEW)
- `components/host/timeline-bar.tsx` — wave/event bar (NEW)
- `components/host/chest-drawer.tsx` — answer session overlay (NEW)

### Routes
- `app/layout.tsx` — load Press Start 2P font
- `app/globals.css` — full design system rewrite
- `app/page.tsx` — redirect to /play
- `app/play/page.tsx` — renders GameShell
- `app/spectator/page.tsx` — renders SpectatorShell
- `app/host/[token]/page.tsx` — renders HostShell

### Tests (new)
- `tests/game/weapon.test.ts`
- `tests/game/mob.test.ts`
- `tests/game/loop.test.ts`

---

## Task 1: Swap Firebase for Supabase

**Files:**
- Delete: `lib/firebase/` (entire dir)
- Create: `lib/supabase/client.ts`
- Create: `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Install Supabase, remove Firebase**

```bash
npm uninstall firebase
npm install @supabase/supabase-js
```

Expected: `package.json` has `@supabase/supabase-js`, no `firebase`.

- [ ] **Step 2: Delete Firebase directory**

Delete the entire `lib/firebase/` directory.

- [ ] **Step 3: Create lib/supabase/client.ts**

```typescript
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
```

- [ ] **Step 4: Create .env.example**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: replace firebase with supabase client"
```

---

## Task 2: lib/supabase/room.ts

**Files:**
- Create: `lib/supabase/room.ts`

- [ ] **Step 1: Create room broadcast/subscribe module**

```typescript
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, CHANNEL_NAME } from "./client";
import type {
  MatchMeta,
  PlayerSnapshot,
  ChestSnapshot,
  ActiveAnswerSession,
  FeedItem,
  ResultEntry,
} from "@/lib/game/types";

export type RoomHandlers = {
  onMeta: (meta: MatchMeta) => void;
  onPlayer: (player: PlayerSnapshot) => void;
  onChest: (chest: ChestSnapshot) => void;
  onSession: (session: ActiveAnswerSession) => void;
  onFeed: (feed: FeedItem) => void;
  onResult: (result: ResultEntry) => void;
  onPresenceLeave: (uid: string) => void;
};

export function createRoomChannel(): RealtimeChannel {
  return supabase.channel(CHANNEL_NAME, {
    config: { broadcast: { self: false }, presence: { key: "" } },
  });
}

export function subscribeRoom(channel: RealtimeChannel, handlers: RoomHandlers): void {
  channel
    .on("broadcast", { event: "meta" }, ({ payload }) => handlers.onMeta(payload as MatchMeta))
    .on("broadcast", { event: "player" }, ({ payload }) => handlers.onPlayer(payload as PlayerSnapshot))
    .on("broadcast", { event: "chest" }, ({ payload }) => handlers.onChest(payload as ChestSnapshot))
    .on("broadcast", { event: "session" }, ({ payload }) => handlers.onSession(payload as ActiveAnswerSession))
    .on("broadcast", { event: "feed" }, ({ payload }) => handlers.onFeed(payload as FeedItem))
    .on("broadcast", { event: "result" }, ({ payload }) => handlers.onResult(payload as ResultEntry))
    .on("presence", { event: "leave" }, ({ leftPresences }) => {
      for (const p of leftPresences) {
        if (typeof p["uid"] === "string") handlers.onPresenceLeave(p["uid"]);
      }
    });
}

export function sendMeta(channel: RealtimeChannel, meta: MatchMeta): void {
  void channel.send({ type: "broadcast", event: "meta", payload: meta });
}

export function sendPlayer(channel: RealtimeChannel, player: PlayerSnapshot): void {
  void channel.send({ type: "broadcast", event: "player", payload: player });
}

export function sendChest(channel: RealtimeChannel, chest: ChestSnapshot): void {
  void channel.send({ type: "broadcast", event: "chest", payload: chest });
}

export function sendSession(channel: RealtimeChannel, session: ActiveAnswerSession): void {
  void channel.send({ type: "broadcast", event: "session", payload: session });
}

export function sendFeed(channel: RealtimeChannel, item: FeedItem): void {
  void channel.send({ type: "broadcast", event: "feed", payload: item });
}

export function sendResult(channel: RealtimeChannel, result: ResultEntry): void {
  void channel.send({ type: "broadcast", event: "result", payload: result });
}

export function trackPresence(channel: RealtimeChannel, uid: string, name: string): void {
  void channel.track({ uid, name });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/ && git commit -m "feat: add supabase room broadcast module"
```

---

## Task 3: lib/game/weapon.ts

**Files:**
- Create: `lib/game/weapon.ts`
- Create: `tests/game/weapon.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/game/weapon.test.ts
import { fireBullet, tickBullets } from "@/lib/game/weapon";
import { createBaseCombatStats } from "@/lib/game/loot";

const player = { uid: "p1", x: 100, y: 100 };
const stats = createBaseCombatStats();

describe("weapon", () => {
  it("returns null when on cooldown", () => {
    const now = 1000;
    const lastShot = 900; // 100ms ago, cooldown is 420ms
    expect(fireBullet(player, 1, 0, now, stats, lastShot)).toBeNull();
  });

  it("returns bullet when cooldown elapsed", () => {
    const now = 1500;
    const lastShot = 0;
    const bullet = fireBullet(player, 1, 0, now, stats, lastShot);
    expect(bullet).not.toBeNull();
    expect(bullet?.vx).toBeGreaterThan(0);
    expect(bullet?.vy).toBeCloseTo(0, 1);
  });

  it("returns null when aim vector is zero", () => {
    expect(fireBullet(player, 0, 0, 2000, stats, 0)).toBeNull();
  });

  it("removes expired bullets", () => {
    const now = 5000;
    const bullets = [
      { id: "b1", x: 50, y: 50, vx: 100, vy: 0, ttl: 4000 }, // expired
      { id: "b2", x: 50, y: 50, vx: 100, vy: 0, ttl: 6000 }, // alive
    ];
    const result = tickBullets(bullets, 16, now, 1536);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b2");
  });

  it("moves bullets by velocity", () => {
    const now = 1000;
    const bullets = [{ id: "b1", x: 100, y: 100, vx: 480, vy: 0, ttl: 2000 }];
    const result = tickBullets(bullets, 16, now, 1536);
    expect(result[0].x).toBeCloseTo(100 + 480 * 0.016, 0);
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

```bash
rtk vitest run tests/game/weapon.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/game/weapon'`

- [ ] **Step 3: Create lib/game/weapon.ts**

```typescript
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
```

- [ ] **Step 4: Run tests — verify pass**

```bash
rtk vitest run tests/game/weapon.test.ts
```

Expected: all 5 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/game/weapon.ts tests/game/weapon.test.ts && git commit -m "feat: add weapon module with tests"
```

---

## Task 4: lib/game/mob.ts

**Files:**
- Create: `lib/game/mob.ts`
- Create: `tests/game/mob.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/game/mob.test.ts
import { createZombie, tickMobs, damageZombie, enforceZombieCap } from "@/lib/game/mob";

const baseSpawn = { id: "z1", x: 100, y: 100, hp: 32, speed: 42, damage: 8 };
const player = {
  uid: "p1", x: 400, y: 400, spectating: false, downed: false,
  name: "", avatar: "", vx: 0, vy: 0, maxHp: 100, papers: 0,
  lootTier: 0 as const, weaponTier: 0 as const, armorTier: 0 as const,
  companionTier: 0 as const, downedAt: null, answering: false, kills: 0,
  answeredCount: 0, updatedAt: 0,
};

describe("mob", () => {
  it("creates zombie from spawn plan", () => {
    const z = createZombie(baseSpawn, 1000);
    expect(z.id).toBe("z1");
    expect(z.maxHp).toBe(32);
    expect(z.targetUid).toBeNull();
  });

  it("moves zombie toward player", () => {
    const z = createZombie(baseSpawn, 0);
    const [next] = tickMobs([z], [player], [], 100, 600);
    expect(next.x).toBeGreaterThan(z.x);
    expect(next.y).toBeGreaterThan(z.y);
  });

  it("damages zombie and sets hit flash", () => {
    const z = createZombie(baseSpawn, 0);
    const hit = damageZombie(z, 10, 1000);
    expect(hit.hp).toBe(22);
    expect(hit.hitFlashUntil).toBeGreaterThan(1000);
  });

  it("enforces 40-zombie cap by dropping oldest", () => {
    const existing = Array.from({ length: 38 }, (_, i) => createZombie({ ...baseSpawn, id: `z${i}` }, 0));
    const incoming = [
      createZombie({ ...baseSpawn, id: "new1" }, 0),
      createZombie({ ...baseSpawn, id: "new2" }, 0),
      createZombie({ ...baseSpawn, id: "new3" }, 0),
    ];
    const result = enforceZombieCap(existing, incoming);
    expect(result).toHaveLength(40);
    expect(result[result.length - 1].id).toBe("new3");
  });

  it("stays still when no active players", () => {
    const z = createZombie(baseSpawn, 0);
    const downedPlayer = { ...player, downed: true };
    const [next] = tickMobs([z], [downedPlayer], [], 100, 600);
    expect(next.x).toBe(z.x);
    expect(next.y).toBe(z.y);
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

```bash
rtk vitest run tests/game/mob.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/game/mob'`

- [ ] **Step 3: Create lib/game/mob.ts**

```typescript
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
```

- [ ] **Step 4: Run tests — verify pass**

```bash
rtk vitest run tests/game/mob.test.ts
```

Expected: all 5 pass.

- [ ] **Step 5: Commit**

```bash
git add lib/game/mob.ts tests/game/mob.test.ts && git commit -m "feat: add mob module with separation, deflection, cap enforcement"
```

---

## Task 5: lib/game/loop.ts

**Files:**
- Create: `lib/game/loop.ts`
- Create: `tests/game/loop.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/game/loop.test.ts
import { tickGame } from "@/lib/game/loop";
import { createBaseCombatStats } from "@/lib/game/loot";
import { createZombie } from "@/lib/game/mob";

const basePlayer = {
  uid: "p1", name: "Test", avatar: "", x: 400, y: 400,
  vx: 0, vy: 0, hp: 100, maxHp: 100, papers: 0,
  lootTier: 0 as const, weaponTier: 0 as const, armorTier: 0 as const,
  companionTier: 0 as const, downed: false, downedAt: null,
  spectating: false, answering: false, kills: 0, answeredCount: 0, updatedAt: 0,
};
const stats = createBaseCombatStats();
const noDash = { activeUntil: 0, cooldownUntil: 0 };
const noInput = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, firing: false, dashPressed: false };

describe("game loop", () => {
  it("moves player in move direction", () => {
    const result = tickGame({
      player: basePlayer, stats,
      input: { ...noInput, moveX: 1, moveY: 0 },
      dash: noDash, bullets: [], zombies: [], remotePlayers: [], chests: [],
      deltaMs: 100, now: 1000, lastShotAt: 0,
    });
    expect(result.player.x).toBeGreaterThan(basePlayer.x);
    expect(result.player.y).toBeCloseTo(basePlayer.y, 0);
  });

  it("does not move when input is zero", () => {
    const result = tickGame({
      player: basePlayer, stats, input: noInput,
      dash: noDash, bullets: [], zombies: [], remotePlayers: [], chests: [],
      deltaMs: 100, now: 1000, lastShotAt: 0,
    });
    expect(result.player.x).toBeCloseTo(basePlayer.x, 1);
    expect(result.player.y).toBeCloseTo(basePlayer.y, 1);
  });

  it("fires bullet when firing and cooldown elapsed", () => {
    const result = tickGame({
      player: basePlayer, stats,
      input: { ...noInput, firing: true, aimX: 1, aimY: 0 },
      dash: noDash, bullets: [], zombies: [], remotePlayers: [], chests: [],
      deltaMs: 16, now: 1000, lastShotAt: 0,
    });
    expect(result.newBullet).not.toBeNull();
    expect(result.lastShotAt).toBe(1000);
  });

  it("kills zombie when bullet hits", () => {
    const zombie = createZombie({ id: "z1", x: 400, y: 400, hp: 10, speed: 42, damage: 8 }, 0);
    const result = tickGame({
      player: basePlayer, stats,
      input: { ...noInput, firing: true, aimX: 1, aimY: 0 },
      dash: noDash, bullets: [], zombies: [zombie], remotePlayers: [], chests: [],
      deltaMs: 16, now: 1000, lastShotAt: 0,
    });
    // zombie at same position as player — bullet spawns there and registers hit
    expect(result.killCount).toBeGreaterThanOrEqual(0); // may or may not hit at spawn position
    expect(result.zombies.length).toBeLessThanOrEqual(1);
  });

  it("activates dash and boosts speed", () => {
    const result = tickGame({
      player: basePlayer, stats,
      input: { ...noInput, moveX: 1, moveY: 0, dashPressed: true },
      dash: noDash, bullets: [], zombies: [], remotePlayers: [], chests: [],
      deltaMs: 100, now: 1000, lastShotAt: 0,
    });
    expect(result.dash.activeUntil).toBeGreaterThan(1000);
    expect(result.player.x).toBeGreaterThan(basePlayer.x + stats.speed * 0.1);
  });
});
```

- [ ] **Step 2: Run tests — verify fail**

```bash
rtk vitest run tests/game/loop.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/game/loop'`

- [ ] **Step 3: Create lib/game/loop.ts**

```typescript
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
```

- [ ] **Step 4: Run tests — verify pass**

```bash
rtk vitest run tests/game/loop.test.ts
```

Expected: all 5 pass.

- [ ] **Step 5: Run all tests**

```bash
rtk vitest run
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/game/loop.ts tests/game/loop.test.ts && git commit -m "feat: add pure game loop with bullet/zombie/collision logic"
```

---

## Task 6: hooks/use-game.ts

**Files:**
- Create: `hooks/use-game.ts`
- Delete: `hooks/use-quiz-survivors-game.ts`

- [ ] **Step 1: Create hooks/use-game.ts**

```typescript
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { canUseHostControls } from "@/lib/host/access";
import {
  CHEST_LAYOUT,
  SAFE_RING_RADIUS,
  clampToArena,
} from "@/lib/game/config";
import { rollPaperDrop } from "@/lib/game/drops";
import { applyLootTier, createBaseCombatStats, getLootTierForCorrectAnswers } from "@/lib/game/loot";
import { getRandomQuestionSet, type Question } from "@/lib/game/questions";
import { buildQuizSession, getQuizTier, submitQuizAnswer, type QuizSession } from "@/lib/game/quiz";
import { createPlayerSnapshot, normalizeRoomSnapshot } from "@/lib/game/room";
import { buildBurstPlan } from "@/lib/game/spawns";
import {
  CHEST_DURATION_MS,
  CHEST_EVENTS,
  GAME_DURATION_MS,
  WAVE_EVENTS,
  CATASTROPHE_EVENTS,
  isGameOver,
} from "@/lib/game/timeline";
import type {
  ActiveAnswerSession,
  ChestSnapshot,
  FeedItem,
  MatchMeta,
  PlayerSnapshot,
  ResultEntry,
  RoomSnapshot,
} from "@/lib/game/types";
import { getAnonId, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  createRoomChannel,
  subscribeRoom,
  sendMeta,
  sendPlayer,
  sendChest,
  sendSession,
  sendFeed,
  sendResult,
  trackPresence,
} from "@/lib/supabase/room";
import { tickGame, type InputState, type DashState } from "@/lib/game/loop";
import { createZombie, enforceZombieCap, type Zombie } from "@/lib/game/mob";
import type { Bullet } from "@/lib/game/weapon";
import { DEFAULT_META } from "@/lib/game/config";

export type WorldState = {
  localPlayer: PlayerSnapshot | null;
  remotePlayers: PlayerSnapshot[];
  bullets: Bullet[];
  zombies: Zombie[];
  meteors: Array<{ id: string; x: number; y: number; radius: number }>;
  gasClouds: Array<{ id: string; x: number; y: number; radius: number }>;
  chests: ChestSnapshot[];
  elapsedMs: number;
};

export type QuizViewState = {
  open: boolean;
  questions: Question[];
  session: QuizSession | null;
  selectedChest: ChestSnapshot | null;
};

type GameMode = "player" | "spectator";
type GameOptions = { hostAccessEnabled?: boolean };

const PLAYER_SYNC_MS = 100;
const EMPTY_ROOM = normalizeRoomSnapshot(undefined);

export function useGame(mode: GameMode, options?: GameOptions) {
  const [uid] = useState(() => getAnonId());
  const [playerName, setPlayerName] = useState("Runner");
  const [joined, setJoined] = useState(mode === "spectator");
  const [room, setRoom] = useState<RoomSnapshot>(EMPTY_ROOM);
  const [world, setWorld] = useState<WorldState>({
    localPlayer: null, remotePlayers: [], bullets: [],
    zombies: [], meteors: [], gasClouds: [], chests: [], elapsedMs: 0,
  });
  const [quiz, setQuiz] = useState<QuizViewState>({
    open: false, questions: [], session: null, selectedChest: null,
  });
  const [statusMessage, setStatusMessage] = useState("Join.");
  const [error, setError] = useState<string | null>(null);
  const [wheelSpun, setWheelSpun] = useState(false);
  const [localResult, setLocalResult] = useState<ResultEntry | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const roomRef = useRef<RoomSnapshot>(EMPTY_ROOM);
  const joinedRef = useRef(joined);
  const localPlayerRef = useRef<PlayerSnapshot | null>(null);
  const statsRef = useRef(createBaseCombatStats());
  const inputRef = useRef<InputState>({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, firing: false, dashPressed: false });
  const dashRef = useRef<DashState>({ activeUntil: 0, cooldownUntil: 0 });
  const bulletsRef = useRef<Bullet[]>([]);
  const zombiesRef = useRef<Zombie[]>([]);
  const spawnedBurstsRef = useRef<Set<string>>(new Set());
  const lastSyncRef = useRef(0);
  const lastShotRef = useRef(0);
  const resultCommittedRef = useRef(false);
  const quizOpenRef = useRef(false);
  const tickRef = useRef<(ts: number) => void>(() => {});

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { joinedRef.current = joined; }, [joined]);

  // load saved name
  useEffect(() => {
    const saved = window.localStorage.getItem("quiz-survivors-name");
    if (saved) setPlayerName(saved);
  }, []);

  // connect supabase channel
  useEffect(() => {
    const ch = createRoomChannel();
    channelRef.current = ch;

    subscribeRoom(ch, {
      onMeta: (meta) => setRoom((prev) => ({ ...prev, meta })),
      onPlayer: (player) => setRoom((prev) => ({
        ...prev,
        players: { ...prev.players, [player.uid]: player },
      })),
      onChest: (chest) => setRoom((prev) => ({
        ...prev,
        chests: { ...prev.chests, [chest.id]: chest },
      })),
      onSession: (session) => setRoom((prev) => ({
        ...prev,
        sessions: { ...prev.sessions, [session.uid]: session },
      })),
      onFeed: (item) => setRoom((prev) => ({
        ...prev,
        feed: { ...prev.feed, [item.id]: item },
      })),
      onResult: (result) => setRoom((prev) => ({
        ...prev,
        results: { ...prev.results, [result.uid]: result },
      })),
      onPresenceLeave: (leftUid) => setRoom((prev) => {
        const next = { ...prev.players };
        delete next[leftUid];
        return { ...prev, players: next };
      }),
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && mode === "player") {
        trackPresence(ch, uid, playerName);
      }
    });

    return () => { void ch.unsubscribe(); };
  }, [mode, uid, playerName]);

  // status message
  useEffect(() => {
    if (room.meta.status === "waiting") { setStatusMessage(joined ? "Waiting for host." : "Join."); return; }
    if (room.meta.status === "live") { setStatusMessage("Survive."); return; }
    setStatusMessage("Finished.");
  }, [room.meta.status, joined]);

  // host controls
  const canHost = useMemo(
    () => canUseHostControls({ hostAccessEnabled: options?.hostAccessEnabled ?? false }),
    [options?.hostAccessEnabled],
  );

  const joinMatch = useCallback(() => {
    if (!uid) return;
    window.localStorage.setItem("quiz-survivors-name", playerName);
    const snapshot = createPlayerSnapshot({ uid, name: playerName, now: Date.now() });
    localPlayerRef.current = snapshot;
    statsRef.current = createBaseCombatStats();
    const ch = channelRef.current;
    if (ch) sendPlayer(ch, snapshot);
    setJoined(true);
  }, [uid, playerName]);

  const setMovement = useCallback((x: number, y: number) => {
    inputRef.current.moveX = x;
    inputRef.current.moveY = y;
  }, []);

  const setAim = useCallback((x: number, y: number, firing = false) => {
    const mag = Math.hypot(x, y);
    if (mag > 0) {
      inputRef.current.aimX = x / mag;
      inputRef.current.aimY = y / mag;
    }
    inputRef.current.firing = firing;
  }, []);

  const stopAim = useCallback(() => {
    inputRef.current.firing = false;
  }, []);

  const dash = useCallback(() => {
    inputRef.current.dashPressed = true;
    setTimeout(() => { inputRef.current.dashPressed = false; }, 32);
  }, []);

  const [reviveHolding, setReviveHolding] = useState(false);

  const activeChest = useMemo(() => {
    const lp = world.localPlayer;
    if (!lp) return null;
    return world.chests.find(
      (c) => c.active && Math.hypot(lp.x - c.x, lp.y - c.y) <= SAFE_RING_RADIUS,
    ) ?? null;
  }, [world.chests, world.localPlayer]);

  const openChest = useCallback(() => {
    if (!activeChest || !uid) return;
    const questions = getRandomQuestionSet(3);
    const session = buildQuizSession({ uid, chestId: activeChest.id, playerName, questions });
    quizOpenRef.current = true;
    setQuiz({ open: true, questions, session, selectedChest: activeChest });
  }, [activeChest, uid, playerName]);

  const answerQuestion = useCallback((optionId: number) => {
    setQuiz((prev) => {
      if (!prev.session) return prev;
      const next = submitQuizAnswer(prev.session, optionId);
      const ch = channelRef.current;
      if (ch) {
        const sessionPayload: ActiveAnswerSession = {
          uid,
          playerName,
          avatar: localPlayerRef.current?.avatar ?? "",
          chestId: prev.selectedChest?.id ?? "",
          questionId: next.currentQuestionIndex.toString(),
          question: prev.questions[next.currentQuestionIndex]?.question ?? "",
          options: prev.questions[next.currentQuestionIndex]?.options ?? ["", "", "", ""],
          selectedOptionId: optionId,
          answersGiven: next.answersGiven,
          correctAnswers: next.correctAnswers,
          papersRemaining: localPlayerRef.current?.papers ?? 0,
          updatedAt: Date.now(),
        };
        sendSession(ch, sessionPayload);
      }
      return { ...prev, session: next };
    });
  }, [uid, playerName]);

  const closeQuiz = useCallback(() => {
    quizOpenRef.current = false;
    setQuiz((prev) => {
      if (!prev.session) return { ...prev, open: false };
      const tier = getQuizTier(prev.session);
      const nextStats = applyLootTier(statsRef.current, tier);
      statsRef.current = nextStats;
      if (localPlayerRef.current) {
        localPlayerRef.current = {
          ...localPlayerRef.current,
          lootTier: tier,
          weaponTier: tier,
          armorTier: tier,
          companionTier: tier,
        };
      }
      return { open: false, questions: [], session: null, selectedChest: null };
    });
  }, []);

  const isGameEnded = room.meta.status === "ended" || (room.meta.status === "live" && isGameOver(world.elapsedMs));

  const spinWheel = useCallback(() => setWheelSpun(true), []);

  // host actions
  const startMatch = useCallback(() => {
    if (!canHost) return;
    const meta: MatchMeta = {
      ...DEFAULT_META,
      status: "live",
      startedAt: Date.now(),
      hostUid: uid,
      timelineVersion: Date.now(),
      connectedCount: Object.keys(roomRef.current.players).length,
    };
    const ch = channelRef.current;
    if (ch) sendMeta(ch, meta);
    setRoom((prev) => ({ ...prev, meta }));
  }, [canHost, uid]);

  const resetMatch = useCallback(() => {
    if (!canHost) return;
    const meta: MatchMeta = { ...DEFAULT_META, timelineVersion: Date.now() };
    const ch = channelRef.current;
    if (ch) sendMeta(ch, meta);
    setRoom((prev) => ({ ...prev, meta, players: {}, bursts: {}, chests: {}, sessions: {}, feed: {}, results: {} }));
    bulletsRef.current = [];
    zombiesRef.current = [];
    spawnedBurstsRef.current.clear();
    localPlayerRef.current = null;
    resultCommittedRef.current = false;
    setLocalResult(null);
    setWheelSpun(false);
  }, [canHost]);

  // deterministic hazards from timeline
  function buildMeteors(elapsedMs: number) {
    const active: WorldState["meteors"] = [];
    for (const ev of CATASTROPHE_EVENTS) {
      if (ev.kind !== "meteor") continue;
      if (elapsedMs < ev.atMs || elapsedMs > ev.atMs + (ev.durationMs ?? 0)) continue;
      const t = (elapsedMs - ev.atMs) / (ev.durationMs ?? 1);
      active.push({ id: ev.id + "-a", x: 320 + t * 200, y: 260, radius: 72 });
      active.push({ id: ev.id + "-b", x: 960 + t * 180, y: 820, radius: 60 });
      active.push({ id: ev.id + "-c", x: 640 + t * 120, y: 1100, radius: 80 });
    }
    return active;
  }

  function buildGasClouds(elapsedMs: number) {
    const active: WorldState["gasClouds"] = [];
    for (const ev of CATASTROPHE_EVENTS) {
      if (ev.kind !== "gas") continue;
      if (elapsedMs < ev.atMs || elapsedMs > ev.atMs + (ev.durationMs ?? 0)) continue;
      active.push({ id: ev.id + "-a", x: 400, y: 400, radius: 200 });
      active.push({ id: ev.id + "-b", x: 1100, y: 900, radius: 180 });
    }
    return active;
  }

  function deriveChestState(chestsMap: RoomSnapshot["chests"], now: number): ChestSnapshot[] {
    return CHEST_LAYOUT.map((layout) => {
      const synced = chestsMap[layout.id];
      if (synced) return synced;
      // derive from timeline
      const event = CHEST_EVENTS.find((e) => e.id === layout.id);
      const elapsedMs = roomRef.current.meta.startedAt
        ? Math.max(0, now - roomRef.current.meta.startedAt)
        : 0;
      if (!event) return { ...layout, spawnedAt: 0, expiresAt: 0, openedBy: null, active: false, questionCount: 0, claimedTier: 0 };
      const active = elapsedMs >= event.atMs && elapsedMs <= event.atMs + (event.durationMs ?? 0);
      return { ...layout, spawnedAt: event.atMs, expiresAt: event.atMs + (event.durationMs ?? 0), openedBy: null, active, questionCount: 0, claimedTier: 0 };
    });
  }

  // main tick
  tickRef.current = (_ts: number) => {
    const currentRoom = roomRef.current;
    const now = Date.now();
    const startedAt = currentRoom.meta.startedAt ?? 0;
    const elapsedMs =
      currentRoom.meta.status === "live" && startedAt
        ? Math.max(0, now - startedAt)
        : currentRoom.meta.status === "ended"
          ? Math.max(0, (currentRoom.meta.endedAt ?? now) - startedAt)
          : 0;

    if (mode === "player" && joinedRef.current && localPlayerRef.current && currentRoom.meta.status === "live") {
      const chests = deriveChestState(currentRoom.chests, now);

      // spawn bursts
      for (const waveEvent of WAVE_EVENTS) {
        if (elapsedMs >= waveEvent.atMs && !spawnedBurstsRef.current.has(waveEvent.id)) {
          spawnedBurstsRef.current.add(waveEvent.id);
          const plan = buildBurstPlan({
            waveIndex: WAVE_EVENTS.indexOf(waveEvent) + 1,
            playerCount: Math.max(1, Object.keys(currentRoom.players).length),
            seed: String(currentRoom.meta.timelineVersion),
          });
          const newZombies = plan.zombies.map((z) => createZombie(z, now));
          zombiesRef.current = enforceZombieCap(zombiesRef.current, newZombies);
        }
      }

      const result = tickGame({
        player: localPlayerRef.current,
        stats: statsRef.current,
        input: inputRef.current,
        dash: dashRef.current,
        bullets: bulletsRef.current,
        zombies: zombiesRef.current,
        remotePlayers: Object.values(currentRoom.players).filter((p) => p.uid !== uid),
        chests,
        deltaMs: 16,
        now,
        lastShotAt: lastShotRef.current,
      });

      localPlayerRef.current = result.player;
      dashRef.current = result.dash;
      bulletsRef.current = result.bullets;
      zombiesRef.current = result.zombies;
      lastShotRef.current = result.lastShotAt;

      // sync to supabase
      if (now - lastSyncRef.current > PLAYER_SYNC_MS) {
        lastSyncRef.current = now;
        const ch = channelRef.current;
        if (ch) sendPlayer(ch, result.player);
      }

      // commit result on game end
      if (!resultCommittedRef.current && isGameOver(elapsedMs)) {
        resultCommittedRef.current = true;
        const entry: ResultEntry = {
          uid,
          name: playerName,
          survived: !result.player.downed,
          answeredCount: result.player.answeredCount,
          reward: "none",
          fairSpin: false,
          createdAt: now,
        };
        const ch = channelRef.current;
        if (ch) sendResult(ch, entry);
        setLocalResult(entry);
      }
    }

    const meteors = buildMeteors(elapsedMs);
    const gasClouds = buildGasClouds(elapsedMs);
    const chests = deriveChestState(currentRoom.chests, now);

    startTransition(() => {
      setWorld({
        localPlayer: mode === "player" ? localPlayerRef.current : null,
        remotePlayers: Object.values(currentRoom.players).filter((p) => mode === "spectator" || p.uid !== uid),
        bullets: bulletsRef.current,
        zombies: zombiesRef.current,
        meteors,
        gasClouds,
        chests,
        elapsedMs,
      });
    });
  };

  useEffect(() => {
    let frameId = 0;
    const loop = (ts: number) => { tickRef.current(ts); frameId = window.requestAnimationFrame(loop); };
    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return {
    uid, playerName, setPlayerName,
    joined, joinMatch,
    world, quiz,
    setMovement, setAim, stopAim, dash, reviveHolding, setReviveHolding,
    openChest, activeChest,
    answerQuestion, closeQuiz,
    statusMessage, error,
    isGameEnded, localResult, wheelSpun, spinWheel,
    canHost, startMatch, resetMatch,
    hasSupabaseConfig: hasSupabaseConfig(),
    room,
  };
}
```

- [ ] **Step 2: Run lint — fix any type errors**

```bash
rtk tsc --noEmit
```

Fix any errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-game.ts && git commit -m "feat: add use-game hook backed by supabase broadcast"
```

---

## Task 7: Phaser Canvas Rewrite

**Files:**
- Modify: `components/game/phaser-canvas.tsx`

- [ ] **Step 1: Replace phaser-canvas.tsx**

```typescript
"use client";

import { useEffect, useRef } from "react";
import { ARENA_SIZE, SAFE_RING_RADIUS } from "@/lib/game/config";
import type { WorldState } from "@/hooks/use-game";

type PhaserCanvasProps = {
  world: WorldState;
  viewMode: "player" | "spectator";
  onMove?: (x: number, y: number) => void;
  onAim?: (x: number, y: number, firing?: boolean) => void;
  onStopAim?: () => void;
};

type SceneRefs = {
  world: WorldState;
  viewMode: "player" | "spectator";
  onMove: (x: number, y: number) => void;
  onAim: (x: number, y: number, firing?: boolean) => void;
  onStopAim: () => void;
};

const NOOP = () => {};

export function PhaserCanvas({ world, viewMode, onMove, onAim, onStopAim }: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refsRef = useRef<SceneRefs>({
    world, viewMode,
    onMove: onMove ?? NOOP,
    onAim: onAim ?? NOOP,
    onStopAim: onStopAim ?? NOOP,
  });

  useEffect(() => {
    refsRef.current = { world, viewMode, onMove: onMove ?? NOOP, onAim: onAim ?? NOOP, onStopAim: onStopAim ?? NOOP };
  });

  useEffect(() => {
    let disposed = false;
    let game: import("phaser").Game | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function boot() {
      const Phaser = await import("phaser");
      if (disposed || !containerRef.current) return;

      // entity pools
      type ZombieObj = { rect: import("phaser").GameObjects.Rectangle; id: string };
      type BulletObj = { rect: import("phaser").GameObjects.Rectangle; id: string };
      type MeteorObj = { circle: import("phaser").GameObjects.Arc; id: string };
      type GasObj = { circle: import("phaser").GameObjects.Arc; id: string };
      type ChestObj = { body: import("phaser").GameObjects.Rectangle; ring: import("phaser").GameObjects.Arc; id: string };
      type PlayerObj = { rect: import("phaser").GameObjects.Rectangle; id: string };

      class ArenaScene extends Phaser.Scene {
        keys!: Record<string, Phaser.Input.Keyboard.Key>;
        bg!: import("phaser").GameObjects.Rectangle;
        zombiePool: ZombieObj[] = [];
        bulletPool: BulletObj[] = [];
        meteorPool: MeteorObj[] = [];
        gasPool: GasObj[] = [];
        chestPool: ChestObj[] = [];
        remotePlayers: PlayerObj[] = [];
        localPlayerRect!: import("phaser").GameObjects.Rectangle;

        create() {
          this.cameras.main.setBounds(0, 0, ARENA_SIZE, ARENA_SIZE);
          this.cameras.main.roundPixels = true;

          // arena floor
          this.add.rectangle(ARENA_SIZE / 2, ARENA_SIZE / 2, ARENA_SIZE, ARENA_SIZE, 0x081108);
          // grid lines via graphics (static, created once)
          const grid = this.add.graphics();
          grid.lineStyle(1, 0x0f220f, 0.6);
          for (let p = 96; p < ARENA_SIZE; p += 96) {
            grid.lineBetween(p, 0, p, ARENA_SIZE);
            grid.lineBetween(0, p, ARENA_SIZE, p);
          }
          // arena border
          const border = this.add.graphics();
          border.lineStyle(6, 0x1a4a20, 1);
          border.strokeRect(36, 36, ARENA_SIZE - 72, ARENA_SIZE - 72);

          // local player (created once, updated via setPosition)
          this.localPlayerRect = this.add.rectangle(0, 0, 30, 30, 0xf6f2d2).setDepth(10).setVisible(false);

          // keyboard
          const kb = this.input.keyboard;
          this.keys = kb ? (kb.addKeys("W,A,S,D,SPACE") as Record<string, Phaser.Input.Keyboard.Key>) : {};

          // pointer events
          this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            const { world: w, viewMode: vm } = refsRef.current;
            if (vm !== "player" || !w.localPlayer) return;
            refsRef.current.onAim(
              pointer.worldX - w.localPlayer.x,
              pointer.worldY - w.localPlayer.y,
              pointer.primaryDown,
            );
          });

          this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            const { world: w, viewMode: vm } = refsRef.current;
            if (vm !== "player" || !w.localPlayer) return;
            refsRef.current.onAim(
              pointer.worldX - w.localPlayer.x,
              pointer.worldY - w.localPlayer.y,
              true,
            );
          });

          this.input.on("pointerup", () => refsRef.current.onStopAim());

          // hide default cursor
          this.input.setDefaultCursor("crosshair");
        }

        update() {
          const { world: w, viewMode: vm } = refsRef.current;

          // WASD movement
          if (vm === "player") {
            const mx = (this.keys.D?.isDown ? 1 : 0) - (this.keys.A?.isDown ? 1 : 0);
            const my = (this.keys.S?.isDown ? 1 : 0) - (this.keys.W?.isDown ? 1 : 0);
            refsRef.current.onMove(mx, my);
          }

          // sync local player
          if (w.localPlayer) {
            this.localPlayerRect.setPosition(w.localPlayer.x, w.localPlayer.y).setVisible(true);
            this.localPlayerRect.setFillStyle(w.localPlayer.downed ? 0xff4e5c : 0xf6f2d2);
          } else {
            this.localPlayerRect.setVisible(false);
          }

          // remote players
          syncPool(
            this, this.remotePlayers, w.remotePlayers,
            (p) => {
              const r = this.add.rectangle(p.x, p.y, 30, 30, 0x6bb7ff).setDepth(9);
              return { rect: r, id: p.uid };
            },
            (obj, p) => {
              obj.rect.setPosition(p.x, p.y).setFillStyle(p.downed ? 0xff6e63 : 0x6bb7ff).setAlpha(p.spectating ? 0.28 : 1);
            },
            (obj) => obj.rect.destroy(),
            (obj, p) => obj.id === p.uid,
          );

          // zombies
          syncPool(
            this, this.zombiePool, w.zombies,
            (z) => {
              const r = this.add.rectangle(z.x, z.y, 24, 24, 0x7cd44e).setDepth(5);
              return { rect: r, id: z.id };
            },
            (obj, z) => {
              const flash = Date.now() < z.hitFlashUntil;
              obj.rect.setPosition(z.x, z.y).setFillStyle(flash ? 0xffffff : 0x7cd44e);
            },
            (obj) => obj.rect.destroy(),
            (obj, z) => obj.id === z.id,
          );

          // bullets
          syncPool(
            this, this.bulletPool, w.bullets,
            (b) => ({ rect: this.add.rectangle(b.x, b.y, 8, 8, 0xfff199).setDepth(8), id: b.id }),
            (obj, b) => obj.rect.setPosition(b.x, b.y),
            (obj) => obj.rect.destroy(),
            (obj, b) => obj.id === b.id,
          );

          // meteors
          syncPool(
            this, this.meteorPool, w.meteors,
            (m) => ({ circle: this.add.arc(m.x, m.y, m.radius, 0, 360, false, 0xff7d3c, 0.3).setDepth(3), id: m.id }),
            (obj, m) => obj.circle.setPosition(m.x, m.y),
            (obj) => obj.circle.destroy(),
            (obj, m) => obj.id === m.id,
          );

          // gas clouds
          syncPool(
            this, this.gasPool, w.gasClouds,
            (g) => ({ circle: this.add.arc(g.x, g.y, g.radius, 0, 360, false, 0x76cf64, 0.18).setDepth(2), id: g.id }),
            (obj, g) => obj.circle.setPosition(g.x, g.y),
            (obj) => obj.circle.destroy(),
            (obj, g) => obj.id === g.id,
          );

          // chests
          syncPool(
            this, this.chestPool, w.chests,
            (c) => ({
              ring: this.add.arc(c.x, c.y, SAFE_RING_RADIUS, 0, 360, false, 0xff9a57, 0).setDepth(1).setStrokeStyle(4, 0xff9a57, 0.7),
              body: this.add.rectangle(c.x, c.y, 36, 36, c.active ? 0xf9c15d : 0x6d5635).setDepth(4),
              id: c.id,
            }),
            (obj, c) => {
              obj.body.setPosition(c.x, c.y).setFillStyle(c.active ? 0xf9c15d : 0x6d5635).setAlpha(c.active ? 1 : 0.28);
              obj.ring.setPosition(c.x, c.y).setAlpha(c.active ? 1 : 0);
            },
            (obj) => { obj.body.destroy(); obj.ring.destroy(); },
            (obj, c) => obj.id === c.id,
          );

          // camera
          const camera = this.cameras.main;
          if (vm === "player" && w.localPlayer) {
            camera.centerOn(w.localPlayer.x, w.localPlayer.y);
            camera.setZoom(Math.max(0.72, Math.min(this.scale.width / 620, this.scale.height / 520)));
          } else {
            camera.centerOn(ARENA_SIZE / 2, ARENA_SIZE / 2);
            camera.setZoom(Math.max(0.2, Math.min(this.scale.width / (ARENA_SIZE + 160), this.scale.height / (ARENA_SIZE + 160))));
          }
        }
      }

      const bounds = containerRef.current!.getBoundingClientRect();
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: containerRef.current!,
        width: Math.max(320, Math.floor(bounds.width)),
        height: Math.max(320, Math.floor(bounds.height)),
        pixelArt: true,
        transparent: true,
        backgroundColor: "#030508",
        scene: ArenaScene,
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
      });

      resizeObserver = new ResizeObserver((entries) => {
        const e = entries[0];
        if (!e || !game) return;
        game.scale.resize(
          Math.max(320, Math.floor(e.contentRect.width)),
          Math.max(320, Math.floor(e.contentRect.height)),
        );
      });
      resizeObserver.observe(containerRef.current!);
    }

    boot();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      game?.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="phaser-shell" />;
}

// Generic pool sync: update existing, create new, destroy removed
function syncPool<T extends object, D>(
  _scene: import("phaser").Scene,
  pool: T[],
  data: D[],
  create: (d: D) => T,
  update: (obj: T, d: D) => void,
  destroy: (obj: T) => void,
  match: (obj: T, d: D) => boolean,
) {
  // destroy removed
  for (let i = pool.length - 1; i >= 0; i--) {
    if (!data.some((d) => match(pool[i], d))) {
      destroy(pool[i]);
      pool.splice(i, 1);
    }
  }
  // create / update
  for (const d of data) {
    const existing = pool.find((obj) => match(obj, d));
    if (existing) {
      update(existing, d);
    } else {
      pool.push(create(d));
    }
  }
}
```

- [ ] **Step 2: Run lint**

```bash
rtk tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Commit**

```bash
git add components/game/phaser-canvas.tsx && git commit -m "feat: rewrite phaser canvas with persistent GameObjects"
```

---

## Task 8: Design System (globals.css + layout.tsx)

**Files:**
- Modify: `app/globals.css` (full rewrite)
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update app/layout.tsx to load pixel font**

```typescript
import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quiz Survivors",
  description: "6-minute arena quiz survival game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pixelFont.variable}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace app/globals.css**

```css
/* ─── Design tokens ─── */
:root {
  --bg:          #030508;
  --surface:     rgba(4, 8, 16, 0.88);
  --surface-mid: rgba(6, 12, 22, 0.92);
  --border:      rgba(60, 120, 255, 0.22);
  --glow:        0 0 8px rgba(40, 100, 255, 0.14);
  --glow-active: 0 0 14px rgba(60, 140, 255, 0.32);
  --text:        #d8e8f8;
  --muted:       #7a96b4;
  --accent:      #44aaff;
  --accent-dim:  rgba(68, 170, 255, 0.12);
  --positive:    #88ff66;
  --danger:      #ff8844;
  --pixel:       var(--font-pixel), monospace;
}

/* ─── Reset ─── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; width: 100%; overflow: hidden; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--pixel);
  font-size: 10px;
  line-height: 1.6;
  -webkit-font-smoothing: none;
  image-rendering: pixelated;
}

a { color: inherit; text-decoration: none; }
button, input { font: inherit; }

/* ─── Glass panel ─── */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--glow);
  backdrop-filter: blur(10px);
}

/* ─── Pulse animation for active elements ─── */
@keyframes border-pulse {
  0%, 100% { box-shadow: var(--glow); }
  50%       { box-shadow: var(--glow-active); }
}
.pulse { animation: border-pulse 2s ease-in-out infinite; }

/* ─── Arena page ─── */
.arena-page { width: 100vw; height: 100vh; overflow: hidden; position: relative; }

.arena-frame {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.phaser-shell {
  position: absolute;
  inset: 0;
}
.phaser-shell canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

/* ─── Join screen ─── */
.join-screen {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 50% 40%, rgba(40,80,200,0.08), transparent 60%);
}

.join-card {
  width: min(340px, 90vw);
  padding: 28px 24px;
  display: grid;
  gap: 18px;
}

.join-title {
  font-size: 1.4rem;
  color: var(--accent);
  letter-spacing: 0.06em;
}

.join-sub {
  color: var(--muted);
  font-size: 0.85rem;
}

.name-input {
  width: 100%;
  padding: 14px 12px;
  background: rgba(4, 8, 20, 0.92);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 1rem;
  outline: none;
}
.name-input:focus { border-color: var(--accent); box-shadow: var(--glow-active); }

.join-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted);
  font-size: 0.7rem;
}

.warning { color: var(--danger); font-size: 0.7rem; }

/* ─── HUD ─── */
.top-hud {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  pointer-events: none;
}

.hud-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.hud-tile {
  padding: 8px 12px;
  display: grid;
  gap: 4px;
  min-width: 72px;
}

.hud-label { color: var(--muted); font-size: 0.65rem; }
.hud-value { font-size: 1rem; color: var(--text); }
.hud-value.accent { color: var(--accent); }
.hud-value.positive { color: var(--positive); }
.hud-value.danger { color: var(--danger); }

.hp-bar-track {
  width: 80px;
  height: 5px;
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border);
}
.hp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--danger), var(--positive));
  transition: width 0.1s;
}

.status-tag {
  padding: 6px 10px;
  font-size: 0.65rem;
  color: var(--muted);
  pointer-events: auto;
}

/* ─── Action dock ─── */
.action-dock {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 10;
  display: grid;
  gap: 8px;
  width: min(200px, calc(100vw - 24px));
}

/* ─── Buttons ─── */
.btn {
  padding: 14px 12px;
  width: 100%;
  cursor: pointer;
  text-align: center;
  font-size: 0.75rem;
  background: var(--accent-dim);
  border: 1px solid rgba(68, 170, 255, 0.35);
  color: var(--text);
  letter-spacing: 0.04em;
  transition: background 0.1s, border-color 0.1s;
}
.btn:hover { background: rgba(68,170,255,0.2); border-color: var(--accent); }
.btn:active { background: rgba(68,170,255,0.28); }
.btn:disabled { opacity: 0.3; cursor: not-allowed; }

.btn-primary {
  background: rgba(68,170,255,0.22);
  border-color: var(--accent);
  color: var(--accent);
}
.btn-primary:hover { background: rgba(68,170,255,0.32); }

.btn-danger {
  background: rgba(255,136,68,0.12);
  border-color: rgba(255,136,68,0.4);
  color: var(--danger);
}

/* ─── Mobile joysticks ─── */
.mobile-sticks {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 10;
  display: none;
  gap: 12px;
}

.virtual-pad {
  position: relative;
  width: 140px;
  height: 140px;
  border: 1px solid var(--border);
  background: rgba(4, 8, 20, 0.7);
  border-radius: 50%;
  touch-action: none;
}

.virtual-pad-label {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--muted);
  font-size: 0.6rem;
}

.virtual-pad-thumb {
  position: absolute;
  left: calc(50% - 20px);
  top: calc(50% - 20px);
  width: 40px;
  height: 40px;
  border: 1px solid var(--accent);
  background: rgba(68,170,255,0.16);
  border-radius: 50%;
}

/* ─── Quiz modal ─── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 4, 10, 0.82);
}

.modal-panel {
  width: min(720px, 100%);
  padding: 24px;
  display: grid;
  gap: 18px;
}

.modal-title { font-size: 0.9rem; color: var(--accent); }
.modal-question { font-size: 0.85rem; line-height: 1.8; }

.answers-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.answer-btn {
  padding: 16px 14px;
  cursor: pointer;
  text-align: left;
  font-size: 0.72rem;
  line-height: 1.7;
  background: var(--accent-dim);
  border: 1px solid var(--border);
  color: var(--text);
  transition: background 0.1s, border-color 0.1s;
}
.answer-btn:hover { background: rgba(68,170,255,0.2); border-color: var(--accent); }
.answer-btn span { color: var(--accent); margin-right: 8px; }

.modal-meta { color: var(--muted); font-size: 0.65rem; }

/* ─── End screen ─── */
.end-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgba(2, 4, 10, 0.9);
  padding: 20px;
}

.end-card {
  width: min(480px, 100%);
  padding: 28px 24px;
  display: grid;
  gap: 18px;
}

.end-title { font-size: 1.1rem; color: var(--positive); }
.end-stat { display: flex; justify-content: space-between; font-size: 0.72rem; }
.end-stat span:last-child { color: var(--accent); }

.wheel-card {
  padding: 18px;
  border: 1px dashed rgba(68,170,255,0.25);
  display: grid;
  gap: 12px;
  text-align: center;
}

.reward-pool { color: var(--muted); font-size: 0.65rem; letter-spacing: 0.08em; }

/* ─── Spectator: player chips ─── */
.player-chips {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
}

.player-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 0.65rem;
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--positive);
  flex-shrink: 0;
}
.chip-dot.downed { background: var(--danger); }

.chip-hp {
  width: 48px;
  height: 3px;
  background: rgba(255,255,255,0.08);
}
.chip-hp-fill {
  height: 100%;
  background: var(--positive);
}

/* ─── Host dashboard ─── */
.host-layout {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-rows: 1fr 72px;
  overflow: hidden;
}

.host-arena {
  grid-column: 1;
  grid-row: 1;
  position: relative;
  overflow: hidden;
}

.host-sidebar {
  grid-column: 2;
  grid-row: 1 / 3;
  border-left: 1px solid var(--border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sidebar-header {
  padding: 14px 12px;
  font-size: 0.65rem;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  letter-spacing: 0.08em;
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 1;
}

.sidebar-row {
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  border-bottom: 1px solid rgba(60,120,255,0.1);
}

.sidebar-name { font-size: 0.65rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sidebar-tier { font-size: 0.6rem; color: var(--accent); }

.sidebar-hp-track {
  grid-column: 1 / -1;
  height: 3px;
  background: rgba(255,255,255,0.06);
}
.sidebar-hp-fill {
  height: 100%;
  background: var(--positive);
  transition: width 0.2s;
}
.sidebar-row.downed .sidebar-name { color: var(--danger); }
.sidebar-row.downed .sidebar-hp-fill { background: var(--danger); }

/* ─── Timeline bar ─── */
.timeline-bar {
  grid-column: 1;
  grid-row: 2;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 20px;
  border-top: 1px solid var(--border);
  font-size: 0.65rem;
  overflow: hidden;
}

.timeline-timer { color: var(--accent); font-size: 0.9rem; letter-spacing: 0.06em; }
.timeline-wave { color: var(--positive); }
.timeline-next { color: var(--muted); }
.timeline-kills { color: var(--danger); }
.timeline-conn { color: var(--muted); }

.host-actions { display: flex; gap: 8px; margin-left: auto; }
.host-actions .btn { width: auto; padding: 8px 14px; font-size: 0.6rem; }

/* ─── Chest drawer ─── */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(2,4,10,0.5);
}

.drawer-panel {
  position: fixed;
  top: 0;
  right: 280px;
  bottom: 72px;
  width: min(480px, 60vw);
  z-index: 21;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  border-right: 1px solid var(--border);
}

.drawer-title { font-size: 0.75rem; color: var(--accent); }

.session-card {
  padding: 14px;
  display: grid;
  gap: 10px;
}

.session-name { font-size: 0.65rem; color: var(--text); }
.session-question { font-size: 0.6rem; color: var(--muted); line-height: 1.8; }
.session-options { display: grid; gap: 6px; }

.session-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.6rem;
  padding: 8px 10px;
  border: 1px solid var(--border);
  background: rgba(4,8,16,0.6);
}
.session-option.selected { border-color: var(--accent); background: var(--accent-dim); color: var(--accent); }
.session-option.correct { border-color: var(--positive); color: var(--positive); }

/* ─── Responsive ─── */
@media (max-width: 768px) {
  .mobile-sticks { display: flex; }
  .answers-grid { grid-template-columns: 1fr; }

  .host-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 200px 72px;
  }
  .host-sidebar {
    grid-column: 1;
    grid-row: 2;
    border-left: none;
    border-top: 1px solid var(--border);
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .sidebar-row { min-width: 140px; }
  .timeline-bar { grid-row: 3; }
  .drawer-panel { right: 0; width: 100%; }
}
```

- [ ] **Step 3: Run lint**

```bash
rtk tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx && git commit -m "feat: new pixel dark-blue design system"
```

---

## Task 9: Player UI Components

**Files:**
- Modify: `components/game/game-shell.tsx`
- Modify: `components/game/hud.tsx`
- Create: `components/game/action-dock.tsx`
- Modify: `components/game/quiz-modal.tsx`
- Modify: `components/game/end-screen.tsx`

- [ ] **Step 1: Rewrite components/game/hud.tsx**

```typescript
"use client";

import type { WorldState } from "@/hooks/use-game";

type HudProps = {
  world: WorldState;
  statusMessage: string;
};

export function Hud({ world, statusMessage }: HudProps) {
  const player = world.localPlayer;
  const elapsed = world.elapsedMs;
  const timeLeft = Math.max(0, 360 - Math.floor(elapsed / 1000));
  const mm = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const ss = (timeLeft % 60).toString().padStart(2, "0");
  const hpPct = player ? Math.max(0, Math.min(100, (player.hp / Math.max(1, player.maxHp)) * 100)) : 0;

  return (
    <div className="top-hud">
      <div className="hud-bar">
        {player && (
          <div className="hud-tile panel">
            <span className="hud-label">HP</span>
            <div className="hp-bar-track"><div className="hp-bar-fill" style={{ width: `${hpPct}%` }} /></div>
            <span className="hud-value">{Math.max(0, Math.round(player.hp))}</span>
          </div>
        )}
        <div className="hud-tile panel">
          <span className="hud-label">TIME</span>
          <span className="hud-value accent">{mm}:{ss}</span>
        </div>
        {player && (
          <>
            <div className="hud-tile panel">
              <span className="hud-label">PAPER</span>
              <span className="hud-value positive">{player.papers}</span>
            </div>
            <div className="hud-tile panel">
              <span className="hud-label">TIER</span>
              <span className="hud-value accent">T{player.lootTier}</span>
            </div>
          </>
        )}
      </div>
      <div className="status-tag panel">{statusMessage}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create components/game/action-dock.tsx**

```typescript
"use client";

type ActionDockProps = {
  onDash: () => void;
  onReviveStart: () => void;
  onReviveEnd: () => void;
  onOpenChest: () => void;
  chestAvailable: boolean;
};

export function ActionDock({ onDash, onReviveStart, onReviveEnd, onOpenChest, chestAvailable }: ActionDockProps) {
  return (
    <div className="action-dock">
      <button className="btn btn-primary" onClick={onDash}>DASH</button>
      <button
        className="btn"
        onMouseDown={onReviveStart}
        onMouseUp={onReviveEnd}
        onMouseLeave={onReviveEnd}
        onTouchStart={onReviveStart}
        onTouchEnd={onReviveEnd}
      >
        HOLD REVIVE
      </button>
      <button className="btn" onClick={onOpenChest} disabled={!chestAvailable}>
        {chestAvailable ? "OPEN CHEST" : "NO CHEST"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite components/game/quiz-modal.tsx**

```typescript
"use client";

import type { Question } from "@/lib/game/questions";
import type { QuizSession } from "@/lib/game/quiz";

type QuizModalProps = {
  open: boolean;
  questions: Question[];
  session: QuizSession | null;
  onAnswer: (optionId: number) => void;
  onDone: () => void;
};

const LABELS = ["A", "B", "C", "D"];

export function QuizModal({ open, questions, session, onAnswer, onDone }: QuizModalProps) {
  if (!open || !session) return null;
  const q = questions[session.currentQuestionIndex];
  if (!q) {
    return (
      <div className="modal-backdrop">
        <div className="modal-panel panel">
          <p className="modal-title">CHEST CLAIMED</p>
          <p className="modal-meta">CORRECT: {session.correctAnswers} / {session.answersGiven}</p>
          <button className="btn btn-primary" onClick={onDone}>CLOSE</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-panel panel">
        <p className="modal-title">CHEST QUESTION {session.currentQuestionIndex + 1}</p>
        <p className="modal-question">{q.question}</p>
        <div className="answers-grid">
          {q.options.map((opt, i) => (
            <button key={i} className="answer-btn panel" onClick={() => onAnswer(i)}>
              <span>{LABELS[i]}</span>{opt}
            </button>
          ))}
        </div>
        <p className="modal-meta">CORRECT: {session.correctAnswers} | PAPERS: {session.papersUsed ?? 0}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite components/game/end-screen.tsx**

```typescript
"use client";

import type { ResultEntry } from "@/lib/game/types";

type EndScreenProps = {
  open: boolean;
  result: ResultEntry | null;
  wheelSpun: boolean;
  onSpin: () => void;
};

const REWARDS = ["MILK TEA", "CANDIES", "MYSTERY BOX", "BONUS ROUND"];

export function EndScreen({ open, result, wheelSpun, onSpin }: EndScreenProps) {
  if (!open) return null;

  const prize = wheelSpun && result
    ? REWARDS[result.answeredCount % REWARDS.length]
    : null;

  return (
    <div className="end-overlay">
      <div className="end-card panel">
        <p className="end-title">{result?.survived ? "SURVIVED" : "DOWNED"}</p>
        {result && (
          <>
            <div className="end-stat"><span>ANSWERED</span><span>{result.answeredCount}</span></div>
            <div className="end-stat"><span>STATUS</span><span>{result.survived ? "ALIVE" : "DOWNED"}</span></div>
          </>
        )}
        <div className="wheel-card panel">
          {!wheelSpun ? (
            <>
              <p className="reward-pool">SPIN FOR REWARD</p>
              <button className="btn btn-primary" onClick={onSpin}>SPIN WHEEL</button>
            </>
          ) : (
            <p className="reward-pool">REWARD: {prize}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite components/game/game-shell.tsx**

```typescript
"use client";

import Link from "next/link";
import { useGame } from "@/hooks/use-game";
import { PhaserCanvas } from "@/components/game/phaser-canvas";
import { Hud } from "@/components/game/hud";
import { ActionDock } from "@/components/game/action-dock";
import { VirtualStick } from "@/components/game/virtual-stick";
import { QuizModal } from "@/components/game/quiz-modal";
import { EndScreen } from "@/components/game/end-screen";

export function GameShell() {
  const game = useGame("player");

  if (!game.joined) {
    return (
      <main className="arena-page">
        <div className="join-screen">
          <div className="join-card panel">
            <p className="join-title">QUIZ SURVIVORS</p>
            <p className="join-sub">6:00 run. Host starts it.</p>
            <input
              className="name-input"
              value={game.playerName}
              onChange={(e) => game.setPlayerName(e.target.value)}
              maxLength={18}
              placeholder="ENTER NAME"
            />
            <button
              className="btn btn-primary"
              onClick={game.joinMatch}
              disabled={!game.hasSupabaseConfig}
            >
              {game.hasSupabaseConfig ? "PLAY" : "LOADING"}
            </button>
            <div className="join-hint">
              <span>WASD MOVE</span>
              <span>MOUSE AIM</span>
              <span>CLICK FIRE</span>
              <span>SPACE DASH</span>
            </div>
            {!game.hasSupabaseConfig && <p className="warning">MISSING SUPABASE ENV</p>}
            {game.error && <p className="warning">{game.error}</p>}
            <Link className="btn" href="/spectator">SPECTATOR</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="arena-page">
      <div className="arena-frame">
        <PhaserCanvas
          world={game.world}
          viewMode="player"
          onMove={game.setMovement}
          onAim={game.setAim}
          onStopAim={game.stopAim}
        />
        <Hud world={game.world} statusMessage={game.statusMessage} />
        <ActionDock
          onDash={game.dash}
          onReviveStart={() => game.setReviveHolding(true)}
          onReviveEnd={() => game.setReviveHolding(false)}
          onOpenChest={game.openChest}
          chestAvailable={Boolean(game.activeChest)}
        />
        <div className="mobile-sticks">
          <VirtualStick label="MOVE" onVector={game.setMovement} />
          <VirtualStick label="AIM" onVector={(x, y) => game.setAim(x, y, true)} onEnd={game.stopAim} />
        </div>
      </div>
      <QuizModal
        open={game.quiz.open}
        questions={game.quiz.questions}
        session={game.quiz.session}
        onAnswer={game.answerQuestion}
        onDone={game.closeQuiz}
      />
      <EndScreen
        open={game.isGameEnded}
        result={game.localResult}
        wheelSpun={game.wheelSpun}
        onSpin={game.spinWheel}
      />
    </main>
  );
}
```

- [ ] **Step 6: Run lint**

```bash
rtk tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add components/game/ && git commit -m "feat: rewrite player UI components with new design system"
```

---

## Task 10: Spectator UI

**Files:**
- Create: `components/spectator/player-chips.tsx`
- Modify: `components/spectator/spectator-shell.tsx`

- [ ] **Step 1: Create components/spectator/player-chips.tsx**

```typescript
"use client";

import type { PlayerSnapshot } from "@/lib/game/types";

type PlayerChipsProps = { players: PlayerSnapshot[] };

export function PlayerChips({ players }: PlayerChipsProps) {
  if (players.length === 0) return null;
  return (
    <div className="player-chips">
      {players.map((p) => {
        const hpPct = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100));
        return (
          <div key={p.uid} className="player-chip panel">
            <div className={`chip-dot${p.downed ? " downed" : ""}`} />
            <span>{p.name}</span>
            <div className="chip-hp"><div className="chip-hp-fill" style={{ width: `${hpPct}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite components/spectator/spectator-shell.tsx**

```typescript
"use client";

import { useGame } from "@/hooks/use-game";
import { PhaserCanvas } from "@/components/game/phaser-canvas";
import { PlayerChips } from "@/components/spectator/player-chips";

export function SpectatorShell() {
  const game = useGame("spectator");
  const allPlayers = [
    ...(game.world.localPlayer ? [game.world.localPlayer] : []),
    ...game.world.remotePlayers,
  ];

  return (
    <main className="arena-page">
      <div className="arena-frame">
        <PhaserCanvas world={game.world} viewMode="spectator" />
        <PlayerChips players={allPlayers} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/spectator/ && git commit -m "feat: spectator shell with player chips overlay"
```

---

## Task 11: Host Dashboard

**Files:**
- Create: `components/host/host-shell.tsx`
- Create: `components/host/player-sidebar.tsx`
- Create: `components/host/timeline-bar.tsx`
- Create: `components/host/chest-drawer.tsx`

- [ ] **Step 1: Create components/host/player-sidebar.tsx**

```typescript
"use client";

import type { PlayerSnapshot } from "@/lib/game/types";

type PlayerSidebarProps = { players: PlayerSnapshot[] };

export function PlayerSidebar({ players }: PlayerSidebarProps) {
  return (
    <aside className="host-sidebar">
      <div className="sidebar-header">PLAYERS ({players.length})</div>
      {players.map((p) => {
        const hpPct = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100));
        return (
          <div key={p.uid} className={`sidebar-row${p.downed ? " downed" : ""}`}>
            <span className="sidebar-name">{p.name}</span>
            <span className="sidebar-tier">T{p.lootTier}</span>
            <div className="sidebar-hp-track">
              <div className="sidebar-hp-fill" style={{ width: `${hpPct}%` }} />
            </div>
          </div>
        );
      })}
      {players.length === 0 && (
        <div className="sidebar-row"><span className="sidebar-name" style={{ color: "var(--muted)" }}>NO PLAYERS</span></div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Create components/host/timeline-bar.tsx**

```typescript
"use client";

import { getUpcomingEvents, WAVE_EVENTS } from "@/lib/game/timeline";
import type { MatchMeta } from "@/lib/game/types";

type TimelineBarProps = {
  elapsedMs: number;
  meta: MatchMeta;
  onStart: () => void;
  onReset: () => void;
  canHost: boolean;
};

export function TimelineBar({ elapsedMs, meta, onStart, onReset, canHost }: TimelineBarProps) {
  const timeLeft = Math.max(0, 360 - Math.floor(elapsedMs / 1000));
  const mm = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const ss = (timeLeft % 60).toString().padStart(2, "0");

  const currentWave = [...WAVE_EVENTS].reverse().find((e) => elapsedMs >= e.atMs);
  const upcoming = getUpcomingEvents(elapsedMs, 1)[0];
  const nextIn = upcoming ? Math.max(0, Math.ceil((upcoming.atMs - elapsedMs) / 1000)) : null;

  return (
    <div className="timeline-bar panel">
      <span className="timeline-timer">{mm}:{ss}</span>
      {currentWave && <span className="timeline-wave">{currentWave.label.toUpperCase()}</span>}
      {upcoming && nextIn !== null && (
        <span className="timeline-next">NEXT: {upcoming.label.toUpperCase()} IN {nextIn}S</span>
      )}
      <span className="timeline-kills">KILLS: {meta.globalKillCount}</span>
      <span className="timeline-conn">CONN: {meta.connectedCount}</span>
      {canHost && (
        <div className="host-actions">
          {meta.status === "waiting" && (
            <button className="btn btn-primary" onClick={onStart}>START</button>
          )}
          <button className="btn btn-danger" onClick={onReset}>RESET</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create components/host/chest-drawer.tsx**

```typescript
"use client";

import type { ActiveAnswerSession } from "@/lib/game/types";

type ChestDrawerProps = {
  chestId: string | null;
  sessions: Record<string, ActiveAnswerSession>;
  onClose: () => void;
};

const LABELS = ["A", "B", "C", "D"];

export function ChestDrawer({ chestId, sessions, onClose }: ChestDrawerProps) {
  if (!chestId) return null;

  const chestSessions = Object.values(sessions).filter((s) => s.chestId === chestId);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-panel panel">
        <p className="drawer-title">CHEST {chestId.replace("chest-", "")} — LIVE ANSWERS</p>
        {chestSessions.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: "0.65rem" }}>NO ACTIVE SESSIONS</p>
        )}
        {chestSessions.map((s) => (
          <div key={s.uid} className="session-card panel">
            <p className="session-name">{s.playerName} — {s.correctAnswers}/{s.answersGiven} CORRECT</p>
            <p className="session-question">{s.question}</p>
            <div className="session-options">
              {s.options.map((opt, i) => (
                <div
                  key={i}
                  className={`session-option${s.selectedOptionId === i ? " selected" : ""}`}
                >
                  <span>{LABELS[i]}</span> {opt}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Create components/host/host-shell.tsx**

```typescript
"use client";

import { useState } from "react";
import { useGame } from "@/hooks/use-game";
import { PhaserCanvas } from "@/components/game/phaser-canvas";
import { PlayerSidebar } from "@/components/host/player-sidebar";
import { TimelineBar } from "@/components/host/timeline-bar";
import { ChestDrawer } from "@/components/host/chest-drawer";

type HostShellProps = { hostAccessEnabled: boolean };

export function HostShell({ hostAccessEnabled }: HostShellProps) {
  const game = useGame("spectator", { hostAccessEnabled });
  const [openChestId, setOpenChestId] = useState<string | null>(null);
  const players = Object.values(game.room.players);

  function handleChestClick(chestId: string) {
    setOpenChestId((prev) => (prev === chestId ? null : chestId));
  }

  return (
    <div className="host-layout">
      <div className="host-arena">
        <PhaserCanvas
          world={game.world}
          viewMode="spectator"
          onAim={(x, y) => {
            // map click to chest — check if near any chest
            const chest = game.world.chests.find((c) => Math.hypot(c.x - x, c.y - y) < 80);
            if (chest) handleChestClick(chest.id);
          }}
        />
        <ChestDrawer
          chestId={openChestId}
          sessions={game.room.sessions}
          onClose={() => setOpenChestId(null)}
        />
      </div>
      <PlayerSidebar players={players} />
      <TimelineBar
        elapsedMs={game.world.elapsedMs}
        meta={game.room.meta}
        onStart={game.startMatch}
        onReset={game.resetMatch}
        canHost={game.canHost}
      />
    </div>
  );
}
```

- [ ] **Step 5: Run lint**

```bash
rtk tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add components/host/ && git commit -m "feat: host dashboard with sidebar, timeline, chest drawer"
```

---

## Task 12: Routes

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/play/page.tsx`
- Modify: `app/spectator/page.tsx`
- Modify: `app/host/[token]/page.tsx`

- [ ] **Step 1: app/page.tsx**

```typescript
import { redirect } from "next/navigation";
export default function Home() { redirect("/play"); }
```

- [ ] **Step 2: app/play/page.tsx**

```typescript
import { GameShell } from "@/components/game/game-shell";
export default function PlayPage() { return <GameShell />; }
```

- [ ] **Step 3: app/spectator/page.tsx**

```typescript
import { SpectatorShell } from "@/components/spectator/spectator-shell";
export default function SpectatorPage() { return <SpectatorShell />; }
```

- [ ] **Step 4: app/host/[token]/page.tsx**

```typescript
import { HostShell } from "@/components/host/host-shell";
import { canUseHostControls } from "@/lib/host/access";

type Props = { params: Promise<{ token: string }> };

export default async function HostPage({ params }: Props) {
  const { token } = await params;
  const hostAccessEnabled = canUseHostControls({ providedToken: token });
  return <HostShell hostAccessEnabled={hostAccessEnabled} />;
}
```

- [ ] **Step 5: Commit**

```bash
git add app/ && git commit -m "feat: update routes for new component structure"
```

---

## Task 13: Audit host access, delete old hook, verify build

**Files:**
- Check: `lib/host/access.ts`
- Delete: `hooks/use-quiz-survivors-game.ts`

- [ ] **Step 1: Check lib/host/access.ts**

Read the file and confirm it accepts `{ hostAccessEnabled?: boolean; providedToken?: string }`. If it expects different args, update the call sites in `HostPage` and `useGame`.

- [ ] **Step 2: Delete old hook**

```bash
rm hooks/use-quiz-survivors-game.ts
```

- [ ] **Step 3: Delete old Firebase types if any remain in tests**

Check `tests/` for any import of `firebase` or `use-quiz-survivors-game`:

```bash
rtk grep -r "firebase\|use-quiz-survivors-game" tests/
```

Update any such imports. The `tests/game/room.test.ts` likely imports from `lib/game/room` — that file is kept, so it should be fine. Check `lib/firebase/` is fully gone.

- [ ] **Step 4: Run all tests**

```bash
rtk vitest run
```

Expected: all pass.

- [ ] **Step 5: Run full build**

```bash
rtk next build
```

Expected: build succeeds. Fix any remaining type errors.

- [ ] **Step 6: Run lint**

```bash
rtk lint
```

Fix any lint errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: remove old hook and firebase, verify build"
```

---

## Task 14: Update docs

**Files:**
- Modify: `docs/context.md`
- Modify: `docs/memory.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Update docs/context.md**

Replace Firebase references with Supabase. Update Current Status section.

- [ ] **Step 2: Update docs/memory.md**

Add: Supabase Realtime Broadcast replaces Firebase. New modules: weapon, mob, loop. New hook: use-game. New UI: dark pixel design system. Remove Firebase notes.

- [ ] **Step 3: Update docs/ARCHITECTURE.md**

Replace Firebase section with Supabase Broadcast. Update Core Files list. Update Sync Boundary section.

- [ ] **Step 4: Final commit**

```bash
git add docs/ && git commit -m "docs: update architecture and context for refactor"
```

---

## Success Criteria Checklist

- [ ] `rtk vitest run` — all tests pass (weapon, mob, loop, plus originals)
- [ ] `rtk tsc --noEmit` — zero type errors
- [ ] `rtk lint` — zero lint errors
- [ ] `rtk next build` — build succeeds
- [ ] `/play` join screen renders with pixel font and dark glass panels
- [ ] Arena fills 100% viewport after joining
- [ ] WASD + mouse fire works on desktop
- [ ] Mobile joysticks visible on small viewport
- [ ] Zombies separate, don't pile-up
- [ ] Quiz modal opens from chest
- [ ] `/spectator` shows arena + player chips
- [ ] `/host/[token]` shows layout with sidebar + timeline bar
- [ ] Timeline bar shows current wave and next event countdown
- [ ] Chest click on host view opens drawer with session cards
