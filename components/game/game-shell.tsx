"use client";

import Link from "next/link";
import { EndScreen } from "@/components/game/end-screen";
import { PhaserCanvas } from "@/components/game/phaser-canvas";
import { QuizModal } from "@/components/game/quiz-modal";
import { VirtualStick } from "@/components/game/virtual-stick";
import { useQuizSurvivorsGame } from "@/hooks/use-quiz-survivors-game";

export function GameShell() {
  const game = useQuizSurvivorsGame("player");
  const player = game.world.localPlayer;
  const timeLeft = Math.max(0, 360 - Math.floor(game.world.elapsedMs / 1000));
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");
  const readyToJoin = game.hasFirebaseConfig && Boolean(game.uid);

  return (
    <main className="arena-page">
      {!game.joined ? (
        <section className="join-screen">
          <div className="join-grid">
            <div className="join-card">
              <p className="eyebrow">Quiz Survivors</p>
              <h1>Enter Arena</h1>
              <p className="join-copy">6:00 run. Host starts it.</p>
              <input
                className="name-input"
                value={game.playerName}
                onChange={(event) => game.setPlayerName(event.target.value)}
                maxLength={18}
                placeholder="name"
              />
              <button className="action-button primary" onClick={game.joinMatch} disabled={!readyToJoin}>
                {readyToJoin ? "Play" : "Loading"}
              </button>
              <div className="join-meta">
                <span>Move: `WASD`</span>
                <span>Aim: mouse</span>
                <span>Dash: tap</span>
              </div>
              {!game.hasFirebaseConfig ? <p className="warning-copy">Missing Firebase env.</p> : null}
              {game.error ? <p className="warning-copy">{game.error}</p> : null}
            </div>

            <div className="join-preview">
              <div className="preview-badge">pixelated</div>
              <div className="preview-stack">
                <div className="preview-strip">waves</div>
                <div className="preview-strip">chests</div>
                <div className="preview-strip">meteors</div>
                <div className="preview-strip">gas</div>
              </div>
              <Link className="ghost-link" href="/spectator">
                spectator
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="arena-frame">
          <PhaserCanvas
            world={game.world}
            viewMode="player"
            onMove={game.setMovement}
            onAim={game.setAim}
            onStopAim={game.stopAim}
          />

          <div className="top-hud">
            <div className="hud-cluster">
              <div className="hud-tile hud-time">
                <span className="hud-label">Time</span>
                <strong>{minutes}:{seconds}</strong>
              </div>
              <div className="hud-tile">
                <span className="hud-label">HP</span>
                <strong>{Math.max(0, Math.round(player?.hp ?? 0))}</strong>
                <span className="hud-bar"><i style={{ width: `${Math.max(0, Math.min(100, ((player?.hp ?? 0) / Math.max(1, player?.maxHp ?? 100)) * 100))}%` }} /></span>
              </div>
              <div className="hud-tile">
                <span className="hud-label">Papers</span>
                <strong>{player?.papers ?? 0}</strong>
              </div>
              <div className="hud-tile">
                <span className="hud-label">Tier</span>
                <strong>T{player?.lootTier ?? 0}</strong>
              </div>
            </div>

            <div className="hud-side">
              <div className="status-pill">{game.statusMessage}</div>
              <Link className="ghost-link" href="/spectator">
                spectator
              </Link>
            </div>
          </div>

          <div className="action-dock">
            <button className="action-button primary" onClick={game.dash}>
              Dash
            </button>
            <button
              className="action-button"
              onMouseDown={() => game.setReviveHolding(true)}
              onMouseUp={() => game.setReviveHolding(false)}
              onMouseLeave={() => game.setReviveHolding(false)}
              onTouchStart={() => game.setReviveHolding(true)}
              onTouchEnd={() => game.setReviveHolding(false)}
            >
              Hold Revive
            </button>
            <button className="action-button" onClick={game.openChest} disabled={!game.activeChest}>
              {game.activeChest ? "Open Chest" : "Find Chest"}
            </button>
          </div>

          <div className="mobile-sticks">
            <VirtualStick label="Move" onVector={game.setMovement} />
            <VirtualStick label="Aim" onVector={(x, y) => game.setAim(x, y, true)} onEnd={game.stopAim} />
          </div>
        </section>
      )}

      <QuizModal
        open={game.quiz.open}
        questions={game.quiz.questions}
        session={game.quiz.session}
        onAnswer={game.answerQuestion}
        onDone={game.closeQuiz}
      />
      <EndScreen open={game.isGameEnded} result={game.localResult} wheelSpun={game.wheelSpun} onSpin={game.spinWheel} />
    </main>
  );
}
