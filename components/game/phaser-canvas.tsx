"use client";

import { useEffect, useRef } from "react";
import { ARENA_SIZE, SAFE_RING_RADIUS } from "@/lib/game/config";
import type { WorldState } from "@/hooks/use-quiz-survivors-game";

type PhaserCanvasProps = {
  world: WorldState;
  viewMode: "player" | "spectator";
  selectedChestId?: string | null;
  onMove?: (x: number, y: number) => void;
  onAim?: (x: number, y: number, firing?: boolean) => void;
  onStopAim?: () => void;
};

type SceneSnapshot = {
  world: WorldState;
  viewMode: PhaserCanvasProps["viewMode"];
  selectedChestId: string | null;
};

type SceneCallbacks = {
  onMove: NonNullable<PhaserCanvasProps["onMove"]>;
  onAim: NonNullable<PhaserCanvasProps["onAim"]>;
  onStopAim: NonNullable<PhaserCanvasProps["onStopAim"]>;
};

const NOOP_MOVE: SceneCallbacks["onMove"] = () => {};
const NOOP_AIM: SceneCallbacks["onAim"] = () => {};
const NOOP_STOP: SceneCallbacks["onStopAim"] = () => {};

export function PhaserCanvas({
  world,
  viewMode,
  selectedChestId = null,
  onMove,
  onAim,
  onStopAim,
}: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneSnapshot>({ world, viewMode, selectedChestId });
  const callbacksRef = useRef<SceneCallbacks>({
    onMove: onMove ?? NOOP_MOVE,
    onAim: onAim ?? NOOP_AIM,
    onStopAim: onStopAim ?? NOOP_STOP,
  });

  useEffect(() => {
    sceneRef.current = { world, viewMode, selectedChestId };
  }, [selectedChestId, viewMode, world]);

  useEffect(() => {
    callbacksRef.current = {
      onMove: onMove ?? NOOP_MOVE,
      onAim: onAim ?? NOOP_AIM,
      onStopAim: onStopAim ?? NOOP_STOP,
    };
  }, [onAim, onMove, onStopAim]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let game: import("phaser").Game | null = null;

    async function boot() {
      const Phaser = await import("phaser");

      if (!containerRef.current || disposed) {
        return;
      }

      class ArenaScene extends Phaser.Scene {
        graphics!: Phaser.GameObjects.Graphics;
        keys!: Record<string, Phaser.Input.Keyboard.Key>;

        create() {
          this.graphics = this.add.graphics();
          this.cameras.main.setBounds(0, 0, ARENA_SIZE, ARENA_SIZE);
          this.cameras.main.roundPixels = true;
          const keyboard = this.input.keyboard;
          this.keys = keyboard ? (keyboard.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>) : ({} as Record<string, Phaser.Input.Keyboard.Key>);

          this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            const localPlayer = sceneRef.current.world.localPlayer;
            if (!localPlayer || sceneRef.current.viewMode !== "player") {
              return;
            }

            callbacksRef.current.onAim(pointer.worldX - localPlayer.x, pointer.worldY - localPlayer.y, pointer.isDown || pointer.primaryDown);
          });

          this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            const localPlayer = sceneRef.current.world.localPlayer;
            if (!localPlayer || sceneRef.current.viewMode !== "player") {
              return;
            }

            callbacksRef.current.onAim(pointer.worldX - localPlayer.x, pointer.worldY - localPlayer.y, true);
          });

          this.input.on("pointerup", () => {
            callbacksRef.current.onStopAim();
          });
        }

        update() {
          if (sceneRef.current.viewMode === "player") {
            const moveX = (this.keys?.D?.isDown ? 1 : 0) - (this.keys?.A?.isDown ? 1 : 0);
            const moveY = (this.keys?.S?.isDown ? 1 : 0) - (this.keys?.W?.isDown ? 1 : 0);
            callbacksRef.current.onMove(moveX, moveY);
          }

          drawArena(this, this.graphics, sceneRef.current);
          syncCamera(this, sceneRef.current);
        }
      }

      const bounds = containerRef.current.getBoundingClientRect();
      game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: containerRef.current,
        width: Math.max(320, Math.floor(bounds.width)),
        height: Math.max(320, Math.floor(bounds.height)),
        pixelArt: true,
        transparent: true,
        backgroundColor: "#050804",
        scene: ArenaScene,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.NO_CENTER,
        },
      });

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !game) {
          return;
        }

        const width = Math.max(320, Math.floor(entry.contentRect.width));
        const height = Math.max(320, Math.floor(entry.contentRect.height));
        game.scale.resize(width, height);
      });

      resizeObserver.observe(containerRef.current);
    }

    boot();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      callbacksRef.current.onMove(0, 0);
      callbacksRef.current.onStopAim();
      game?.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="phaser-shell" />;
}

function drawArena(
  scene: import("phaser").Scene,
  graphics: import("phaser").GameObjects.Graphics,
  snapshot: SceneSnapshot,
) {
  const { world, selectedChestId } = snapshot;
  const localPlayer = world.localPlayer;
  graphics.clear();

  graphics.fillStyle(0x081108, 1);
  graphics.fillRect(0, 0, ARENA_SIZE, ARENA_SIZE);

  for (let position = 96; position < ARENA_SIZE; position += 96) {
    graphics.lineStyle(2, 0x112411, 1);
    graphics.lineBetween(position, 0, position, ARENA_SIZE);
    graphics.lineBetween(0, position, ARENA_SIZE, position);
  }

  graphics.fillStyle(0x122715, 1);
  graphics.fillRect(36, 36, ARENA_SIZE - 72, ARENA_SIZE - 72);
  graphics.lineStyle(8, 0x86c56f, 1);
  graphics.strokeRect(36, 36, ARENA_SIZE - 72, ARENA_SIZE - 72);

  world.gasClouds.forEach((cloud) => {
    graphics.fillStyle(0x76cf64, 0.18);
    graphics.fillCircle(cloud.x, cloud.y, cloud.radius);
    graphics.lineStyle(4, 0x99ef7e, 0.4);
    graphics.strokeCircle(cloud.x, cloud.y, cloud.radius - 10);
  });

  world.meteors.forEach((meteor) => {
    graphics.fillStyle(0xff7d3c, 0.28);
    graphics.fillCircle(meteor.x, meteor.y, meteor.radius);
    graphics.fillStyle(0xffd073, 0.4);
    graphics.fillRect(meteor.x - 10, meteor.y - 10, 20, 20);
  });

  world.chests.forEach((chest) => {
    const isSelected = selectedChestId === chest.id;
    graphics.lineStyle(isSelected ? 8 : 5, isSelected ? 0xffef8d : 0xff9a57, chest.active ? 0.9 : 0.24);
    graphics.strokeCircle(chest.x, chest.y, SAFE_RING_RADIUS);
    graphics.fillStyle(chest.active ? 0xf9c15d : 0x6d5635, 1);
    graphics.fillRect(chest.x - 18, chest.y - 18, 36, 36);
    graphics.fillStyle(0x3e2715, 1);
    graphics.fillRect(chest.x - 18, chest.y - 6, 36, 12);
  });

  world.zombies.forEach((zombie) => {
    graphics.fillStyle(0x7cd44e, 1);
    graphics.fillRect(zombie.x - 12, zombie.y - 12, 24, 24);
    graphics.fillStyle(0x1d2f10, 1);
    graphics.fillRect(zombie.x - 8, zombie.y - 5, 5, 5);
    graphics.fillRect(zombie.x + 3, zombie.y - 5, 5, 5);
  });

  world.bullets.forEach((bullet) => {
    graphics.fillStyle(0xfff199, 1);
    graphics.fillRect(bullet.x - 4, bullet.y - 4, 8, 8);
  });

  world.remotePlayers.forEach((player) => {
    drawPlayer(graphics, player.x, player.y, player.downed ? 0xff6e63 : 0x6bb7ff, player.spectating ? 0.28 : 1);
  });

  if (localPlayer) {
    drawPlayer(graphics, localPlayer.x, localPlayer.y, localPlayer.downed ? 0xff4e5c : 0xf6f2d2, 1);
  }

  if (snapshot.viewMode === "spectator") {
    graphics.fillStyle(0x050804, 0.38);
    graphics.fillRect(0, 0, ARENA_SIZE, 28);
    graphics.fillRect(0, ARENA_SIZE - 28, ARENA_SIZE, 28);
    graphics.fillRect(0, 0, 28, ARENA_SIZE);
    graphics.fillRect(ARENA_SIZE - 28, 0, 28, ARENA_SIZE);
  }

  scene.game.canvas.style.imageRendering = "pixelated";
}

function drawPlayer(
  graphics: import("phaser").GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
  alpha: number,
) {
  graphics.fillStyle(color, alpha);
  graphics.fillRect(x - 15, y - 15, 30, 30);
  graphics.fillStyle(0x1e1710, alpha);
  graphics.fillRect(x - 8, y - 4, 5, 5);
  graphics.fillRect(x + 3, y - 4, 5, 5);
}

function syncCamera(scene: import("phaser").Scene, snapshot: SceneSnapshot) {
  const camera = scene.cameras.main;

  if (snapshot.viewMode === "player" && snapshot.world.localPlayer) {
    const { localPlayer } = snapshot.world;
    camera.centerOn(localPlayer.x, localPlayer.y);
    camera.setZoom(Math.max(0.72, Math.min(scene.scale.width / 620, scene.scale.height / 520)));
    return;
  }

  camera.centerOn(ARENA_SIZE / 2, ARENA_SIZE / 2);
  camera.setZoom(
    Math.max(
      0.2,
      Math.min(scene.scale.width / (ARENA_SIZE + 160), scene.scale.height / (ARENA_SIZE + 160)),
    ),
  );
}
