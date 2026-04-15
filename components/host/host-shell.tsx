"use client";

import { useState } from "react";
import { useGame } from "@/hooks/use-game";
import { PhaserCanvas } from "@/components/game/phaser-canvas";
import { PlayerSidebar } from "@/components/host/player-sidebar";
import { TimelineBar } from "@/components/host/timeline-bar";
import { ChestDrawer } from "@/components/host/chest-drawer";

type HostShellProps = { hostAccessEnabled: boolean };

export function HostShell({ hostAccessEnabled }: HostShellProps) {
  const game = useGame("spectator", { hostAccessEnabled });
  const [openChestId, setOpenChestId] = useState<string | null>(null);
  const players = Object.values(game.room.players);

  function handleChestClick(chestId: string) {
    setOpenChestId((prev) => (prev === chestId ? null : chestId));
  }

  if (!hostAccessEnabled) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", gap: 16 }}>
        <div className="panel" style={{ padding: "28px 24px", display: "grid", gap: 12, textAlign: "center" }}>
          <p style={{ color: "var(--danger)", fontSize: "0.8rem" }}>INVALID HOST TOKEN</p>
          <p style={{ color: "var(--muted)", fontSize: "0.65rem" }}>Visit /host/[HOST_ACCESS_TOKEN] from your .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className="host-layout">
      <div className="host-arena">
        <PhaserCanvas
          world={game.world}
          viewMode="spectator"
          onAim={(x, y) => {
            // map click to chest — check if near any chest
            const chest = game.world.chests.find((c) => Math.hypot(c.x - x, c.y - y) < 80);
            if (chest) handleChestClick(chest.id);
          }}
        />
        <ChestDrawer
          chestId={openChestId}
          sessions={game.room.sessions}
          onClose={() => setOpenChestId(null)}
        />
      </div>
      <PlayerSidebar players={players} />
      <TimelineBar
        elapsedMs={game.world.elapsedMs}
        meta={game.room.meta}
        onStart={game.startMatch}
        onReset={game.resetMatch}
        canHost={game.canHost}
      />
    </div>
  );
}
