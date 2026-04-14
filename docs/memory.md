# Quiz Survivors Memory

Last updated: 2026-04-14

## Current Build
- Root repo is the real workspace.
- `.worktrees` is no longer part of the active flow.
- The feature branch prototype was folded into the root implementation and then updated.

## Implemented
- `/play`, `/spectator`, and `/host/[token]`
- player full-screen arena shell
- spectator full-screen arena with overlay rail and live answer session cards
- host-token gating
- deterministic wave timeline
- chest quiz flow with free first question and paper-gated extra questions
- firing slowdown + dash escape
- zombie target lock from spawn
- starter question bank in the new JSON shape
- room snapshot normalization for stable player/feed ids
- stable Phaser boot lifecycle without remount spam

## Verified
- `rtk npm test`
- `rtk lint`
- `npm run build`

## Notes
- Build succeeds with Next.js 15.
- Host controls require `HOST_ACCESS_TOKEN`.
- Firebase env values are required for shared-room play.
