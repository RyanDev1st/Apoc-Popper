"use client";

import { useMemo, useState } from "react";
import type { ActiveAnswerSession } from "@/lib/game/types";
import {
  filterAnswerSessionsByChest,
  resolveExpandedSession,
} from "@/lib/spectator/answer-sessions";

type AnswerSessionsPanelProps = {
  sessions: ActiveAnswerSession[];
  selectedChestId?: string | null;
};

export function AnswerSessionsPanel({ sessions, selectedChestId }: AnswerSessionsPanelProps) {
  const [expandedUid, setExpandedUid] = useState<string | null>(sessions[0]?.uid ?? null);
  const visibleSessions = useMemo(
    () => filterAnswerSessionsByChest(sessions, selectedChestId),
    [selectedChestId, sessions],
  );
  const expandedSession = resolveExpandedSession(visibleSessions, expandedUid);

  if (!visibleSessions.length) {
    return (
      <div className="rail-card">
        <p className="eyebrow">Questions</p>
        <p className="rail-copy">No live answer now.</p>
      </div>
    );
  }

  return (
    <div className="rail-card answer-panel">
      <p className="eyebrow">Questions</p>

      <div className="session-card-list">
        {visibleSessions.map((session) => (
          <button
            key={session.uid}
            type="button"
            className={`session-card ${expandedSession?.uid === session.uid ? "active" : ""}`}
            onClick={() => setExpandedUid(session.uid)}
          >
            <span className="session-avatar">{session.avatar}</span>
            <span className="session-copy">
              <strong>{session.playerName}</strong>
              <span>{session.question}</span>
            </span>
          </button>
        ))}
      </div>

      {expandedSession ? (
        <div className="session-detail">
          <div className="chip-row compact">
            <span className="chip static">ok {expandedSession.correctAnswers}</span>
            <span className="chip static">done {expandedSession.answersGiven}</span>
            <span className="chip static">papers {expandedSession.papersRemaining}</span>
          </div>

          <div className="session-option-list">
            {expandedSession.options.map((option, index) => (
              <div
                key={`${expandedSession.uid}-${option}`}
                className={`session-option ${expandedSession.selectedOptionId === index ? "selected" : ""}`}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                <strong>{option}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
