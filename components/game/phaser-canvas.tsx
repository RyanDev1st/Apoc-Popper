"use client";

import { useEffect, useRef } from "react";
import { ARENA_SIZE, SAFE_RING_RADIUS } from "@/lib/game/config";
import type { WorldState } from "@/hooks/use-game";

type PhaserCanvasProps = {
  world: WorldState;
  viewMode: "player" | "spectator";
  onMove?: (x: number, y: number) => void;
  onAim?: (x: number, y: number, firing?: boolean) => void;
  onStopAim?: () => void;
};

type SceneRefs = {
  world: WorldState;
  viewMode: "player" | "spectator";
  onMove: (x: number, y: number) => void;
  onAim: (x: number, y: number, firing?: boolean) => void;
  onStopAim: () => void;
};

const NOOP = () => {};

export function PhaserCanvas({ world, viewMode, onMove, onAim, onStopAim }: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refsRef = useRef<SceneRefs>({
    world, viewMode,
    onMove: onMove ?? NOOP,
    onAim: onAim ?? NOOP,
    onStopAim: onStopAim ?? NOOP,
  });

  useEffect(() => {
    refsRef.current = { world, viewMode, onMove: onMove ?? NOOP, onAim: onAim ?? NOOP, onStopAim: onStopAim ?? NOOP };
  });

  useEffect(() => {
    let disposed = false;
    let game: import("phaser").Game | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function boot() {
      const Phaser = await import("phaser");
      if (disposed || !containerRef.current) return;

      // entity pools
      type ZombieObj = { rect: import("phaser").GameObjects.Rectangle; id: string };
      type BulletObj = { rect: import("phaser").GameObjects.Rectangle; id: string };
      type MeteorObj = { circle: import("phaser").GameObjects.Arc; id: string };
      type GasObj = { circle: import("phaser").GameObjects.Arc; id: string };
      type ChestObj = { body: import("phaser").GameObjects.Rectangle; ring: import("phaser").GameObjects.Arc; id: string };
      type PlayerObj = { rect: import("phaser").GameObjects.Rectangle; id: string };

      class ArenaScene extends Phaser.Scene {
        keys!: Record<string, Phaser.Input.Keyboard.Key>;
        bg!: import("phaser").GameObjects.Rectangle;
        zombiePool: ZombieObj[] = [];
        bulletPool: BulletObj[] = [];
        meteorPool: MeteorObj[] = [];
        gasPool: GasObj[] = [];
        chestPool: ChestObj[] = [];
        remotePlayers: PlayerObj[] = [];
        localPlayerRect!: import("phaser").GameObjects.Rectangle;

        create() {
          this.cameras.main.setBounds(0, 0, ARENA_SIZE, ARENA_SIZE);
          this.cameras.main.roundPixels = true;

          // arena floor
          this.add.rectangle(ARENA_SIZE / 2, ARENA_SIZE / 2, ARENA_SIZE, ARENA_SIZE, 0x081108);
          // grid lines via graphics (static, created once)
          const grid = this.add.graphics();
          grid.lineStyle(1, 0x0f220f, 0.6);
          for (let p = 96; p < ARENA_SIZE; p += 96) {
            grid.lineBetween(p, 0, p, ARENA_SIZE);
            grid.lineBetween(0, p, ARENA_SIZE, p);
          }
          // arena border
          const border = this.add.graphics();
          border.lineStyle(6, 0x1a4a20, 1);
          border.strokeRect(36, 36, ARENA_SIZE - 72, ARENA_SIZE - 72);

          // local player (created once, updated via setPosition)
          this.localPlayerRect = this.add.rectangle(0, 0, 30, 30, 0xf6f2d2).setDepth(10).setVisible(false);

          // keyboard
          const kb = this.input.keyboard;
          this.keys = kb ? (kb.addKeys("W,A,S,D,SPACE") as Record<string, Phaser.Input.Keyboard.Key>) : {};

          // pointer events
          this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            const { world: w, viewMode: vm } = refsRef.current;
            if (vm !== "player" || !w.localPlayer) return;
            refsRef.current.onAim(
              pointer.worldX - w.localPlayer.x,
              pointer.worldY - w.localPlayer.y,
              pointer.primaryDown,
            );
          });

          this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            const { world: w, viewMode: vm } = refsRef.current;
            if (vm !== "player" || !w.localPlayer) return;
            refsRef.current.onAim(
              pointer.worldX - w.localPlayer.x,
              pointer.worldY - w.localPlayer.y,
              true,
            );
          });

          this.input.on("pointerup", () => refsRef.current.onStopAim());

          // hide default cursor
          this.input.setDefaultCursor("crosshair");
        }

        update() {
          const { world: w, viewMode: vm } = refsRef.current;

          // WASD movement
          if (vm === "player") {
            const mx = (this.keys.D?.isDown ? 1 : 0) - (this.keys.A?.isDown ? 1 : 0);
            const my = (this.keys.S?.isDown ? 1 : 0) - (this.keys.W?.isDown ? 1 : 0);
            refsRef.current.onMove(mx, my);
          }

          // sync local player
          if (w.localPlayer) {
            this.localPlayerRect.setPosition(w.localPlayer.x, w.localPlayer.y).setVisible(true);
            this.localPlayerRect.setFillStyle(w.localPlayer.downed ? 0xff4e5c : 0xf6f2d2);
          } else {
            this.localPlayerRect.setVisible(false);
          }

          // remote players
          syncPool(
            this, this.remotePlayers, w.remotePlayers,
            (p) => {
              const r = this.add.rectangle(p.x, p.y, 30, 30, 0x6bb7ff).setDepth(9);
              return { rect: r, id: p.uid };
            },
            (obj, p) => {
              obj.rect.setPosition(p.x, p.y).setFillStyle(p.downed ? 0xff6e63 : 0x6bb7ff).setAlpha(p.spectating ? 0.28 : 1);
            },
            (obj) => obj.rect.destroy(),
            (obj, p) => obj.id === p.uid,
          );

          // zombies
          syncPool(
            this, this.zombiePool, w.zombies,
            (z) => {
              const r = this.add.rectangle(z.x, z.y, 24, 24, 0x7cd44e).setDepth(5);
              return { rect: r, id: z.id };
            },
            (obj, z) => {
              const flash = Date.now() < z.hitFlashUntil;
              obj.rect.setPosition(z.x, z.y).setFillStyle(flash ? 0xffffff : 0x7cd44e);
            },
            (obj) => obj.rect.destroy(),
            (obj, z) => obj.id === z.id,
          );

          // bullets
          syncPool(
            this, this.bulletPool, w.bullets,
            (b) => ({ rect: this.add.rectangle(b.x, b.y, 8, 8, 0xfff199).setDepth(8), id: b.id }),
            (obj, b) => obj.rect.setPosition(b.x, b.y),
            (obj) => obj.rect.destroy(),
            (obj, b) => obj.id === b.id,
          );

          // meteors
          syncPool(
            this, this.meteorPool, w.meteors,
            (m) => ({ circle: this.add.arc(m.x, m.y, m.radius, 0, 360, false, 0xff7d3c, 0.3).setDepth(3), id: m.id }),
            (obj, m) => obj.circle.setPosition(m.x, m.y),
            (obj) => obj.circle.destroy(),
            (obj, m) => obj.id === m.id,
          );

          // gas clouds
          syncPool(
            this, this.gasPool, w.gasClouds,
            (g) => ({ circle: this.add.arc(g.x, g.y, g.radius, 0, 360, false, 0x76cf64, 0.18).setDepth(2), id: g.id }),
            (obj, g) => obj.circle.setPosition(g.x, g.y),
            (obj) => obj.circle.destroy(),
            (obj, g) => obj.id === g.id,
          );

          // chests
          syncPool(
            this, this.chestPool, w.chests,
            (c) => ({
              ring: this.add.arc(c.x, c.y, SAFE_RING_RADIUS, 0, 360, false, 0xff9a57, 0).setDepth(1).setStrokeStyle(4, 0xff9a57, 0.7),
              body: this.add.rectangle(c.x, c.y, 36, 36, c.active ? 0xf9c15d : 0x6d5635).setDepth(4),
              id: c.id,
            }),
            (obj, c) => {
              obj.body.setPosition(c.x, c.y).setFillStyle(c.active ? 0xf9c15d : 0x6d5635).setAlpha(c.active ? 1 : 0.28);
              obj.ring.setPosition(c.x, c.y).setAlpha(c.active ? 1 : 0);
            },
            (obj) => { obj.body.destroy(); obj.ring.destroy(); },
            (obj, c) => obj.id === c.id,
          );

          // camera
          const camera = this.cameras.main;
          if (vm === "player" && w.localPlayer) {
            camera.centerOn(w.localPlayer.x, w.localPlayer.y);
            camera.setZoom(Math.max(0.72, Math.min(this.scale.width / 620, this.scale.height / 520)));
          } else {
            camera.centerOn(ARENA_SIZE / 2, ARENA_SIZE / 2);
            camera.setZoom(Math.max(0.2, Math.min(this.scale.width / (ARENA_SIZE + 160), this.scale.height / (ARENA_SIZE + 160))));
          }
        }
      }

      const bounds = containerRef.current!.getBoundingClientRect();
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: containerRef.current!,
        width: Math.max(320, Math.floor(bounds.width)),
        height: Math.max(320, Math.floor(bounds.height)),
        pixelArt: true,
        transparent: true,
        backgroundColor: "#030508",
        scene: ArenaScene,
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
      });

      resizeObserver = new ResizeObserver((entries) => {
        const e = entries[0];
        if (!e || !game) return;
        game.scale.resize(
          Math.max(320, Math.floor(e.contentRect.width)),
          Math.max(320, Math.floor(e.contentRect.height)),
        );
      });
      resizeObserver.observe(containerRef.current!);
    }

    boot();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      game?.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="phaser-shell" />;
}

// Generic pool sync: update existing, create new, destroy removed
function syncPool<T extends object, D>(
  _scene: import("phaser").Scene,
  pool: T[],
  data: D[],
  create: (d: D) => T,
  update: (obj: T, d: D) => void,
  destroy: (obj: T) => void,
  match: (obj: T, d: D) => boolean,
) {
  // destroy removed
  for (let i = pool.length - 1; i >= 0; i--) {
    if (!data.some((d) => match(pool[i]!, d))) {
      destroy(pool[i]!);
      pool.splice(i, 1);
    }
  }
  // create / update
  for (const d of data) {
    const existing = pool.find((obj) => match(obj, d));
    if (existing) {
      update(existing, d);
    } else {
      pool.push(create(d));
    }
  }
}
