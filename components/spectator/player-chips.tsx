"use client";

import type { PlayerSnapshot } from "@/lib/game/types";

type PlayerChipsProps = { players: PlayerSnapshot[] };

export function PlayerChips({ players }: PlayerChipsProps) {
  if (players.length === 0) return null;
  return (
    <div className="player-chips">
      {players.map((p) => {
        const hpPct = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100));
        return (
          <div key={p.uid} className="player-chip panel">
            <div className={`chip-dot${p.downed ? " downed" : ""}`} />
            <span>{p.name}</span>
            <div className="chip-hp"><div className="chip-hp-fill" style={{ width: `${hpPct}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}
