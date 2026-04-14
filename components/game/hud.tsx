"use client";

import type { WorldState } from "@/hooks/use-game";

type HudProps = {
  world: WorldState;
  statusMessage: string;
};

export function Hud({ world, statusMessage }: HudProps) {
  const player = world.localPlayer;
  const elapsed = world.elapsedMs;
  const timeLeft = Math.max(0, 360 - Math.floor(elapsed / 1000));
  const mm = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const ss = (timeLeft % 60).toString().padStart(2, "0");
  const hpPct = player ? Math.max(0, Math.min(100, (player.hp / Math.max(1, player.maxHp)) * 100)) : 0;

  return (
    <div className="top-hud">
      <div className="hud-bar">
        {player && (
          <div className="hud-tile panel">
            <span className="hud-label">HP</span>
            <div className="hp-bar-track"><div className="hp-bar-fill" style={{ width: `${hpPct}%` }} /></div>
            <span className="hud-value">{Math.max(0, Math.round(player.hp))}</span>
          </div>
        )}
        <div className="hud-tile panel">
          <span className="hud-label">TIME</span>
          <span className="hud-value accent">{mm}:{ss}</span>
        </div>
        {player && (
          <>
            <div className="hud-tile panel">
              <span className="hud-label">PAPER</span>
              <span className="hud-value positive">{player.papers}</span>
            </div>
            <div className="hud-tile panel">
              <span className="hud-label">TIER</span>
              <span className="hud-value accent">T{player.lootTier}</span>
            </div>
          </>
        )}
      </div>
      <div className="status-tag panel">{statusMessage}</div>
    </div>
  );
}
