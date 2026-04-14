import type { ActiveAnswerSession } from "@/lib/game/types";

export function filterAnswerSessionsByChest(
  sessions: ActiveAnswerSession[],
  selectedChestId?: string | null,
): ActiveAnswerSession[] {
  return sessions.filter((session) => !selectedChestId || session.chestId === selectedChestId);
}

export function resolveExpandedSession(
  sessions: ActiveAnswerSession[],
  expandedUid?: string | null,
): ActiveAnswerSession | null {
  return sessions.find((session) => session.uid === expandedUid) ?? sessions[0] ?? null;
}
