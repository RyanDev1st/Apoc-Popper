# Quiz Survivors Architecture

## App Split
- React owns routes, layout, HUD, quiz modal, end screen, spectator chips, and host dashboard.
- Phaser owns the arena view (persistent GameObjects): player, remote players, bullets, zombies, chests, meteors, gas visuals.
- Supabase Realtime Broadcast syncs room meta, player snapshots, chest state, answer sessions, feed, and results.

## Core Files
- `app/` routes for player (/play), spectator (/spectator), and host (/host/[token])
- `components/game/` — GameShell, Hud, ActionDock, QuizModal, EndScreen, PhaserCanvas, VirtualStick
- `components/spectator/` — SpectatorShell, PlayerChips
- `components/host/` — HostShell, PlayerSidebar, TimelineBar, ChestDrawer
- `hooks/use-game.ts` — single hook: room sync, game tick, input, quiz
- `lib/game/` — deterministic rules: config, types, loot, spawns, drops, ai, timeline, room, questions, quiz, weapon, mob, loop
- `lib/supabase/client.ts` — Supabase lazy client, hasSupabaseConfig, getAnonId
- `lib/supabase/room.ts` — Broadcast send/subscribe helpers

## Sync Boundary
- Synced via Supabase Realtime Broadcast (10 Hz):
  - room meta (MatchMeta)
  - player snapshots (PlayerSnapshot)
  - chest state (ChestSnapshot)
  - active answer sessions (ActiveAnswerSession)
  - feed items (FeedItem)
  - results (ResultEntry)
- Local only (deterministic from shared seed + timestamp):
  - zombie transforms
  - bullet transforms
  - meteor transforms
  - gas cloud transforms

## Game Loop
- `lib/game/weapon.ts` — fireBullet, tickBullets
- `lib/game/mob.ts` — createZombie, tickMobs, damageZombie, enforceZombieCap (cap=40)
- `lib/game/loop.ts` — tickGame pure function (movement, firing, collision, dash)
- `use-game.ts` calls tickGame on every rAF, syncs player to Supabase at 10 Hz

## Host Access
- Host controls are not on `/spectator`.
- Host controls are enabled only on `/host/[token]`.
- Token check happens in the route with `HOST_ACCESS_TOKEN`.

## Question Flow
- First question is free.
- More questions require papers.
- No per-question timer.
- Loot resolves once when the chest flow closes.
