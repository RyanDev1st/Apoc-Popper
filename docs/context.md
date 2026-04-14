# Quiz Survivors Context

## What This Repo Is
- One-room presentation game.
- Next.js 15 app shell.
- Phaser 3 arena.
- Firebase Realtime Database for shared room state.

## Main Routes
- `/` player join + play shell
- `/play` player join + play shell
- `/spectator` read-only presenter view
- `/host/[token]` presenter view with host controls when the token matches `HOST_ACCESS_TOKEN`

## Match Shape
- 6 minute hard cap
- one shared room only
- 2D top-down pixel look
- mobile-first controls
- public players, private host link

## Current Status
- Root repo contains the active build.
- Player and spectator views are now screen-first: the arena owns the viewport and controls float on top.
- Room snapshots are normalized before render, so real Firebase ids stay stable across player cards, feed, and spectator lists.
- Firebase env values are required to join or spectate a live shared room.

## Content Input
- Question bank file: `data/questions.json`
- Format docs: [question-bank.md](/abs/path/c:/Users/admin/maze%20game/docs/question-bank.md)
