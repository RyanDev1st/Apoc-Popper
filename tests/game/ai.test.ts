import {
  getPlayerMoveScale,
  resolveZombieTarget,
} from "@/lib/game/ai";

describe("game ai helpers", () => {
  it("slows firing movement and boosts dash movement", () => {
    expect(getPlayerMoveScale({ downed: false, dashActive: false, firing: false })).toBe(1);
    expect(getPlayerMoveScale({ downed: false, dashActive: false, firing: true })).toBeLessThan(1);
    expect(getPlayerMoveScale({ downed: false, dashActive: true, firing: true })).toBe(2.4);
    expect(getPlayerMoveScale({ downed: true, dashActive: false, firing: false })).toBe(0.38);
  });

  it("keeps a zombie locked on its original target while that player is still active", () => {
    const players = [
      { uid: "near", x: 100, y: 100, spectating: false },
      { uid: "far", x: 400, y: 400, spectating: false },
    ];

    expect(resolveZombieTarget({ x: 0, y: 0, targetUid: null }, players)).toBe("near");
    expect(resolveZombieTarget({ x: 0, y: 0, targetUid: "far" }, players)).toBe("far");
  });
});
