import { getLootTierForCorrectAnswers } from "@/lib/game/loot";

export type QuizSession = {
  chestId: string;
  papersRemaining: number;
  questionIds: string[];
  currentQuestionId: string | null;
  questionIndex: number;
  answersGiven: number;
  correctAnswers: number;
};

export function buildQuizSession(input: {
  chestId: string;
  papers: number;
  questionIds: string[];
}): QuizSession {
  return {
    chestId: input.chestId,
    papersRemaining: input.papers,
    questionIds: input.questionIds,
    currentQuestionId: input.questionIds[0] ?? null,
    questionIndex: 0,
    answersGiven: 0,
    correctAnswers: 0,
  };
}

export function submitQuizAnswer(session: QuizSession, answerIndex: number, isCorrect: boolean): QuizSession {
  const nextAnswersGiven = session.answersGiven + 1;
  const candidateQuestionIndex = Math.min(session.questionIndex + 1, session.questionIds.length);
  const hasNextQuestion = candidateQuestionIndex < session.questionIds.length;
  const canContinue = hasNextQuestion && session.papersRemaining > 0;
  const nextQuestionIndex = canContinue ? candidateQuestionIndex : session.questionIds.length;
  const nextQuestionId = canContinue ? session.questionIds[candidateQuestionIndex] ?? null : null;
  const shouldConsumePaper = nextAnswersGiven > 1 && nextQuestionId !== null && session.papersRemaining > 0;

  return {
    ...session,
    papersRemaining: shouldConsumePaper ? session.papersRemaining - 1 : session.papersRemaining,
    questionIndex: nextQuestionIndex,
    currentQuestionId: nextQuestionId,
    answersGiven: nextAnswersGiven,
    correctAnswers: session.correctAnswers + (isCorrect ? 1 : 0),
  };
}

export function getQuizTier(correctAnswers: number): 0 | 1 | 2 | 3 {
  return getLootTierForCorrectAnswers(correctAnswers);
}

export function isQuizOutOfQuestions(session: QuizSession): boolean {
  return session.currentQuestionId === null;
}

