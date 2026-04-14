export type MatchStatus = "waiting" | "live" | "ended";

export type LootTier = 0 | 1 | 2 | 3;

export type MatchMeta = {
  status: MatchStatus;
  startedAt: number | null;
  endedAt: number | null;
  hostUid: string | null;
  timelineVersion: number;
  connectedCount: number;
  globalKillCount: number;
};

export type PlayerSnapshot = {
  uid: string;
  name: string;
  avatar: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  papers: number;
  lootTier: LootTier;
  weaponTier: LootTier;
  armorTier: LootTier;
  companionTier: LootTier;
  downed: boolean;
  downedAt: number | null;
  spectating: boolean;
  answering: boolean;
  kills: number;
  answeredCount: number;
  updatedAt: number;
};

export type BurstSnapshot = {
  id: string;
  startedAt: number;
  seed: string;
  playerScale: number;
  meteorSeed: string;
  gasSeed: string;
};

export type ChestSnapshot = {
  id: string;
  spawnedAt: number;
  expiresAt: number;
  x: number;
  y: number;
  openedBy: string | null;
  active: boolean;
  questionCount: number;
  claimedTier: LootTier;
};

export type FeedItem = {
  id: string;
  actor: string;
  kind: "kill" | "downed" | "revive" | "loot";
  createdAt: number;
  detail: string;
};

export type ResultEntry = {
  uid: string;
  name: string;
  survived: boolean;
  answeredCount: number;
  reward: "milk-tea" | "candies" | "none";
  fairSpin: boolean;
  createdAt: number;
};

export type ActiveAnswerSession = {
  uid: string;
  playerName: string;
  avatar: string;
  chestId: string;
  questionId: string;
  question: string;
  options: [string, string, string, string];
  selectedOptionId: number | null;
  answersGiven: number;
  correctAnswers: number;
  papersRemaining: number;
  updatedAt: number;
};

export type RoomSnapshot = {
  meta: MatchMeta;
  players: Record<string, PlayerSnapshot>;
  bursts: Record<string, BurstSnapshot>;
  chests: Record<string, ChestSnapshot>;
  sessions: Record<string, ActiveAnswerSession>;
  feed: Record<string, FeedItem>;
  results: Record<string, ResultEntry>;
};

export type Question = {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctOptionId: number;
};
