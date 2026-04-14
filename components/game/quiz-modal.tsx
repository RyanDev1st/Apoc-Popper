"use client";

import type { Question } from "@/lib/game/questions";
import type { QuizSession } from "@/lib/game/quiz";

type QuizModalProps = {
  open: boolean;
  questions: Question[];
  session: QuizSession | null;
  onAnswer: (optionId: number) => void;
  onDone: () => void;
};

const LABELS = ["A", "B", "C", "D"];

export function QuizModal({ open, questions, session, onAnswer, onDone }: QuizModalProps) {
  if (!open || !session) return null;
  const q = questions[session.questionIndex];
  if (!q) {
    return (
      <div className="modal-backdrop">
        <div className="modal-panel panel">
          <p className="modal-title">CHEST CLAIMED</p>
          <p className="modal-meta">CORRECT: {session.correctAnswers} / {session.answersGiven}</p>
          <button className="btn btn-primary" onClick={onDone}>CLOSE</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-panel panel">
        <p className="modal-title">CHEST QUESTION {session.questionIndex + 1}</p>
        <p className="modal-question">{q.question}</p>
        <div className="answers-grid">
          {q.options.map((opt, i) => (
            <button key={i} className="answer-btn panel" onClick={() => onAnswer(i)}>
              <span>{LABELS[i]}</span>{opt}
            </button>
          ))}
        </div>
        <p className="modal-meta">CORRECT: {session.correctAnswers} | PAPERS: {session.papersRemaining}</p>
      </div>
    </div>
  );
}
