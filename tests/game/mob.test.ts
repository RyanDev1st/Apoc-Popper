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
