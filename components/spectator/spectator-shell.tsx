"use client";

import { useGame } from "@/hooks/use-game";
import { PhaserCanvas } from "@/components/game/phaser-canvas";
import { PlayerChips } from "@/components/spectator/player-chips";

export function SpectatorShell() {
  const game = useGame("spectator");
  const allPlayers = [
    ...(game.world.localPlayer ? [game.world.localPlayer] : []),
    ...game.world.remotePlayers,
  ];

  return (
    <main className="arena-page">
      <div className="arena-frame">
        <PhaserCanvas world={game.world} viewMode="spectator" />
        <PlayerChips players={allPlayers} />
      </div>
    </main>
  );
}
