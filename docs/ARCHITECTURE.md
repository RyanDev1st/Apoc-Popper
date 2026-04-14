# Quiz Survivors Architecture

## App Split
- React owns routes, layout, HUD, quiz modal, end screen, spectator cards, and host controls.
- Phaser owns the arena view, player motion, bullets, zombies, chests, meteors, and gas visuals.
- Firebase stores room meta, players, chest state, live answer sessions, feed, and results.

## Core Files
- `app/` routes for player, spectator, and host views
- `components/game/` player-facing UI
- `components/spectator/` presenter UI
- `hooks/use-quiz-survivors-game.ts` main state and room loop
- `lib/game/` deterministic rules and helpers
- `lib/firebase/client.ts` Firebase bootstrap

## Sync Boundary
- Synced:
  - room meta
  - player snapshots
  - chest state
  - active answer sessions
  - feed
  - results
- Local only:
  - zombie transforms
  - bullet transforms
  - meteor transforms
  - gas cloud transforms

## Host Access
- Host controls are not on `/spectator`.
- Host controls are enabled only on `/host/[token]`.
- Token check happens in the route with `HOST_ACCESS_TOKEN`.

## Question Flow
- First question is free.
- More questions require papers.
- No per-question timer.
- Loot resolves once when the chest flow closes.
