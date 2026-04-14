export function rollPaperDrop(input: { globalKillCount: number; rngValue: number }): boolean {
  if (input.globalKillCount > 0 && input.globalKillCount % 5 === 0) {
    return true;
  }

  return input.rngValue <= 0.3;
}

