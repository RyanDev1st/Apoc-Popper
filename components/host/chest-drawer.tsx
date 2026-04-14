"use client";

import type { ActiveAnswerSession } from "@/lib/game/types";

type ChestDrawerProps = {
  chestId: string | null;
  sessions: Record<string, ActiveAnswerSession>;
  onClose: () => void;
};

const LABELS = ["A", "B", "C", "D"];

export function ChestDrawer({ chestId, sessions, onClose }: ChestDrawerProps) {
  if (!chestId) return null;

  const chestSessions = Object.values(sessions).filter((s) => s.chestId === chestId);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-panel panel">
        <p className="drawer-title">CHEST {chestId.replace("chest-", "")} — LIVE ANSWERS</p>
        {chestSessions.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: "0.65rem" }}>NO ACTIVE SESSIONS</p>
        )}
        {chestSessions.map((s) => (
          <div key={s.uid} className="session-card panel">
            <p className="session-name">{s.playerName} — {s.correctAnswers}/{s.answersGiven} CORRECT</p>
            <p className="session-question">{s.question}</p>
            <div className="session-options">
              {s.options.map((opt, i) => (
                <div
                  key={i}
                  className={`session-option${s.selectedOptionId === i ? " selected" : ""}`}
                >
                  <span>{LABELS[i]}</span> {opt}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
