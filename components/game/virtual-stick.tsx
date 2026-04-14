"use client";

import { useState } from "react";

type VirtualStickProps = {
  label: string;
  onVector: (x: number, y: number) => void;
  onEnd?: () => void;
};

export function VirtualStick({ label, onVector, onEnd }: VirtualStickProps) {
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  function updateFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const radius = bounds.width / 2;
    const nextX = Math.max(-1, Math.min(1, dx / radius));
    const nextY = Math.max(-1, Math.min(1, dy / radius));

    setThumb({ x: nextX, y: nextY });
    onVector(Math.abs(nextX) < 0.08 ? 0 : nextX, Math.abs(nextY) < 0.08 ? 0 : nextY);
  }

  function reset() {
    setThumb({ x: 0, y: 0 });
    onVector(0, 0);
    onEnd?.();
  }

  return (
    <div
      className="virtual-pad"
      onPointerDown={updateFromPointer}
      onPointerMove={(event) => {
        if (event.buttons > 0) {
          updateFromPointer(event);
        }
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
    >
      <span className="virtual-pad-label">{label}</span>
      <span className="virtual-pad-thumb" style={{ transform: `translate(${thumb.x * 24}px, ${thumb.y * 24}px)` }} />
    </div>
  );
}
