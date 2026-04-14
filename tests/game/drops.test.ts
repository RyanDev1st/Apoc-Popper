import { rollPaperDrop } from "@/lib/game/drops";

describe("paper drops", () => {
  it("awards the pity drop every fifth global kill", () => {
    expect(rollPaperDrop({ globalKillCount: 5, rngValue: 0.99 })).toBe(true);
    expect(rollPaperDrop({ globalKillCount: 10, rngValue: 0.99 })).toBe(true);
  });

  it("uses the 30 percent baseline chance between pity triggers", () => {
    expect(rollPaperDrop({ globalKillCount: 3, rngValue: 0.2 })).toBe(true);
    expect(rollPaperDrop({ globalKillCount: 3, rngValue: 0.31 })).toBe(false);
  });
});
