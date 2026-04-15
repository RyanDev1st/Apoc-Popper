# Quiz Survivors — Memory & Progress

Last updated: 2026-04-15 (session 2)

## Current Build

- Full refactor complete. Firebase removed, Supabase Realtime Broadcast in.
- Single `hooks/use-game.ts` replaces old `use-quiz-survivors-game.ts`.
- Pure game modules: `lib/game/weapon.ts`, `lib/game/mob.ts`, `lib/game/loop.ts`.
- Phaser canvas uses persistent GameObjects (syncPool pattern, not per-frame Graphics).
- Dark blue pixel design system (`globals.css` + Press Start 2P).
- Host dashboard at `/host/[token]` — sidebar + timeline bar + chest drawer.
- Spectator at `/spectator` — arena + player chips overlay.

## Implemented

- `/play`, `/spectator`, `/host/[token]`
- Supabase Realtime Broadcast sync (10 Hz player snapshots via broadcast)
- Presence-based player tracking — `channel.track(fullPlayerSnapshot)` — survives host reload
- Meta (status/startedAt) persisted to localStorage — host reload recovers live/ended state
- `onPresenceSync` handler rebuilds players map from Supabase presence state on channel sync
- Pure game loop: movement, dash, bullets, zombie AI, collision
- Zombie cap at 40, separation force, chest deflection
- Chest quiz flow — free first Q, paper-gated extras, loot auto-equips
- WASD + mouse aim/fire (desktop) + virtual joysticks (mobile)
- Deterministic wave/chest/catastrophe timeline
- Host controls: START (only in "waiting"), RESET (always) — both token-gated
- Invalid host token → error screen instead of broken host view
- Host chest drawer shows live player answer sessions

## Verified (2026-04-15, session 2)

- 37 tests pass (`rtk vitest run`)
- 0 TypeScript errors (`rtk tsc`)
- `next build` succeeds

## Test Config

- `tsconfig.test.json` extends root + adds `"types": ["vitest/globals", "node"]`
- Main `tsconfig.json` excludes `tests/`, `vitest.config.ts`, `vitest.setup.ts`
- Prevents TS2582/TS2304 vitest globals errors from bleeding into app typecheck

## Pending

- Meteor/gas cloud damage to players (visual only now)
- Revive mechanic (hold button near downed player)
- Kill feed broadcast
- Companion tier effect
- End screen reward wheel real result (currently always "none")
- Real question content in `data/questions.json`

## Access

- Host URL: `localhost:3000/host/abc-xyz-132`
- Requires `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `HOST_ACCESS_TOKEN`
