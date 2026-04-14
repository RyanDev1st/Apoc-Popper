"use client";

import type { PlayerSnapshot } from "@/lib/game/types";

type PlayerSidebarProps = { players: PlayerSnapshot[] };

export function PlayerSidebar({ players }: PlayerSidebarProps) {
  return (
    <aside className="host-sidebar">
      <div className="sidebar-header">PLAYERS ({players.length})</div>
      {players.map((p) => {
        const hpPct = Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100));
        return (
          <div key={p.uid} className={`sidebar-row${p.downed ? " downed" : ""}`}>
            <span className="sidebar-name">{p.name}</span>
            <span className="sidebar-tier">T{p.lootTier}</span>
            <div className="sidebar-hp-track">
              <div className="sidebar-hp-fill" style={{ width: `${hpPct}%` }} />
            </div>
          </div>
        );
      })}
      {players.length === 0 && (
        <div className="sidebar-row"><span className="sidebar-name" style={{ color: "var(--muted)" }}>NO PLAYERS</span></div>
      )}
    </aside>
  );
}
