# Quiz Survivors Repo Instructions

Always say "Aye" at the beginning of the session after done reading to confirm you have read.

Constraint: always use /caveman:caveman guideline for your answers. 
## Project Guardrails
- Build only against Next.js 15, Phaser 3.70+ and Firebase Realtime Database.
- Keep the game strictly 2D top-down with retro pixel-art presentation across gameplay and UI.
- Use one shared room only. No matchmaking, no bots, no persistence beyond the active match.

## Match Rules
- The match is a hard-capped 6 minute run. Every client must derive the same timeline from `startedAt`.
- Hard-code the timeline events from the final spec:
  - `0:00` wave 1
  - `0:30` chest 1
  - `1:00` chest 2
  - `1:30` wave 2 + meteors
  - `2:00` chest 3
  - `3:00` wave 3 + chest 4
  - `4:00` chest 5
  - `4:30` wave 4 + poison gas
  - `5:00` chest 6
  - `5:30` wave 5 + meteors + poison gas
  - `6:00` instant end
- Zombie bursts scale by actual connected player count and stay capped at 40 active mobs.

## Multiplayer Boundaries
- Sync only player snapshots, room meta, chest state, wave seeds, feed items, and end-state summaries through Firebase.
- Never sync individual zombie, meteor, or gas cloud transforms every frame. Those are local deterministic simulations from shared seeds and timestamps.
- Keep player writes near 10 Hz and smooth remote movement client-side with interpolation.

## Host And Spectator Policy
- Host controls are restricted to the host device/session only. The intended presentation mode is localhost or the machine hosting the demo.
- `/spectator` is public read-only by default. Only the host session can start, reset, or advance the match.
- Do not add extra operator surfaces outside `/spectator` unless explicitly requested.

## Gameplay Constraints
- Mobile-first controls are mandatory: joystick movement, touch aiming, and a dedicated dash control.
- Chest fire circles are safe for players and hard-block zombies while the chest is open.
- The first chest question is always free. Additional questions consume Question Papers.
- Loot auto-equips the best tier. No manual inventory UI.

## Delivery Expectations
- Prefer small, focused modules over large scene files.
- Keep deterministic logic testable outside the rendering layer.
- Before claiming completion, verify lint, targeted tests, and a production build.

#Project Details: C:\Users\admin\maze game\docs\context.md
#Project Architecture: C:\Users\admin\maze game\docs\ARCHITECTURE.md

Always read C:\Users\admin\maze game\docs to understand the current progress

C:\Users\admin\maze game\docs\PLAN.md shows our legacy implementation plan. Learn what you can from it only.

Always update C:\Users\admin\maze game\docs after build
<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->