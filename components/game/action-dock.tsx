"use client";

type ActionDockProps = {
  onDash: () => void;
  onReviveStart: () => void;
  onReviveEnd: () => void;
  onOpenChest: () => void;
  chestAvailable: boolean;
};

export function ActionDock({ onDash, onReviveStart, onReviveEnd, onOpenChest, chestAvailable }: ActionDockProps) {
  return (
    <div className="action-dock">
      <button className="btn btn-primary" onClick={onDash}>DASH</button>
      <button
        className="btn"
        onMouseDown={onReviveStart}
        onMouseUp={onReviveEnd}
        onMouseLeave={onReviveEnd}
        onTouchStart={onReviveStart}
        onTouchEnd={onReviveEnd}
      >
        HOLD REVIVE
      </button>
      <button className="btn" onClick={onOpenChest} disabled={!chestAvailable}>
        {chestAvailable ? "OPEN CHEST" : "NO CHEST"}
      </button>
    </div>
  );
}
