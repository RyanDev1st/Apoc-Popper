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
