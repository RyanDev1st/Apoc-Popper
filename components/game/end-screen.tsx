"use client";

import type { ResultEntry } from "@/lib/game/types";

type EndScreenProps = {
  open: boolean;
  result: ResultEntry | null;
  wheelSpun: boolean;
  onSpin: () => void;
};

const REWARDS = ["MILK TEA", "CANDIES", "MYSTERY BOX", "BONUS ROUND"];

export function EndScreen({ open, result, wheelSpun, onSpin }: EndScreenProps) {
  if (!open) return null;

  const prize = wheelSpun && result
    ? REWARDS[result.answeredCount % REWARDS.length]
    : null;

  return (
    <div className="end-overlay">
      <div className="end-card panel">
        <p className="end-title">{result?.survived ? "SURVIVED" : "DOWNED"}</p>
        {result && (
          <>
            <div className="end-stat"><span>ANSWERED</span><span>{result.answeredCount}</span></div>
            <div className="end-stat"><span>STATUS</span><span>{result.survived ? "ALIVE" : "DOWNED"}</span></div>
          </>
        )}
        <div className="wheel-card panel">
          {!wheelSpun ? (
            <>
              <p className="reward-pool">SPIN FOR REWARD</p>
              <button className="btn btn-primary" onClick={onSpin}>SPIN WHEEL</button>
            </>
          ) : (
            <p className="reward-pool">REWARD: {prize}</p>
          )}
        </div>
      </div>
    </div>
  );
}
