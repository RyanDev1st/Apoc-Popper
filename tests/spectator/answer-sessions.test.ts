import {
  filterAnswerSessionsByChest,
  resolveExpandedSession,
} from "@/lib/spectator/answer-sessions";
import type { ActiveAnswerSession } from "@/lib/game/types";

const sessions: ActiveAnswerSession[] = [
  {
    uid: "player-1",
    playerName: "Mai",
    avatar: "Nova",
    chestId: "chest-1",
    questionId: "q-001",
    question: "Which chest rule matters most?",
    options: ["Speed", "Safety", "Luck", "Score"],
    selectedOptionId: 1,
    answersGiven: 2,
    correctAnswers: 1,
    papersRemaining: 3,
    updatedAt: 2,
  },
  {
    uid: "player-2",
    playerName: "Linh",
    avatar: "Byte",
    chestId: "chest-2",
    questionId: "q-002",
    question: "Who owns host controls?",
    options: ["Nobody", "Everyone", "Presenter", "Bots"],
    selectedOptionId: null,
    answersGiven: 0,
    correctAnswers: 0,
    papersRemaining: 1,
    updatedAt: 1,
  },
];

describe("answer sessions helpers", () => {
  it("filters sessions to a selected chest", () => {
    expect(filterAnswerSessionsByChest(sessions, "chest-1")).toHaveLength(1);
    expect(filterAnswerSessionsByChest(sessions, null)).toHaveLength(2);
  });

  it("keeps the requested session expanded when available", () => {
    expect(resolveExpandedSession(sessions, "player-2")?.playerName).toBe("Linh");
    expect(resolveExpandedSession(sessions, "missing")?.playerName).toBe("Mai");
  });
});
