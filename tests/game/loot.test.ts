import {
  applyLootTier,
  createBaseCombatStats,
  getLootTierForCorrectAnswers,
} from "@/lib/game/loot";

describe("loot", () => {
  it("maps quiz streaks to the expected loot tiers", () => {
    expect(getLootTierForCorrectAnswers(0)).toBe(0);
    expect(getLootTierForCorrectAnswers(1)).toBe(1);
    expect(getLootTierForCorrectAnswers(3)).toBe(2);
    expect(getLootTierForCorrectAnswers(5)).toBe(3);
  });

  it("auto-equips stronger loot and upgrades combat stats", () => {
    const base = createBaseCombatStats();
    const tierOne = applyLootTier(base, 1);
    const tierThree = applyLootTier(tierOne, 3);

    expect(tierOne.weaponTier).toBe(1);
    expect(tierOne.fireRateMs).toBeLessThan(base.fireRateMs);
    expect(tierThree.weaponTier).toBe(3);
    expect(tierThree.armorTier).toBe(3);
    expect(tierThree.companionTier).toBe(3);
    expect(tierThree.damage).toBeGreaterThan(tierOne.damage);
  });
});
