"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  onDisconnect,
  onValue,
  push,
  remove,
  runTransaction,
  set,
  update,
} from "firebase/database";
import { canUseHostControls } from "@/lib/host/access";
import { getPlayerMoveScale, resolveZombieTarget } from "@/lib/game/ai";
import {
  CHEST_LAYOUT,
  DASH_COOLDOWN_MS,
  DASH_DURATION_MS,
  DEFAULT_META,
  PLAYER_SYNC_MS,
  REVIVE_HOLD_MS,
  REVIVE_WINDOW_MS,
  SAFE_RING_RADIUS,
  clampToArena,
} from "@/lib/game/config";
import { rollPaperDrop } from "@/lib/game/drops";
import { ensureAnonymousSession, hasFirebaseConfig, roomRef } from "@/lib/firebase/client";
import { applyLootTier, createBaseCombatStats } from "@/lib/game/loot";
import { getRandomQuestionSet, type Question } from "@/lib/game/questions";
import { buildQuizSession, getQuizTier, submitQuizAnswer, type QuizSession } from "@/lib/game/quiz";
import { createPlayerSnapshot, normalizeRoomSnapshot } from "@/lib/game/room";
import { buildBurstPlan } from "@/lib/game/spawns";
import {
  CATASTROPHE_EVENTS,
  CHEST_DURATION_MS,
  CHEST_EVENTS,
  GAME_DURATION_MS,
  WAVE_EVENTS,
  isGameOver,
} from "@/lib/game/timeline";
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

type GameMode = "player" | "spectator";

type GameOptions = {
  hostAccessEnabled?: boolean;
};

type InputState = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  firing: boolean;
  reviveHolding: boolean;
};

type Bullet = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
};

type Zombie = {
  id: string;
  x: number;
  y: number;
  hp: number;
  speed: number;
  damage: number;
  targetUid: string | null;
};

type Meteor = {
  id: string;
  x: number;
  y: number;
  radius: number;
};

type GasCloud = {
  id: string;
  x: number;
  y: number;
  radius: number;
};

export type WorldState = {
  localPlayer: PlayerSnapshot | null;
  remotePlayers: PlayerSnapshot[];
  bullets: Bullet[];
  zombies: Zombie[];
  meteors: Meteor[];
  gasClouds: GasCloud[];
  chests: ChestSnapshot[];
  elapsedMs: number;
};

type QuizViewState = {
  open: boolean;
  questions: Question[];
  session: QuizSession | null;
  selectedChest: ChestSnapshot | null;
};

const EMPTY_ROOM = normalizeRoomSnapshot(undefined);

export function useQuizSurvivorsGame(mode: GameMode, options?: GameOptions) {
  const [uid, setUid] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("Runner");
  const [joined, setJoined] = useState(mode === "spectator");
  const [room, setRoom] = useState<RoomSnapshot>(EMPTY_ROOM);
  const [world, setWorld] = useState<WorldState>({
    localPlayer: null,
    remotePlayers: [],
    bullets: [],
    zombies: [],
    meteors: [],
    gasClouds: [],
    chests: [],
    elapsedMs: 0,
  });
  const [quiz, setQuiz] = useState<QuizViewState>({
    open: false,
    questions: [],
    session: null,
    selectedChest: null,
  });
  const [statusMessage, setStatusMessage] = useState("Join.");
  const [error, setError] = useState<string | null>(null);
  const [wheelSpun, setWheelSpun] = useState(false);
  const [localResult, setLocalResult] = useState<ResultEntry | null>(null);
  const bulletsRef = useRef<Bullet[]>([]);
  const zombiesRef = useRef<Zombie[]>([]);
  const roomStateRef = useRef(room);
  const joinedRef = useRef(joined);
  const uidRef = useRef(uid);
  const localPlayerRef = useRef<PlayerSnapshot | null>(null);
  const inputRef = useRef<InputState>({
    moveX: 0,
    moveY: 0,
    aimX: 1,
    aimY: 0,
    firing: false,
    reviveHolding: false,
  });
  const lastSyncRef = useRef(0);
  const lastShotRef = useRef(0);
  const dashStateRef = useRef({ activeUntil: 0, cooldownUntil: 0 });
  const reviveStateRef = useRef({ startedAt: 0, targetUid: null as string | null });
  const spawnedBurstsRef = useRef<Set<string>>(new Set());
  const authAttemptedRef = useRef(false);
  const resultCommittedRef = useRef(false);
  const endCommittedRef = useRef(false);
  const timelineVersionRef = useRef(DEFAULT_META.timelineVersion);
  const tickRef = useRef<(timestamp: number) => void>(() => {});

  useEffect(() => {
    roomStateRef.current = room;
  }, [room]);

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);

  useEffect(() => {
    const savedName = window.localStorage.getItem("quiz-survivors-name");

    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig() || authAttemptedRef.current) {
      return;
    }

    authAttemptedRef.current = true;
    ensureAnonymousSession()
      .then((nextUid) => {
        if (nextUid) {
          setUid(nextUid);
        }
      })
      .catch((authError: unknown) => {
        setError(authError instanceof Error ? authError.message : "Anonymous auth failed.");
      });
  }, []);

  useEffect(() => {
    const ref = roomRef();

    if (!ref) {
      return;
    }

    return onValue(ref, (snapshot) => {
      setRoom(normalizeRoomSnapshot(snapshot.val() ?? undefined));
    });
  }, []);

  useEffect(() => {
    if (room.meta.timelineVersion === timelineVersionRef.current) {
      return;
    }

    timelineVersionRef.current = room.meta.timelineVersion;
    bulletsRef.current = [];
    zombiesRef.current = [];
    spawnedBurstsRef.current.clear();
    resultCommittedRef.current = false;
    endCommittedRef.current = false;
    setLocalResult(null);
    setWheelSpun(false);
    setQuiz({ open: false, questions: [], session: null, selectedChest: null });

    if (mode === "player" && uid && joinedRef.current) {
      localPlayerRef.current = createPlayerSnapshot({
        uid,
        name: playerName,
        now: Date.now(),
      });
    }
  }, [joined, mode, playerName, room.meta.timelineVersion, uid]);

  useEffect(() => {
    if (room.meta.status === "waiting") {
      endCommittedRef.current = false;
      if (joinedRef.current) {
        setStatusMessage("Waiting for host.");
      }
      return;
    }

    if (room.meta.status === "live") {
      setStatusMessage("Survive.");
      return;
    }

    setStatusMessage("Finished.");
  }, [room.meta.status]);

  useEffect(() => {
    if (mode !== "player" || !uid || !joined) {
      return;
    }

    const playerNode = roomRef(`players/${uid}`);

    if (!playerNode) {
      return;
    }

    const player = createPlayerSnapshot({
      uid,
      name: playerName,
      now: Date.now(),
      existing: localPlayerRef.current,
    });

    localPlayerRef.current = player;
    set(playerNode, player).catch(() => {});
    onDisconnect(playerNode).remove().catch(() => {});

    return () => {
      remove(playerNode).catch(() => {});
    };
  }, [joined, mode, playerName, uid]);

  useEffect(() => {
    if (mode !== "player" || !uid) {
      return;
    }

    const roomLocal = room.players[uid];
    const currentLocal = localPlayerRef.current;

    if (
      roomLocal &&
      (!currentLocal ||
        roomLocal.updatedAt >= currentLocal.updatedAt ||
        roomLocal.downed !== currentLocal.downed ||
        roomLocal.spectating !== currentLocal.spectating ||
        roomLocal.answering !== currentLocal.answering ||
        room.meta.status === "waiting")
    ) {
      localPlayerRef.current = roomLocal;
    }
  }, [mode, room.meta.status, room.players, uid]);

  tickRef.current = (timestamp: number) => {
    const currentRoom = roomStateRef.current;
    const now = Date.now();
    const startedAt = currentRoom.meta.startedAt ?? 0;
    const elapsedMs =
      currentRoom.meta.status === "live" && startedAt
        ? Math.max(0, now - startedAt)
        : currentRoom.meta.status === "ended" && startedAt
          ? Math.max(0, (currentRoom.meta.endedAt ?? now) - startedAt)
          : 0;

    if (currentRoom.meta.status === "live" && elapsedMs >= GAME_DURATION_MS) {
      maybeEndMatch();
    }

    if (mode === "player" && joinedRef.current && localPlayerRef.current) {
      const nextLocal = simulateLocalPlayer(localPlayerRef.current, {
        input: inputRef.current,
        elapsedMs,
        status: currentRoom.meta.status,
        quizOpen: quiz.open,
      });

      localPlayerRef.current = nextLocal;

      if (currentRoom.meta.status === "live") {
        simulateProjectiles(nextLocal, timestamp);
        simulateBursts(currentRoom.bursts, currentRoom.players);
        simulateHazards(elapsedMs);
        resolveCollisions(nextLocal, currentRoom.players, currentRoom.meta.globalKillCount);
      } else {
        bulletsRef.current = [];
        zombiesRef.current = [];
      }

      maybeCommitResult(nextLocal, elapsedMs);
      void syncLocalPlayer();
    }

    startTransition(() => {
      setWorld({
        localPlayer: mode === "player" ? localPlayerRef.current : null,
        remotePlayers: interpolatePlayers(currentRoom.players, uidRef.current, mode),
        bullets: bulletsRef.current,
        zombies: zombiesRef.current,
        meteors: buildMeteors(elapsedMs),
        gasClouds: buildGasClouds(elapsedMs),
        chests: deriveChestState(currentRoom.chests, now),
        elapsedMs,
      });
    });
  };

  useEffect(() => {
    let frameId = 0;

    const loop = (timestamp: number) => {
      tickRef.current(timestamp);
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const activeChest = useMemo(() => {
    const localPlayer = world.localPlayer;

    if (!localPlayer) {
      return null;
    }

    return (
      world.chests.find((chest) => {
        const distance = Math.hypot(localPlayer.x - chest.x, localPlayer.y - chest.y);
        return chest.active && distance <= SAFE_RING_RADIUS;
      }) ?? null
    );
  }, [world.chests, world.localPlayer]);

  const canHost = useMemo(
    () =>
      canUseHostControls({
        hostAccessEnabled: options?.hostAccessEnabled ?? false,
      }),
    [options?.hostAccessEnabled],
  );

  const isGameLive = room.meta.status === "live";
  const isGameEnded = room.meta.status === "ended" || isGameOver(world.elapsedMs);
  const feedItems = Object.values(room.feed)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 8);
  const activeSessions = Object.values(room.sessions).sort((left, right) => right.updatedAt - left.updatedAt);
  const topKillers = Object.values(room.players)
    .sort((left, right) => right.kills - left.kills)
    .slice(0, 5);

  function joinMatch() {
    if (mode !== "player") {
      return;
    }

    if (!hasFirebaseConfig()) {
      setError("Add Firebase env first.");
      return;
    }

    if (!uid) {
      setError("Waiting for Firebase.");
      return;
    }

    const safeName = playerName.trim() || "Runner";
    window.localStorage.setItem("quiz-survivors-name", safeName);
    setPlayerName(safeName);
    setError(null);
    setJoined(true);
    setStatusMessage("Waiting for host.");
  }

  function setMovement(x: number, y: number) {
    inputRef.current.moveX = x;
    inputRef.current.moveY = y;
  }

  function setAim(x: number, y: number, firing = true) {
    inputRef.current.aimX = x;
    inputRef.current.aimY = y;
    inputRef.current.firing = firing;
  }

  function stopAim() {
    inputRef.current.firing = false;
  }

  function setReviveHolding(holding: boolean) {
    inputRef.current.reviveHolding = holding;
  }

  function dash() {
    const now = Date.now();
    const localPlayer = localPlayerRef.current;

    if (!localPlayer || localPlayer.downed || dashStateRef.current.cooldownUntil > now) {
      return;
    }

    dashStateRef.current = {
      activeUntil: now + DASH_DURATION_MS,
      cooldownUntil: now + DASH_COOLDOWN_MS,
    };
  }

  async function startMatch() {
    if (!canHost || !uid) {
      return;
    }

    const now = Date.now();
    const metaNode = roomRef("meta");
    const burstsNode = roomRef("bursts");
    const chestsNode = roomRef("chests");

    if (!metaNode || !burstsNode || !chestsNode) {
      return;
    }

    const playerCount = Math.max(1, Object.keys(room.players).length || 1);
    const burstEntries = Object.fromEntries(
      WAVE_EVENTS.filter((event) => event.kind === "wave" && event.atMs < GAME_DURATION_MS).map((event) => {
        const seed = `${now}-${event.id}`;
        const burst: BurstSnapshot = {
          id: event.id,
          startedAt: now + event.atMs,
          seed,
          playerScale: playerCount,
          meteorSeed: `${seed}-meteor`,
          gasSeed: `${seed}-gas`,
        };

        return [event.id, burst];
      }),
    );

    const chestEntries = Object.fromEntries(
      CHEST_EVENTS.map((event, index) => {
        const layout = CHEST_LAYOUT[index];
        const chest: ChestSnapshot = {
          id: event.id,
          spawnedAt: now + event.atMs,
          expiresAt: now + event.atMs + CHEST_DURATION_MS,
          x: layout.x,
          y: layout.y,
          openedBy: null,
          active: true,
          questionCount: 0,
          claimedTier: 0,
        };

        return [event.id, chest];
      }),
    );

    await set(burstsNode, burstEntries);
    await set(chestsNode, chestEntries);
    await update(metaNode, {
      status: "live",
      startedAt: now,
      endedAt: null,
      hostUid: uid,
      timelineVersion: (room.meta.timelineVersion ?? 0) + 1,
      connectedCount: Object.keys(room.players).length,
      globalKillCount: 0,
    });
    spawnedBurstsRef.current.clear();
    resultCommittedRef.current = false;
    endCommittedRef.current = false;
    setLocalResult(null);
    setWheelSpun(false);
    setStatusMessage("Live.");
  }

  async function resetMatch() {
    if (!canHost) {
      return;
    }

    const roomNode = roomRef();

    if (!roomNode) {
      return;
    }

    await update(roomNode, {
      meta: {
        ...DEFAULT_META,
        timelineVersion: (room.meta.timelineVersion ?? 0) + 1,
      },
      bursts: null,
      chests: null,
      feed: null,
      sessions: null,
      results: null,
    });
    bulletsRef.current = [];
    zombiesRef.current = [];
    spawnedBurstsRef.current.clear();
    resultCommittedRef.current = false;
    endCommittedRef.current = false;
    setQuiz({ open: false, questions: [], session: null, selectedChest: null });
    setLocalResult(null);
    setWheelSpun(false);
  }

  async function advanceRound() {
    await resetMatch();
    await startMatch();
  }

  async function openChest() {
    const localPlayer = localPlayerRef.current;

    if (!localPlayer || !activeChest || quiz.open || localPlayer.spectating) {
      return;
    }

    if (activeChest.openedBy && activeChest.openedBy !== localPlayer.uid) {
      return;
    }

    const questionSet = getRandomQuestionSet(`${activeChest.id}-${room.meta.startedAt ?? 0}`, 6);
    const session = buildQuizSession({
      chestId: activeChest.id,
      papers: localPlayer.papers,
      questionIds: questionSet.map((question) => question.id),
    });

    setQuiz({
      open: true,
      questions: questionSet,
      session,
      selectedChest: activeChest,
    });

    localPlayerRef.current = {
      ...localPlayer,
      answering: true,
    };
    await syncLocalPlayer(true);
    await syncAnswerSession(localPlayerRef.current, session, questionSet, null);

    const chestNode = roomRef(`chests/${activeChest.id}`);
    if (chestNode) {
      await update(chestNode, { openedBy: localPlayer.uid, questionCount: 1 });
    }
  }

  async function answerQuestion(optionIndex: number) {
    if (!quiz.session) {
      return;
    }

    const currentQuestion = quiz.questions[quiz.session.questionIndex];

    if (!currentQuestion) {
      return;
    }

    const nextSession = submitQuizAnswer(
      quiz.session,
      optionIndex,
      optionIndex === currentQuestion.correctOptionId,
    );

    setQuiz((previous) => ({
      ...previous,
      session: nextSession,
    }));

    await syncAnswerSession(
      localPlayerRef.current,
      nextSession,
      quiz.questions,
      optionIndex,
      currentQuestion,
    );
  }

  async function closeQuiz() {
    const localPlayer = localPlayerRef.current;

    if (!quiz.session || !localPlayer) {
      return;
    }

    const tier = getQuizTier(quiz.session.correctAnswers);
    const upgraded = applyLootTier(createBaseCombatStatsFromPlayer(localPlayer), tier);
    const nextPlayer: PlayerSnapshot = {
      ...localPlayer,
      papers: Math.max(0, quiz.session.papersRemaining),
      lootTier: Math.max(localPlayer.lootTier, tier) as PlayerSnapshot["lootTier"],
      weaponTier: upgraded.weaponTier as PlayerSnapshot["weaponTier"],
      armorTier: upgraded.armorTier as PlayerSnapshot["armorTier"],
      companionTier: upgraded.companionTier as PlayerSnapshot["companionTier"],
      answering: false,
      answeredCount: localPlayer.answeredCount + quiz.session.answersGiven,
    };

    localPlayerRef.current = nextPlayer;
    setQuiz({ open: false, questions: [], session: null, selectedChest: null });

    const chestNode = roomRef(`chests/${quiz.session.chestId}`);
    if (chestNode) {
      await update(chestNode, {
        claimedTier: Math.max(quiz.selectedChest?.claimedTier ?? 0, tier),
        questionCount: quiz.session.answersGiven,
      });
    }

    await syncLocalPlayer(true);
    await clearAnswerSession(localPlayer.uid);
    await appendFeed(nextPlayer.name, "loot", `tier ${tier}`);
  }

  async function spinWheel() {
    if (!localResult || wheelSpun) {
      return;
    }

    const fairEligibleCount = Object.values(room.results).filter((entry) => entry.fairSpin).length;
    const prizeWon = localResult.survived && localResult.fairSpin && fairEligibleCount <= 2 && Math.random() > 0.5;
    const nextResult: ResultEntry = {
      ...localResult,
      reward: prizeWon ? "milk-tea" : localResult.answeredCount > 0 ? "candies" : "none",
    };

    setLocalResult(nextResult);
    setWheelSpun(true);

    const resultNode = roomRef(`results/${nextResult.uid}`);
    if (resultNode) {
      await update(resultNode, nextResult);
    }
  }

  useEffect(() => {
    if (!quiz.open || !quiz.selectedChest) {
      return;
    }

    if (Date.now() > quiz.selectedChest.expiresAt) {
      closeQuiz().catch(() => {});
    }
    // The expiry check intentionally keys off ticking world time and current quiz state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.open, quiz.selectedChest, world.elapsedMs]);

  async function syncLocalPlayer(force = false) {
    const localPlayer = localPlayerRef.current;
    const currentUid = uidRef.current;
    const now = Date.now();

    if (!localPlayer || !currentUid || mode !== "player") {
      return;
    }

    if (!force && now - lastSyncRef.current < PLAYER_SYNC_MS) {
      return;
    }

    lastSyncRef.current = now;
    const playerNode = roomRef(`players/${currentUid}`);

    if (!playerNode) {
      return;
    }

    await set(playerNode, {
      ...localPlayer,
      uid: currentUid,
      updatedAt: now,
    }).catch(() => {});
  }

  function simulateLocalPlayer(
    current: PlayerSnapshot,
    context: {
      input: InputState;
      elapsedMs: number;
      status: MatchMeta["status"];
      quizOpen: boolean;
    },
  ): PlayerSnapshot {
    if (context.status !== "live") {
      return current;
    }

    if (context.elapsedMs >= GAME_DURATION_MS) {
      return {
        ...current,
        spectating: current.spectating || current.downed,
      };
    }

    const combat = applyLootTier(createBaseCombatStats(), current.lootTier);
    const dashActive = dashStateRef.current.activeUntil > Date.now();
    const moveScale = getPlayerMoveScale({
      downed: current.downed,
      dashActive,
      firing: context.input.firing,
    });
    const delta = 1 / 60;
    const moveLength = Math.hypot(context.input.moveX, context.input.moveY) || 1;
    const velocityX = (context.input.moveX / moveLength) * combat.speed * moveScale;
    const velocityY = (context.input.moveY / moveLength) * combat.speed * moveScale;

    if (current.hp <= 0 && !current.downed) {
      void appendFeed(current.name, "downed", "down");
      return {
        ...current,
        hp: 0,
        downed: true,
        downedAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    if (context.quizOpen) {
      return {
        ...current,
        answering: true,
        vx: 0,
        vy: 0,
        updatedAt: Date.now(),
      };
    }

    return {
      ...current,
      x: clampToArena(current.x + velocityX * delta),
      y: clampToArena(current.y + velocityY * delta),
      vx: velocityX,
      vy: velocityY,
      downedAt: current.downed ? current.downedAt : null,
      spectating: Boolean(
        current.spectating ||
          (current.downed && current.downedAt && Date.now() - current.downedAt >= REVIVE_WINDOW_MS),
      ),
      updatedAt: Date.now(),
    };
  }

  function simulateProjectiles(player: PlayerSnapshot, timestamp: number) {
    const combat = applyLootTier(createBaseCombatStats(), player.lootTier);

    if (!player.downed && !player.answering && inputRef.current.firing && timestamp - lastShotRef.current >= combat.fireRateMs) {
      lastShotRef.current = timestamp;
      const aimLength = Math.hypot(inputRef.current.aimX, inputRef.current.aimY) || 1;
      bulletsRef.current = [
        ...bulletsRef.current,
        {
          id: `${timestamp}`,
          x: player.x,
          y: player.y,
          vx: (inputRef.current.aimX / aimLength) * 380,
          vy: (inputRef.current.aimY / aimLength) * 380,
          ttl: 900,
        },
      ].slice(-40);
    }

    bulletsRef.current = bulletsRef.current
      .map((bullet) => ({
        ...bullet,
        x: bullet.x + bullet.vx / 60,
        y: bullet.y + bullet.vy / 60,
        ttl: bullet.ttl - 16,
      }))
      .filter((bullet) => bullet.ttl > 0);
  }

  function simulateBursts(bursts: Record<string, BurstSnapshot>, players: Record<string, PlayerSnapshot>) {
    const now = Date.now();
    const activePlayers = Object.values(players).filter((entry) => !entry.spectating);

    for (const burst of Object.values(bursts)) {
      if (burst.startedAt > now || spawnedBurstsRef.current.has(burst.id)) {
        continue;
      }

      const plan = buildBurstPlan({
        waveIndex: Number(burst.id.split("-")[1] ?? "1"),
        playerCount: Math.max(1, burst.playerScale),
        seed: burst.seed,
      });

      spawnedBurstsRef.current.add(burst.id);
      zombiesRef.current = [
        ...zombiesRef.current,
        ...plan.zombies.map((zombie) => ({
          ...zombie,
          targetUid: resolveZombieTarget({ x: zombie.x, y: zombie.y, targetUid: null }, activePlayers),
        })),
      ].slice(-48);
    }

    zombiesRef.current = zombiesRef.current
      .map((zombie) => {
        const targetUid = resolveZombieTarget(zombie, activePlayers);
        const target = activePlayers.find((player) => player.uid === targetUid) ?? null;

        if (!target) {
          return zombie;
        }

        const directionX = target.x - zombie.x;
        const directionY = target.y - zombie.y;
        const distance = Math.max(1, Math.hypot(directionX, directionY));
        const safeChestOpen = deriveChestState(roomStateRef.current.chests, Date.now()).some((chest) => {
          const zombieDistance = Math.hypot(zombie.x - chest.x, zombie.y - chest.y);
          return chest.active && zombieDistance <= SAFE_RING_RADIUS;
        });

        if (safeChestOpen) {
          return zombie;
        }

        return {
          ...zombie,
          targetUid,
          x: zombie.x + (directionX / distance) * (zombie.speed / 60),
          y: zombie.y + (directionY / distance) * (zombie.speed / 60),
        };
      })
      .slice(-48);
  }

  function simulateHazards(elapsedMs: number) {
    const localPlayer = localPlayerRef.current;

    if (!localPlayer || localPlayer.answering || localPlayer.spectating) {
      return;
    }

    const gasClouds = buildGasClouds(elapsedMs);
    const meteors = buildMeteors(elapsedMs);
    let nextHp = localPlayer.hp;

    for (const gas of gasClouds) {
      if (Math.hypot(localPlayer.x - gas.x, localPlayer.y - gas.y) <= gas.radius) {
        nextHp -= 0.4;
      }
    }

    for (const meteor of meteors) {
      if (Math.hypot(localPlayer.x - meteor.x, localPlayer.y - meteor.y) <= meteor.radius) {
        nextHp -= 0.9;
      }
    }

    localPlayerRef.current = {
      ...localPlayer,
      hp: Math.max(0, nextHp),
    };
  }

  function resolveCollisions(player: PlayerSnapshot, players: Record<string, PlayerSnapshot>, globalKillCount: number) {
    const combat = applyLootTier(createBaseCombatStats(), player.lootTier);
    let nextPlayer = player;
    const survivingZombies: Zombie[] = [];
    let nextGlobalKills = globalKillCount;

    for (const zombie of zombiesRef.current) {
      let updatedZombie = zombie;

      for (const bullet of bulletsRef.current) {
        if (Math.hypot(bullet.x - zombie.x, bullet.y - zombie.y) <= 26) {
          updatedZombie = { ...updatedZombie, hp: updatedZombie.hp - combat.damage };
        }
      }

      if (updatedZombie.hp <= 0) {
        nextPlayer = { ...nextPlayer, kills: nextPlayer.kills + 1 };
        nextGlobalKills += 1;

        if (rollPaperDrop({ globalKillCount: nextGlobalKills, rngValue: Math.random() })) {
          nextPlayer = { ...nextPlayer, papers: nextPlayer.papers + 1 };
        }

        void appendFeed(nextPlayer.name, "kill", "zombie");
        continue;
      }

      if (!player.answering && !player.downed && Math.hypot(player.x - updatedZombie.x, player.y - updatedZombie.y) <= 30) {
        nextPlayer = {
          ...nextPlayer,
          hp: Math.max(0, nextPlayer.hp - updatedZombie.damage * (1 - combat.armorMitigation) * 0.04),
        };
      }

      survivingZombies.push(updatedZombie);
    }

    zombiesRef.current = survivingZombies;
    localPlayerRef.current = nextPlayer;

    const globalKillsNode = roomRef("meta/globalKillCount");
    if (globalKillsNode && nextGlobalKills !== globalKillCount) {
      runTransaction(globalKillsNode, () => nextGlobalKills).catch(() => {});
    }

    if (inputRef.current.reviveHolding) {
      const downedTarget = Object.values(players).find((candidate) => candidate.uid !== player.uid && candidate.downed && !candidate.spectating && Math.hypot(player.x - candidate.x, player.y - candidate.y) <= 54);

      if (downedTarget) {
        if (reviveStateRef.current.targetUid !== downedTarget.uid) {
          reviveStateRef.current = { targetUid: downedTarget.uid, startedAt: Date.now() };
        }

        if (Date.now() - reviveStateRef.current.startedAt >= REVIVE_HOLD_MS) {
          const targetNode = roomRef(`players/${downedTarget.uid}`);
          if (targetNode) {
            update(targetNode, {
              hp: 50,
              downed: false,
              downedAt: null,
              spectating: false,
              updatedAt: Date.now(),
            }).catch(() => {});
          }
          void appendFeed(player.name, "revive", downedTarget.name);
          reviveStateRef.current = { targetUid: null, startedAt: 0 };
        }
      } else {
        reviveStateRef.current = { targetUid: null, startedAt: 0 };
      }
    } else {
      reviveStateRef.current = { targetUid: null, startedAt: 0 };
    }
  }

  async function appendFeed(actor: string, kind: FeedItem["kind"], detail: string) {
    const feedNode = roomRef("feed");

    if (!feedNode) {
      return;
    }

    await set(push(feedNode), {
      actor,
      kind,
      detail,
      createdAt: Date.now(),
    });
  }

  function maybeEndMatch() {
    if (endCommittedRef.current) {
      return;
    }

    endCommittedRef.current = true;
    const metaNode = roomRef("meta");

    if (!metaNode) {
      return;
    }

    update(metaNode, {
      status: "ended",
      endedAt: Date.now(),
    }).catch(() => {
      endCommittedRef.current = false;
    });
  }

  function maybeCommitResult(player: PlayerSnapshot, elapsedMs: number) {
    if (resultCommittedRef.current || elapsedMs < GAME_DURATION_MS) {
      return;
    }

    resultCommittedRef.current = true;
    const survivorsAhead = Object.values(roomStateRef.current.results).length;
    const result: ResultEntry = {
      uid: player.uid,
      name: player.name,
      survived: !player.spectating && !player.downed && player.hp > 0,
      answeredCount: player.answeredCount,
      reward: player.answeredCount > 0 ? "candies" : "none",
      fairSpin: survivorsAhead < 2,
      createdAt: Date.now(),
    };

    setLocalResult(result);
    const resultNode = roomRef(`results/${player.uid}`);
    if (resultNode) {
      set(resultNode, result).catch(() => {});
    }
  }

  return {
    activeChest,
    activeSessions,
    advanceRound,
    answerQuestion,
    canHost,
    closeQuiz,
    dash,
    error,
    feedItems,
    hasFirebaseConfig: hasFirebaseConfig(),
    isGameEnded,
    isGameLive,
    joined,
    joinMatch,
    localResult,
    mode,
    openChest,
    playerName,
    quiz,
    resetMatch,
    room,
    setAim,
    setMovement,
    setPlayerName,
    setReviveHolding,
    spinWheel,
    startMatch,
    statusMessage,
    stopAim,
    topKillers,
    uid,
    wheelSpun,
    world,
  };
}

async function clearAnswerSession(uid: string) {
  const sessionNode = roomRef(`sessions/${uid}`);

  if (!sessionNode) {
    return;
  }

  await remove(sessionNode).catch(() => {});
}

async function syncAnswerSession(
  player: PlayerSnapshot | null,
  session: QuizSession,
  questions: Question[],
  selectedOptionId: number | null,
  fallbackQuestion?: Question,
) {
  if (!player) {
    return;
  }

  const currentQuestion = questions[session.questionIndex] ?? fallbackQuestion;

  if (!currentQuestion) {
    await clearAnswerSession(player.uid);
    return;
  }

  const sessionNode = roomRef(`sessions/${player.uid}`);

  if (!sessionNode) {
    return;
  }

  const liveSession: ActiveAnswerSession = {
    uid: player.uid,
    playerName: player.name,
    avatar: player.avatar,
    chestId: session.chestId,
    questionId: currentQuestion.id,
    question: currentQuestion.question,
    options: currentQuestion.options,
    selectedOptionId,
    answersGiven: session.answersGiven,
    correctAnswers: session.correctAnswers,
    papersRemaining: session.papersRemaining,
    updatedAt: Date.now(),
  };

  await set(sessionNode, liveSession).catch(() => {});
}

function interpolatePlayers(
  players: Record<string, PlayerSnapshot>,
  excludedUid: string | null,
  mode: GameMode,
) {
  return Object.values(players)
    .filter((entry) => mode !== "player" || entry.uid !== excludedUid)
    .map((entry) => ({
      ...entry,
      x: entry.x + entry.vx * 0.04,
      y: entry.y + entry.vy * 0.04,
    }));
}

function deriveChestState(chests: Record<string, ChestSnapshot>, nowMs: number): ChestSnapshot[] {
  return Object.values(chests).map((chest) => ({
    ...chest,
    active: nowMs >= chest.spawnedAt && nowMs <= chest.expiresAt,
  }));
}

function buildGasClouds(elapsedMs: number): GasCloud[] {
  return CATASTROPHE_EVENTS.filter((event) => event.kind === "gas" && elapsedMs >= event.atMs && elapsedMs <= event.atMs + (event.durationMs ?? 0)).map((event, index) => ({
    id: `${event.id}-${index}`,
    x: 260 + (index % 4) * 320,
    y: 240 + (index % 3) * 360,
    radius: 120,
  }));
}

function buildMeteors(elapsedMs: number): Meteor[] {
  return CATASTROPHE_EVENTS.filter((event) => event.kind === "meteor" && elapsedMs >= event.atMs && elapsedMs <= event.atMs + (event.durationMs ?? 0)).map((event, index) => ({
    id: `${event.id}-${index}`,
    x: 180 + (index % 5) * 250,
    y: 180 + (index % 4) * 270,
    radius: 74,
  }));
}

function createBaseCombatStatsFromPlayer(player: PlayerSnapshot) {
  const base = createBaseCombatStats();

  return {
    ...base,
    weaponTier: player.weaponTier,
    armorTier: player.armorTier,
    companionTier: player.companionTier,
  };
}
