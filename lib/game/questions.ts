import questionBank from "@/data/questions.json";
import type { Question } from "@/lib/game/types";

export type { Question } from "@/lib/game/types";

type RawQuestion = {
  id: string;
  question?: string;
  prompt?: string;
  options: [string, string, string, string];
  correctOptionId?: number;
  answerIndex?: number;
};

const QUESTIONS = (questionBank as RawQuestion[]).map(normalizeQuestion);

export function getQuestionBank(): Question[] {
  return QUESTIONS;
}

export function getRandomQuestionSet(seed: string, count: number): Question[] {
  const questions = [...QUESTIONS];
  let cursor = hashSeed(seed);

  for (let index = questions.length - 1; index > 0; index -= 1) {
    cursor = (cursor * 1_103_515_245 + 12_345) & 0x7fffffff;
    const swapIndex = cursor % (index + 1);
    [questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]];
  }

  return questions.slice(0, Math.min(count, questions.length));
}

function hashSeed(seed: string): number {
  return seed.split("").reduce((total, character) => total + character.charCodeAt(0), 17);
}

function normalizeQuestion(question: RawQuestion): Question {
  return {
    id: question.id,
    question: question.question ?? question.prompt ?? "",
    options: question.options,
    correctOptionId: question.correctOptionId ?? question.answerIndex ?? 0,
  };
}
