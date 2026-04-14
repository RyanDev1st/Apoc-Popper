export type CombatStats = {
  damage: number;
  fireRateMs: number;
  speed: number;
  dashCooldownMs: number;
  armorMitigation: number;
  auraDamage: number;
  companionShots: number;
  weaponTier: number;
  armorTier: number;
  companionTier: number;
};

export function createBaseCombatStats(): CombatStats {
  return {
    damage: 12,
    fireRateMs: 420,
    speed: 132,
    dashCooldownMs: 2_000,
    armorMitigation: 0,
    auraDamage: 0,
    companionShots: 0,
    weaponTier: 0,
    armorTier: 0,
    companionTier: 0,
  };
}

export function getLootTierForCorrectAnswers(correctAnswers: number): 0 | 1 | 2 | 3 {
  if (correctAnswers >= 5) {
    return 3;
  }

  if (correctAnswers >= 3) {
    return 2;
  }

  if (correctAnswers >= 1) {
    return 1;
  }

  return 0;
}

const TIER_MULTIPLIERS = {
  0: { damage: 1, fireRate: 1, speed: 1, mitigation: 0, aura: 0, companion: 0 },
  1: { damage: 1.18, fireRate: 0.9, speed: 1.04, mitigation: 0.08, aura: 0, companion: 1 },
  2: { damage: 1.34, fireRate: 0.8, speed: 1.08, mitigation: 0.16, aura: 2, companion: 2 },
  3: { damage: 1.58, fireRate: 0.68, speed: 1.12, mitigation: 0.24, aura: 4, companion: 3 },
} as const;

export function applyLootTier(base: CombatStats, tier: 0 | 1 | 2 | 3): CombatStats {
  if (tier <= base.weaponTier) {
    return base;
  }

  const modifiers = TIER_MULTIPLIERS[tier];

  return {
    ...base,
    damage: Math.round(base.damage * modifiers.damage),
    fireRateMs: Math.max(140, Math.round(base.fireRateMs * modifiers.fireRate)),
    speed: Math.round(base.speed * modifiers.speed),
    armorMitigation: modifiers.mitigation,
    auraDamage: modifiers.aura,
    companionShots: modifiers.companion,
    weaponTier: tier,
    armorTier: Math.max(base.armorTier, tier),
    companionTier: Math.max(base.companionTier, tier),
  };
}

