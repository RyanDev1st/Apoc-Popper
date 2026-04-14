"use client";

import Link from "next/link";
import { useGame } from "@/hooks/use-game";
import { PhaserCanvas } from "@/components/game/phaser-canvas";
import { Hud } from "@/components/game/hud";
import { ActionDock } from "@/components/game/action-dock";
import { VirtualStick } from "@/components/game/virtual-stick";
import { QuizModal } from "@/components/game/quiz-modal";
import { EndScreen } from "@/components/game/end-screen";

export function GameShell() {
  const game = useGame("player");

  if (!game.joined) {
    return (
      <main className="arena-page">
        <div className="join-screen">
          <div className="join-card panel">
            <p className="join-title">QUIZ SURVIVORS</p>
            <p className="join-sub">6:00 run. Host starts it.</p>
            <input
              className="name-input"
              value={game.playerName}
              onChange={(e) => game.setPlayerName(e.target.value)}
              maxLength={18}
              placeholder="ENTER NAME"
            />
            <button
              className="btn btn-primary"
              onClick={game.joinMatch}
              disabled={!game.hasSupabaseConfig}
            >
              {game.hasSupabaseConfig ? "PLAY" : "LOADING"}
            </button>
            <div className="join-hint">
              <span>WASD MOVE</span>
              <span>MOUSE AIM</span>
              <span>CLICK FIRE</span>
              <span>SPACE DASH</span>
            </div>
            {!game.hasSupabaseConfig && <p className="warning">MISSING SUPABASE ENV</p>}
            {game.error && <p className="warning">{game.error}</p>}
            <Link className="btn" href="/spectator">SPECTATOR</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="arena-page">
      <div className="arena-frame">
        <PhaserCanvas
          world={game.world}
          viewMode="player"
          onMove={game.setMovement}
          onAim={game.setAim}
          onStopAim={game.stopAim}
        />
        <Hud world={game.world} statusMessage={game.statusMessage} />
        <ActionDock
          onDash={game.dash}
          onReviveStart={() => game.setReviveHolding(true)}
          onReviveEnd={() => game.setReviveHolding(false)}
          onOpenChest={game.openChest}
          chestAvailable={Boolean(game.activeChest)}
        />
        <div className="mobile-sticks">
          <VirtualStick label="MOVE" onVector={game.setMovement} />
          <VirtualStick label="AIM" onVector={(x, y) => game.setAim(x, y, true)} onEnd={game.stopAim} />
        </div>
      </div>
      <QuizModal
        open={game.quiz.open}
        questions={game.quiz.questions}
        session={game.quiz.session}
        onAnswer={game.answerQuestion}
        onDone={game.closeQuiz}
      />
      <EndScreen
        open={game.isGameEnded}
        result={game.localResult}
        wheelSpun={game.wheelSpun}
        onSpin={game.spinWheel}
      />
    </main>
  );
}
