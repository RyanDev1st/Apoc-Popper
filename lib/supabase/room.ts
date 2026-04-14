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
