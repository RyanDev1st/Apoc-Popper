# Quiz Survivors Context

## What This Repo Is
- One-room presentation game.
- Next.js 15 app shell.
- Phaser 3 arena with persistent GameObjects.
- Supabase Realtime Broadcast for shared room state.

## Main Routes
- `/` redirect to /play
- `/play` player join + play shell
- `/spectator` read-only presenter view with player chips overlay
- `/host/[token]` host dashboard (sidebar + timeline bar + chest drawer)

## Match Shape
- 6 minute hard cap
- one shared room only
- 2D top-down pixel look (dark blue glass design system)
- mobile-first controls (virtual joysticks + action dock)
- public players, private host link

## Current Status
- Full refactor complete (2026-04-15).
- Firebase removed, Supabase Realtime Broadcast in place.
- New pure game modules: weapon, mob, loop (all tested).
- Single `use-game` hook replaces old `use-quiz-survivors-game`.
- Phaser canvas uses persistent GameObjects (no per-frame Graphics redraw).
- Host dashboard: player sidebar always visible, timeline bar always visible, chest drawer on click.

## Content Input
- Question bank file: `data/questions.json`
- Format docs: [question-bank.md](/abs/path/c:/Users/admin/maze%20game/docs/question-bank.md)
