import {
  buildQuizSession,
  getQuizTier,
  isQuizOutOfQuestions,
  submitQuizAnswer,
} from "@/lib/game/quiz";

describe("quiz flow", () => {
  it("starts with a free question and consumes papers only after the first answer", () => {
    const session = buildQuizSession({ chestId: "chest-1", papers: 2, questionIds: ["q1", "q2", "q3"] });
    const firstAnswer = submitQuizAnswer(session, 0, true);
    const secondAnswer = submitQuizAnswer(firstAnswer, 1, false);

    expect(session.currentQuestionId).toBe("q1");
    expect(firstAnswer.papersRemaining).toBe(2);
    expect(secondAnswer.papersRemaining).toBe(1);
  });

  it("derives the reward tier from correct answers", () => {
    const session = buildQuizSession({ chestId: "chest-2", papers: 3, questionIds: ["q1", "q2", "q3", "q4"] });
    const one = submitQuizAnswer(session, 0, true);
    const two = submitQuizAnswer(one, 1, true);
    const three = submitQuizAnswer(two, 2, true);

    expect(getQuizTier(one.correctAnswers)).toBe(1);
    expect(getQuizTier(three.correctAnswers)).toBe(2);
  });

  it("stops offering more questions when the player runs out of papers", () => {
    const session = buildQuizSession({ chestId: "chest-3", papers: 0, questionIds: ["q1", "q2"] });
    const afterFreeQuestion = submitQuizAnswer(session, 0, true);

    expect(afterFreeQuestion.currentQuestionId).toBeNull();
    expect(isQuizOutOfQuestions(afterFreeQuestion)).toBe(true);
  });
});
