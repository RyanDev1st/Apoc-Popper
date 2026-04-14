# Quiz Survivors Presentation Build Plan

## Summary
Build a one-room, 6-minute, pixel-art web game for a one-off presentation using Next.js 15, Phaser 3.70+, and Firebase Realtime Database.

The app stays screen-first:
- `/play` is mostly game canvas on mobile and desktop
- `/spectator` is arena-first with a slim info panel
- a private host URL enables start/reset/end controls for you only

Docs become the source of truth at the repo root:
- `docs/context.md`
- `docs/ARCHITECTURE.md`
- `docs/implementation.md`
- `docs/memory.md`
- add a short question-bank doc with the JSON shape you will fill later

## Key Changes
- App shell: add Next.js routes for join flow, player view, spectator view, and private host entry.
- Game client: add Phaser arena, player movement, aim, auto-fire, dash, HP/downed/revive, and placeholder pixel assets.
- Match flow: hard-code the 6-minute schedule, chest windows, wave bursts, meteors, poison gas, and instant end at `6:00`.
- Enemy logic: zombies choose the nearest player on spawn, keep that target, move faster than walking players, and stay locally simulated from shared seeds.
- Chest flow: chest stays open for `23s`; first question is free, extra questions cost papers, no per-question timer, loot resolves once at the end, best tier auto-equips.
- Spectator/host: show live arena, player states, timers, kill feed, active answer sessions, and expandable player answer cards; only the secret host URL can control the match.
- Firebase sync: store room meta, `startedAt`, player snapshots, chest state, active answer sessions, wave seeds, feed items, and end summary; do not sync zombie/meteor/gas transforms every frame.
- Question bank docs: define one simple JSON contract for `id`, `question`, `options[4]`, and `correctOptionId`, plus the file path where you will drop the data later.

## Public Interfaces
- Routes:
  - `/` join screen
  - `/play` main game
  - `/spectator` read-only presenter view
  - `/host/[token]` host-enabled spectator view
- Firebase data:
  - room meta
  - players
  - chest sessions
  - wave seeds/timestamps
  - feed
  - end-state summary
- Question JSON:
```json
[
  {
    "id": "q-001",
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctOptionId": 1
  }
]
```

## Test Plan
- Player can join, move, shoot, dash, take damage, go down, revive, and spectate after death.
- Match always follows the fixed timeline and ends exactly at `6:00`.
- Chest opens for `23s`, question modal blocks only that player, first question is free, papers unlock more questions, and loot resolves once.
- Spectator sees live arena, player cards, timers, and active answer sessions; expanding a card shows the player’s current answer view.
- Host URL can start/reset/end; `/spectator` cannot.
- Remote players stay smooth at low sync rate.
- Local sim stays consistent enough across clients from shared seeds.
- Mobile layout keeps the game as the dominant surface; desktop layout still centers the arena.

## Assumptions
- Root `docs/` is the real doc location; the `.worktrees/...` path in repo instructions is stale here.
- Tune and verify for `4–10` players; design for a best-effort ceiling of `24`.
- Security stays minimal because this is a one-off presentation build.
- You will provide the final question JSON later; docs will explain exactly where to place it.
