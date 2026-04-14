"use client";

import type { ResultEntry } from "@/lib/game/types";

type EndScreenProps = {
  open: boolean;
  result: ResultEntry | null;
  wheelSpun: boolean;
  onSpin: () => void;
};

export function EndScreen({ open, result, wheelSpun, onSpin }: EndScreenProps) {
  if (!open || !result) {
    return null;
  }

  const canSpin = result.survived && !wheelSpun;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel end-panel compact-modal">
        <p className="eyebrow">Result</p>
        <h2>{result.survived ? "Made it to 6:00" : "Run over"}</h2>
        <div className="meter-strip">
          <div className="meter">
            <span>Spin</span>
            <strong>{result.fairSpin ? "open" : "closed"}</strong>
          </div>
          <div className="meter">
            <span>Answers</span>
            <strong>{result.answeredCount}</strong>
          </div>
          <div className="meter">
            <span>Reward</span>
            <strong>{result.reward}</strong>
          </div>
        </div>
        <div className="wheel-card">
          <div className="fake-pool">Lucky wheel</div>
          <div className="reward-strip">
            <span>Top prize</span>
            <strong>Milk Tea x2</strong>
          </div>
        </div>
        {canSpin ? (
          <button className="answer-button" onClick={onSpin}>
            Spin
          </button>
        ) : null}
        {!result.survived && result.answeredCount > 0 ? <p className="consolation-copy">Candies unlocked.</p> : null}
      </div>
    </div>
  );
}
