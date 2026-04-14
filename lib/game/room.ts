import { DEFAULT_META, SPAWN_POINTS } from "@/lib/game/config";
import type {
  ActiveAnswerSession,
  BurstSnapshot,
  ChestSnapshot,
  FeedItem,
  MatchMeta,
  PlayerSnapshot,
  ResultEntry,
  RoomSnapshot,
} from "@/lib/game/types";

type RawRoomSnapshot = Partial<{
  meta: Partial<MatchMeta>;
  players: Record<string, Partial<PlayerSnapshot> | null | undefined>;
  bursts: Record<string, BurstSnapshot>;
  chests: Record<string, Partial<ChestSnapshot> | null | undefined>;
  sessions: Record<string, Partial<ActiveAnswerSession> | null | undefined>;
  feed: Record<string, Partial<FeedItem> | null | undefined>;
  results: Record<string, Partial<ResultEntry> | null | undefined>;
}>;

export const PREVIEW_PLAYER_UID = "preview-player";

export function getAvatarLabel(name: string, uid: string) {
  const fallback = uid.slice(0, 2).toUpperCase();
  const letters = name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase();
  return letters || fallback || "QS";
}

export function createPreviewPlayer(name = "Runner"): PlayerSnapshot {
  return createPlayerSnapshot({
    uid: PREVIEW_PLAYER_UID,
    name,
    now: 0,
    existing: {
      x: SPAWN_POINTS[4].x,
      y: SPAWN_POINTS[4].y,
    },
  });
}

export function createPlayerSnapshot(input: {
  uid: string;
  name?: string | null;
  now: number;
  existing?: Partial<PlayerSnapshot> | null;
}): PlayerSnapshot {
  const { uid, existing, now } = input;
  const spawnPoint = getSpawnPoint(uid);
  const name = normalizeName(input.name ?? existing?.name);

  return {
    uid,
    name,
    avatar: getAvatarLabel(name, uid),
    x: coerceNumber(existing?.x, spawnPoint.x),
    y: coerceNumber(existing?.y, spawnPoint.y),
    vx: coerceNumber(existing?.vx, 0),
    vy: coerceNumber(existing?.vy, 0),
    hp: coerceNumber(existing?.hp, 100),
    maxHp: coerceNumber(existing?.maxHp, 100),
    papers: coerceNumber(existing?.papers, 0),
    lootTier: normalizeTier(existing?.lootTier),
    weaponTier: normalizeTier(existing?.weaponTier),
    armorTier: normalizeTier(existing?.armorTier),
    companionTier: normalizeTier(existing?.companionTier),
    downed: Boolean(existing?.downed),
    downedAt: typeof existing?.downedAt === "number" ? existing.downedAt : null,
    spectating: Boolean(existing?.spectating),
    answering: Boolean(existing?.answering),
    kills: coerceNumber(existing?.kills, 0),
    answeredCount: coerceNumber(existing?.answeredCount, 0),
    updatedAt: coerceNumber(existing?.updatedAt, now),
  };
}

export function normalizePlayers(
  players: RawRoomSnapshot["players"],
): Record<string, PlayerSnapshot> {
  if (!players) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(players)
      .filter(([, value]) => Boolean(value))
      .map(([uid, value]) => [
        uid,
        createPlayerSnapshot({
          uid,
          name: value?.name,
          now: Date.now(),
          existing: value,
        }),
      ]),
  );
}

export function normalizeRoomSnapshot(value: RawRoomSnapshot | null | undefined): RoomSnapshot {
  const players = normalizePlayers(value?.players);

  return {
    meta: {
      ...DEFAULT_META,
      ...(value?.meta ?? {}),
    },
    players,
    bursts: value?.bursts ?? {},
    chests: normalizeChests(value?.chests),
    sessions: normalizeSessions(value?.sessions),
    feed: normalizeFeed(value?.feed),
    results: normalizeResults(value?.results, players),
  };
}

export function splitPlayers(
  players: Record<string, PlayerSnapshot>,
  localUid: string | null,
) {
  const entries = Object.values(players);
  const localPlayer = localUid ? players[localUid] ?? null : null;
  const remotePlayers = entries.filter((entry) => entry.uid !== localUid);

  return {
    localPlayer,
    remotePlayers,
  };
}

function normalizeChests(
  chests: RawRoomSnapshot["chests"],
): Record<string, ChestSnapshot> {
  if (!chests) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(chests)
      .filter(([, value]) => Boolean(value))
      .map(([id, value]) => [
        id,
        {
          id,
          spawnedAt: coerceNumber(value?.spawnedAt, 0),
          expiresAt: coerceNumber(value?.expiresAt, 0),
          x: coerceNumber(value?.x, 0),
          y: coerceNumber(value?.y, 0),
          openedBy: typeof value?.openedBy === "string" ? value.openedBy : null,
          active: Boolean(value?.active),
          questionCount: coerceNumber(value?.questionCount, 0),
          claimedTier: normalizeTier(value?.claimedTier),
        },
      ]),
  );
}

function normalizeSessions(
  sessions: RawRoomSnapshot["sessions"],
): Record<string, ActiveAnswerSession> {
  if (!sessions) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(sessions)
      .filter(([, value]) => Boolean(value))
      .map(([uid, value]) => {
        const options = Array.isArray(value?.options) ? value.options.slice(0, 4) : [];
        return [
          uid,
          {
            uid,
            playerName: normalizeName(value?.playerName),
            avatar: typeof value?.avatar === "string" ? value.avatar : getAvatarLabel(normalizeName(value?.playerName), uid),
            chestId: typeof value?.chestId === "string" ? value.chestId : "",
            questionId: typeof value?.questionId === "string" ? value.questionId : "",
            question: typeof value?.question === "string" ? value.question : "",
            options: [
              options[0] ?? "",
              options[1] ?? "",
              options[2] ?? "",
              options[3] ?? "",
            ],
            selectedOptionId: typeof value?.selectedOptionId === "number" ? value.selectedOptionId : null,
            answersGiven: coerceNumber(value?.answersGiven, 0),
            correctAnswers: coerceNumber(value?.correctAnswers, 0),
            papersRemaining: coerceNumber(value?.papersRemaining, 0),
            updatedAt: coerceNumber(value?.updatedAt, 0),
          },
        ];
      }),
  );
}

function normalizeFeed(feed: RawRoomSnapshot["feed"]): Record<string, FeedItem> {
  if (!feed) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(feed)
      .filter(([, value]) => Boolean(value))
      .map(([id, value]) => [
        id,
        {
          id,
          actor: normalizeName(value?.actor),
          kind: normalizeFeedKind(value?.kind),
          createdAt: coerceNumber(value?.createdAt, 0),
          detail: typeof value?.detail === "string" ? value.detail : "",
        },
      ]),
  );
}

function normalizeResults(
  results: RawRoomSnapshot["results"],
  players: Record<string, PlayerSnapshot>,
): Record<string, ResultEntry> {
  if (!results) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(results)
      .filter(([, value]) => Boolean(value))
      .map(([uid, value]) => [
        uid,
        {
          uid,
          name: normalizeName(value?.name ?? players[uid]?.name),
          survived: Boolean(value?.survived),
          answeredCount: coerceNumber(value?.answeredCount, 0),
          reward: normalizeReward(value?.reward),
          fairSpin: Boolean(value?.fairSpin),
          createdAt: coerceNumber(value?.createdAt, 0),
        },
      ]),
  );
}

function normalizeName(name: unknown): string {
  if (typeof name !== "string") {
    return "Runner";
  }

  const trimmed = name.trim();
  return trimmed || "Runner";
}

function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeTier(value: unknown): 0 | 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }

  return 0;
}

function normalizeFeedKind(value: unknown): FeedItem["kind"] {
  if (value === "downed" || value === "revive" || value === "loot") {
    return value;
  }

  return "kill";
}

function normalizeReward(value: unknown): ResultEntry["reward"] {
  if (value === "milk-tea" || value === "candies") {
    return value;
  }

  return "none";
}

function getSpawnPoint(uid: string) {
  const hash = uid.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return SPAWN_POINTS[hash % SPAWN_POINTS.length];
}
