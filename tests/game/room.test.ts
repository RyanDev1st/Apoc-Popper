import {
  createPlayerSnapshot,
  normalizeRoomSnapshot,
  splitPlayers,
} from "@/lib/game/room";

describe("room snapshot normalization", () => {
  it("replaces stale embedded player ids with the realtime record key", () => {
    const room = normalizeRoomSnapshot({
      players: {
        "firebase-uid": {
          uid: "local-preview",
          name: "Mai",
          hp: 82,
        },
      },
    });

    expect(room.players["firebase-uid"]?.uid).toBe("firebase-uid");
    expect(room.players["firebase-uid"]?.avatar).toBe("MA");
  });

  it("hydrates feed ids from their database keys", () => {
    const room = normalizeRoomSnapshot({
      feed: {
        "feed-1": {
          actor: "Mai",
          kind: "loot",
          detail: "tier 2",
          createdAt: 12,
        },
      },
    });

    expect(room.feed["feed-1"]).toMatchObject({
      id: "feed-1",
      actor: "Mai",
      kind: "loot",
    });
  });

  it("splits the local player from remote players using the normalized uid", () => {
    const local = createPlayerSnapshot({ uid: "local-1", name: "Mai", now: 1 });
    const remote = createPlayerSnapshot({ uid: "remote-1", name: "Byte", now: 1 });
    const split = splitPlayers(
      {
        [local.uid]: local,
        [remote.uid]: remote,
      },
      "local-1",
    );

    expect(split.localPlayer?.uid).toBe("local-1");
    expect(split.remotePlayers.map((player) => player.uid)).toEqual(["remote-1"]);
  });
});
