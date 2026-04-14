"use client";

import type { PlayerSnapshot } from "@/lib/game/types";

type HudProps = {
  player: PlayerSnapshot | null;
  elapsedMs: number;
  isLive: boolean;
  statusMessage: string;
};

export function Hud({ player, elapsedMs, isLive, statusMessage }: HudProps) {
  const timeLeft = Math.max(0, 360 - Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  return (
    <section className="hud-shell">
      <div className="hud-card">
        <span className="hud-label">Timer</span>
        <strong className="hud-value">{minutes}:{seconds}</strong>
      </div>
      <div className="hud-card">
        <span className="hud-label">Health</span>
        <strong className="hud-value">{Math.max(0, Math.round(player?.hp ?? 100))}</strong>
      </div>
      <div className="hud-card">
        <span className="hud-label">Papers</span>
        <strong className="hud-value">{player?.papers ?? 0}</strong>
      </div>
      <div className="hud-card">
        <span className="hud-label">Level</span>
        <strong className="hud-value">T{player?.lootTier ?? 0}</strong>
      </div>
      <div className="hud-card hud-status">
        <span className="hud-label">{isLive ? "Live" : "Status"}</span>
        <strong className="hud-value hud-message">{statusMessage}</strong>
      </div>
    </section>
  );
}

