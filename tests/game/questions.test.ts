import { getQuestionBank } from "@/lib/game/questions";

describe("question bank", () => {
  it("returns canonical questions with four options and a correctOptionId", () => {
    const [question] = getQuestionBank();

    expect(question.question.length).toBeGreaterThan(0);
    expect(question.options).toHaveLength(4);
    expect(question.correctOptionId).toBeGreaterThanOrEqual(0);
    expect(question.correctOptionId).toBeLessThan(4);
  });
});
