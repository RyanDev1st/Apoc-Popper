# Quiz Survivors Memory

Last updated: 2026-04-15

## Current Build
- Full refactor complete. Firebase removed, Supabase Realtime Broadcast in.
- Single `hooks/use-game.ts` replaces old `use-quiz-survivors-game.ts`.
- Pure game modules: `lib/game/weapon.ts`, `lib/game/mob.ts`, `lib/game/loop.ts`.
- Phaser canvas uses persistent GameObjects (not per-frame Graphics).
- Dark blue pixel design system (globals.css + Press Start 2P).
- Host dashboard at `/host/[token]` — sidebar + timeline bar + chest drawer.
- Spectator at `/spectator` — arena + player chips overlay.

## Implemented
- `/play`, `/spectator`, `/host/[token]`
- Supabase Realtime Broadcast sync (10 Hz player snapshots)
- Pure game loop: movement, dash, bullets, zombie AI, collision
- Zombie cap at 40, separation force, chest deflection
- Chest quiz flow — free first Q, paper-gated extras
- WASD + mouse aim/fire (desktop) + virtual joysticks (mobile)
- Deterministic wave/chest/catastrophe timeline
- Host controls: start, reset (token-gated)
- Host chest drawer shows live player answers

## Verified (2026-04-15)
- 37 tests pass (`vitest run`)
- 0 lint errors
- 0 TypeScript errors in src
- `next build` succeeds

## Notes
- Requires `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` for live multiplayer.
- Without env vars: join button shows "LOADING", game won't connect — expected.
- Host controls require `HOST_ACCESS_TOKEN`.
