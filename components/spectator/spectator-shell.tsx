"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PhaserCanvas } from "@/components/game/phaser-canvas";
import { AnswerSessionsPanel } from "@/components/spectator/answer-sessions-panel";
import { useQuizSurvivorsGame } from "@/hooks/use-quiz-survivors-game";

type SpectatorShellProps = {
  hostAccessEnabled?: boolean;
};

export function SpectatorShell({ hostAccessEnabled = false }: SpectatorShellProps) {
  const game = useQuizSurvivorsGame("spectator", { hostAccessEnabled });
  const [selectedChestId, setSelectedChestId] = useState<string | null>(null);
  const answering = useMemo(() => game.activeSessions, [game.activeSessions]);
  const players = Object.values(game.room.players).sort((left, right) => right.kills - left.kills);
  const timeLeft = Math.max(0, 360 - Math.floor(game.world.elapsedMs / 1000));
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  return (
    <main className="arena-page spectator-page">
      <section className="arena-frame spectator-frame">
        <PhaserCanvas world={game.world} viewMode="spectator" selectedChestId={selectedChestId} />

        <div className="top-hud spectator-top">
          <div className="hud-cluster">
            <div className="hud-tile hud-time">
              <span className="hud-label">Time</span>
              <strong>{minutes}:{seconds}</strong>
            </div>
            <div className="hud-tile">
              <span className="hud-label">Status</span>
              <strong>{game.room.meta.status}</strong>
            </div>
            <div className="hud-tile">
              <span className="hud-label">Players</span>
              <strong>{players.length}</strong>
            </div>
            <div className="hud-tile">
              <span className="hud-label">Answering</span>
              <strong>{answering.length}</strong>
            </div>
          </div>

          <div className="hud-side">
            <Link className="ghost-link" href="/">
              play
            </Link>
          </div>
        </div>

        <aside className="spectator-rail">
          <div className="rail-card">
            <p className="eyebrow">Chest Filter</p>
            <div className="chip-row">
              <button className={`chip ${selectedChestId === null ? "active" : ""}`} onClick={() => setSelectedChestId(null)}>
                all
              </button>
              {game.world.chests.map((chest) => (
                <button
                  key={chest.id}
                  className={`chip ${selectedChestId === chest.id ? "active" : ""}`}
                  onClick={() => setSelectedChestId((current) => (current === chest.id ? null : chest.id))}
                >
                  {chest.id.replace("chest-", "c")}
                </button>
              ))}
            </div>
          </div>

          <AnswerSessionsPanel sessions={answering} selectedChestId={selectedChestId} />

          <div className="rail-card">
            <p className="eyebrow">Players</p>
            <ul className="player-list">
              {players.map((player) => (
                <li key={player.uid} className={`player-row ${player.downed ? "downed" : ""}`}>
                  <span>{player.name}</span>
                  <span>{Math.max(0, Math.round(player.hp))}hp</span>
                  <span>{player.kills}k</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rail-card">
            <p className="eyebrow">Feed</p>
            <ul className="feed-list">
              {game.feedItems.map((item) => (
                <li key={item.id}>
                  <strong>{item.actor}</strong> {item.detail}
                </li>
              ))}
            </ul>
          </div>

          {game.canHost ? (
            <div className="rail-card host-card">
              <p className="eyebrow">Host</p>
              <div className="host-actions">
                <button className="action-button primary" onClick={game.startMatch}>Start</button>
                <button className="action-button" onClick={game.resetMatch}>Reset</button>
                <button className="action-button" onClick={game.advanceRound}>Next</button>
              </div>
            </div>
          ) : (
            <div className="rail-card">
              <p className="eyebrow">Host</p>
              <p className="rail-copy">Open the private host link for controls.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
