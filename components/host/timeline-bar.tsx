"use client";

import { getUpcomingEvents, WAVE_EVENTS } from "@/lib/game/timeline";
import type { MatchMeta } from "@/lib/game/types";

type TimelineBarProps = {
  elapsedMs: number;
  meta: MatchMeta;
  onStart: () => void;
  onReset: () => void;
  canHost: boolean;
};

export function TimelineBar({ elapsedMs, meta, onStart, onReset, canHost }: TimelineBarProps) {
  const timeLeft = Math.max(0, 360 - Math.floor(elapsedMs / 1000));
  const mm = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const ss = (timeLeft % 60).toString().padStart(2, "0");

  const currentWave = [...WAVE_EVENTS].reverse().find((e) => elapsedMs >= e.atMs);
  const upcoming = getUpcomingEvents(elapsedMs, 1)[0];
  const nextIn = upcoming ? Math.max(0, Math.ceil((upcoming.atMs - elapsedMs) / 1000)) : null;

  return (
    <div className="timeline-bar panel">
      <span className="timeline-timer">{mm}:{ss}</span>
      {currentWave && <span className="timeline-wave">{currentWave.label.toUpperCase()}</span>}
      {upcoming && nextIn !== null && (
        <span className="timeline-next">NEXT: {upcoming.label.toUpperCase()} IN {nextIn}S</span>
      )}
      <span className="timeline-kills">KILLS: {meta.globalKillCount}</span>
      <span className="timeline-conn">CONN: {meta.connectedCount}</span>
      {canHost && (
        <div className="host-actions">
          {meta.status === "waiting" && (
            <button className="btn btn-primary" onClick={onStart}>START</button>
          )}
          <button className="btn btn-danger" onClick={onReset}>RESET</button>
        </div>
      )}
    </div>
  );
}
