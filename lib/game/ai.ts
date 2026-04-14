type TargetablePlayer = {
  uid: string;
  x: number;
  y: number;
  spectating: boolean;
};

type ZombieTargetInput = {
  x: number;
  y: number;
  targetUid: string | null;
};

export function getPlayerMoveScale(input: {
  downed: boolean;
  dashActive: boolean;
  firing: boolean;
}): number {
  if (input.downed) {
    return 0.38;
  }

  if (input.dashActive) {
    return 2.4;
  }

  return input.firing ? 0.72 : 1;
}

export function resolveZombieTarget(
  zombie: ZombieTargetInput,
  players: TargetablePlayer[],
): string | null {
  if (zombie.targetUid) {
    const lockedTarget = players.find((player) => player.uid === zombie.targetUid && !player.spectating);
    if (lockedTarget) {
      return lockedTarget.uid;
    }
  }

  return (
    players
      .filter((player) => !player.spectating)
      .reduce<TargetablePlayer | null>((closest, player) => {
        if (!closest) {
          return player;
        }

        const closestDistance = Math.hypot(closest.x - zombie.x, closest.y - zombie.y);
        const candidateDistance = Math.hypot(player.x - zombie.x, player.y - zombie.y);
        return candidateDistance < closestDistance ? player : closest;
      }, null)
      ?.uid ?? null
  );
}
