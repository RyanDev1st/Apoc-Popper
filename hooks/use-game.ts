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
import { buildQuizSession, getQuizTier, submitQuizAnswer, isQuizOutOfQuestions, type QuizSession } from "@/lib/game/quiz";
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
    const seed = `${activeChest.id}-${uid}`;
    const questions = getRandomQuestionSet(seed, 6);
    const session = buildQuizSession({
      chestId: activeChest.id,
      papers: localPlayerRef.current?.papers ?? 0,
      questionIds: questions.map((q) => q.id),
    });
    quizOpenRef.current = true;
    setQuiz({ open: true, questions, session, selectedChest: activeChest });
  }, [activeChest, uid]);

  const answerQuestion = useCallback((optionId: number) => {
    setQuiz((prev) => {
      if (!prev.session) return prev;
      const currentQuestion = prev.questions[prev.session.questionIndex];
      const isCorrect = currentQuestion?.correctOptionId === optionId;
      const next = submitQuizAnswer(prev.session, optionId, isCorrect);
      const ch = channelRef.current;
      if (ch) {
        const sessionPayload: ActiveAnswerSession = {
          uid,
          playerName,
          avatar: localPlayerRef.current?.avatar ?? "",
          chestId: prev.selectedChest?.id ?? "",
          questionId: currentQuestion?.id ?? "",
          question: currentQuestion?.question ?? "",
          options: currentQuestion?.options ?? ["", "", "", ""],
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
      const tier = getQuizTier(prev.session.correctAnswers);
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
