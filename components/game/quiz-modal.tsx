"use client";

import type { Question } from "@/lib/game/types";
import type { QuizSession } from "@/lib/game/quiz";

type QuizModalProps = {
  open: boolean;
  questions: Question[];
  session: QuizSession | null;
  onAnswer: (index: number) => void;
  onDone: () => void;
};

export function QuizModal({ open, questions, session, onAnswer, onDone }: QuizModalProps) {
  if (!open || !session) {
    return null;
  }

  const currentQuestion = questions[session.questionIndex];
  const tier = session.correctAnswers >= 5 ? 3 : session.correctAnswers >= 3 ? 2 : session.correctAnswers >= 1 ? 1 : 0;
  const locked = !currentQuestion;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel compact-modal">
        <p className="eyebrow">Chest</p>
        <h2>{currentQuestion?.question ?? "Lock loot"}</h2>
        <div className="meter-strip">
          <div className="meter">
            <span>Tier</span>
            <strong>{tier}</strong>
          </div>
          <div className="meter">
            <span>Correct</span>
            <strong>{session.correctAnswers}</strong>
          </div>
          <div className="meter">
            <span>Papers</span>
            <strong>{session.papersRemaining}</strong>
          </div>
        </div>
        {!locked ? <div className="answers-grid">
          {currentQuestion?.options.map((option, index) => (
            <button key={option} className="answer-button" onClick={() => onAnswer(index)}>
              <span>{String.fromCharCode(65 + index)}</span>
              {option}
            </button>
          ))}
        </div> : null}
        <button className="close-button" onClick={onDone}>
          Equip Loot
        </button>
      </div>
    </div>
  );
}

