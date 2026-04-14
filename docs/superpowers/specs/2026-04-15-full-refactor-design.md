# Quiz Survivors — Full Refactor Design
Date: 2026-04-15

## Goal
Production-ready presentation game. Full multiplayer via Firebase. Clean code. Sleek pixel UI.
2-day delivery. Functional + simple + coherent over clever.

---

## What Stays (Do Not Touch)
- `lib/game/config.ts` — arena constants, chest layout, spawn points
- `lib/game/timeline.ts` — deterministic 6-min event schedule
- `lib/game/types.ts` — shared TypeScript types
- `lib/game/loot.ts` — tier system, stat application
- `lib/game/spawns.ts` — deterministic burst plan via seedrandom
- `lib/game/drops.ts` — paper drop roll
- `lib/game/ai.ts` — target resolution, move scale
- `lib/firebase/client.ts` — Firebase bootstrap
- `data/questions.json` — question bank

---

## What Gets Rewritten (Clean Slate)

### 1. New lib modules

**`lib/game/weapon.ts`**
- `fireBullet(player, aimX, aimY, now, lootTier)` → `Bullet | null`
- Fire rate, bullet speed, damage derived from lootTier
- Returns null if on cooldown
- Bullet: `{ id, x, y, vx, vy, ttl }`

**`lib/game/mob.ts`**
- `tickMobs(zombies, players, chests, deltaMs, now)` → updated zombie array
- Separation: push away from neighbors within 48px radius
- Target re-evaluation every 500ms (counter, not every frame)
- Chest deflection: tangent push when inside open-chest safe radius
- Arena clamp every tick
- Runtime 40-cap: despawn oldest on overflow

**`lib/game/loop.ts`**
- Pure tick function: `tickGame(state, input, deltaMs, now)` → next state
- Handles: player movement, bullet movement, bullet-zombie AABB collision, damage, death, meteor/gas damage
- No Firebase, no React — pure in/out

**`lib/firebase/room.ts`**
- Isolated read/write functions: `subscribeRoom`, `writePlayer`, `writeChest`, `writeFeed`, `writeResult`, `writeMeta`
- No game logic — just Firebase wrappers

### 2. Hook

**`hooks/use-game.ts`** (replaces `use-quiz-survivors-game.ts`)
- Single hook, ~300 lines max
- Calls `loop.ts` tick in `requestAnimationFrame`
- Calls `room.ts` for Firebase sync at 10Hz
- Calls `weapon.ts` for shooting
- Calls `mob.ts` for zombie movement
- Returns: `world`, `quiz`, `controls`, `meta`

### 3. Phaser scene

**`components/game/phaser-canvas.tsx`** — rewrite
- Create `GameObjects.Rectangle` / `GameObjects.Arc` once per entity at spawn
- `update()` calls `.setPosition()` / `.setAlpha()` — no `graphics.clear()` redraw
- Hit flash: `this.tweens.add({ targets: obj, alpha: 0, duration: 200 })` on death
- Crosshair: hide default cursor inside canvas, show pixel crosshair sprite
- Desktop: WASD move, mouse aim, left-click-hold = fire, `pointerup` = stop firing (fix sticky bug)
- Mobile: left joystick = move, right joystick = aim + auto-fire when active

### 4. React UI

**Design language:**
- Font: `Press Start 2P` (pixel) via `next/font/google`
- Base bg: `#030508`
- Panels: `rgba(4,8,16,0.88)` + `backdrop-filter: blur(10px)`
- Borders: `1px solid rgba(60,120,255,0.25)` + `box-shadow: 0 0 8px rgba(40,100,255,0.12)`
- Active pulse: `@keyframes border-pulse` on wave-active elements
- Accent: `#4af` (cyan-blue)
- Positive/HP: `#8f6` (green)
- Damage/danger: `#f84` (orange)
- Buttons: `rgba(60,120,255,0.12)` bg, `1px solid rgba(60,120,255,0.4)` border, translucent
- Primary CTA only: slightly brighter fill

**Player client (`/play`):**
- Arena = 100% viewport, Phaser canvas fills it
- Join screen: full-screen dark, single centered card (name input + Play button + controls hint)
- In-game HUD: single slim row pinned top — `[HP bar + name] [MM:SS timer] [Papers | Tier]`
- Action dock: bottom-right, 3 stacked buttons (Dash / Hold Revive / Open Chest), 56px min height
- Mobile sticks: bottom-left (move) + bottom-right above dock (aim), shown only on touch
- All HUD elements: glass panels, pixel font, blue-glow borders

**Spectator client (`/spectator`):**
- Same as player client layout — arena fills screen
- No controls, no dock
- Slim overlay: player list chips top-left (name + HP dot, alive/downed color)

**Host client (`/host/[token]`):**
- Layout: `arena (center flex-1) | player sidebar (right, 280px fixed)`
- Player sidebar (always visible): scrollable list, each row = pixel name + HP bar + tier badge + alive/downed glow
- Timeline bar (always visible, pinned bottom): current wave label, elapsed MM:SS, next event countdown, kill count, connected count
- Chest click on arena → drawer overlay opens with live answer session cards for that chest. Click-away closes.
- All panels glass + blue-glow borders

---

## Controls

### Desktop
| Action | Input |
|---|---|
| Move | WASD |
| Aim | Mouse |
| Fire | Left-click hold |
| Stop fire | Mouse up |
| Dash | Space or Dash button |

### Mobile
| Action | Input |
|---|---|
| Move | Left virtual joystick |
| Aim + Fire | Right virtual joystick (auto-fire when pushed) |
| Dash | Dash button |

---

## Weapon System
- Stats scale with lootTier (wired to `loot.ts`)
- Tier 0: slow fire, low damage, low speed
- Tier 3+: fast fire, high damage
- Bullet TTL: 1200ms
- Bullet speed: 480 + tier×60 px/s
- Fire rate: 280ms - tier×30ms cooldown

---

## Mob System
- `spawns.ts` generates burst plan (unchanged)
- `mob.ts` runs tick: separation + deflection + clamp + target lock (500ms re-eval)
- 40-mob hard cap enforced at runtime
- On death: white flash tween → despawn
- Chest open → zombies in safe radius pushed tangent

---

## Firebase Sync Boundary
Synced (via `room.ts`):
- room meta (status, startedAt, wave seeds, connectedCount)
- player snapshots at ~10Hz
- chest state
- active answer sessions
- feed items
- results

Local only (never synced):
- zombie positions
- bullet positions
- meteor positions
- gas cloud positions

---

## File Map (after refactor)

```
app/
  layout.tsx          — font load (Press Start 2P), globals
  page.tsx            — redirect to /play
  play/page.tsx       — GameShell
  spectator/page.tsx  — SpectatorShell
  host/[token]/page.tsx — HostShell

components/
  game/
    game-shell.tsx    — join screen + arena frame
    phaser-canvas.tsx — Phaser scene (rewrite)
    hud.tsx           — slim top bar
    action-dock.tsx   — 3 action buttons
    virtual-stick.tsx — joystick (keep, minor cleanup)
    quiz-modal.tsx    — question + 2x2 answers
    end-screen.tsx    — result + spin wheel
  spectator/
    spectator-shell.tsx
    player-chips.tsx  — alive/downed overlay
  host/
    host-shell.tsx
    player-sidebar.tsx
    timeline-bar.tsx
    chest-drawer.tsx  — answer session overlay

hooks/
  use-game.ts         — single game hook (~300 lines)

lib/
  game/
    config.ts         — KEEP
    timeline.ts       — KEEP
    types.ts          — KEEP
    loot.ts           — KEEP
    spawns.ts         — KEEP
    drops.ts          — KEEP
    ai.ts             — KEEP
    questions.ts      — KEEP
    quiz.ts           — KEEP
    weapon.ts         — NEW
    mob.ts            — NEW
    loop.ts           — NEW
  firebase/
    client.ts         — KEEP
    room.ts           — NEW (extracted from hook)
  host/
    access.ts         — KEEP

app/globals.css       — full rewrite (new design system)
```

---

## Success Criteria
- Join → play → 6min match → end screen works end-to-end
- 2+ players see each other moving in real time
- Zombies move, separate, die with feedback
- Shooting works on desktop (mouse) and mobile (joystick)
- Quiz opens from chest, answers sync to host
- Host sees player HP/alive state live
- Host timeline bar shows correct wave/event
- Lint passes, build passes
