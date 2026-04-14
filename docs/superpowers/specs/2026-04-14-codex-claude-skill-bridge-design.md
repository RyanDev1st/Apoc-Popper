# Codex Claude Skill Bridge Design

## Goal

Make Codex globally able to use skills sourced from `C:\Users\admin\.claude\skills` and skill-bearing content inside `C:\Users\admin\.claude\plugins\cache` across any future repository or project, without modifying, moving, or damaging anything under `C:\Users\admin\.claude`.

## Context

Codex already exposes globally available skills through `C:\Users\admin\.codex\skills`. Existing entries there include both native directories and junction-backed skill folders. Claude maintains two separate sources of skill-like content:

- direct skill folders under `C:\Users\admin\.claude\skills`
- plugin cache payloads under `C:\Users\admin\.claude\plugins\cache`, where many plugins contain nested skill folders with `SKILL.md`

The required integration is not "run Claude plugins inside Codex". The reliable requirement is that Codex can discover and use the skill content from those Claude-managed locations.

## Non-Goals

- Do not modify files under `C:\Users\admin\.claude`
- Do not move or delete anything from the Claude setup
- Do not attempt to execute arbitrary Claude plugin runtime hooks inside Codex
- Do not overwrite existing Codex-managed skills in `C:\Users\admin\.codex\skills`

## Proposed Architecture

Create a managed global bridge rooted in `C:\Users\admin\.codex`:

- `C:\Users\admin\.codex\scripts\sync-claude-skills.ps1`
  - scans Claude skill sources
  - discovers valid skill roots by presence of `SKILL.md`
  - creates or refreshes junctions in a Codex-owned generated folder
  - writes a manifest recording source and generated target paths
- `C:\Users\admin\.codex\skills\claude-*`
  - generated junctions pointing to the discovered Claude skill roots
- `C:\Users\admin\.codex\manifests\claude-skill-bridge.json`
  - generated inventory used for refreshes and collision reporting

Codex continues to discover skills from its normal global `skills` directory. The bridge only adds Codex-visible entries there.

## Discovery Rules

### Direct Claude skills

For each immediate child directory in `C:\Users\admin\.claude\skills`:

- if `<dir>\SKILL.md` exists, it is a valid skill root
- expose it to Codex with the same folder name unless that name conflicts with an existing Codex skill

### Claude plugin cache skills

Recursively scan `C:\Users\admin\.claude\plugins\cache` for `SKILL.md` files, but only treat a parent directory as a skill root when it is inside one of these known layouts:

- `...\skills\<skill-name>\SKILL.md`
- `...\ .claude\skills\<skill-name>\SKILL.md`
- `...\ .agents\skills\<skill-name>\SKILL.md`
- `...\plugins\<plugin-name>\skills\<skill-name>\SKILL.md`

Ignore translated documentation trees and other non-runtime copies where possible. The bridge should prefer the shortest runtime-oriented path for duplicate skill names from the same plugin payload.

Plugin-derived Codex names should be stable and collision-safe:

- preferred name: `<skill-name>` when unused
- fallback name: `claude-<plugin-name>-<skill-name>`
- if still colliding, append a deterministic short hash suffix derived from the source path

## Safety Rules

- The script is allowed to create, update, and remove only bridge-managed files under `C:\Users\admin\.codex`
- The script must never write into `C:\Users\admin\.claude`
- Removal is limited to junctions previously created by the bridge and tracked in the manifest
- Existing non-bridge Codex skills must be left untouched
- The script must be idempotent: repeated runs produce the same bridge state when Claude inputs are unchanged

## Refresh Model

Manual refresh is sufficient for the first version:

- running the PowerShell sync script rescans Claude sources and repairs the bridge

Optional later enhancement:

- add a small wrapper command or automation entry in `C:\Users\admin\.codex` to invoke the sync on demand

No undocumented Codex startup-hook behavior should be assumed for v1.

## Error Handling

- If a source path disappears, remove only the corresponding bridge-managed junction on the next sync
- If a junction cannot be created because a non-bridge path already exists in `C:\Users\admin\.codex\skills`, record the conflict in the manifest and continue
- If plugin cache layouts change, skip unknown shapes rather than guessing
- If the manifest is missing, rebuild from current filesystem state and bridge-owned naming rules

## Verification

Verification should prove:

- bridge files are created only under `C:\Users\admin\.codex`
- no writes occur under `C:\Users\admin\.claude`
- discovered skills include both direct Claude skills and plugin-cache skills
- generated junction targets resolve correctly
- repeated sync runs are stable

## Files To Create Or Modify

- Create `C:\Users\admin\.codex\scripts\sync-claude-skills.ps1`
- Create `C:\Users\admin\.codex\manifests\claude-skill-bridge.json`
- Create bridge-managed junctions under `C:\Users\admin\.codex\skills`
- Create a short usage note in `C:\Users\admin\.codex\AGENTS.md` or adjacent Codex-owned documentation only if needed to explain the bridge

## Open Decision Resolved

The bridge will be global, Codex-owned, refreshable, and read-only with respect to the Claude home. That satisfies the requirement that future Codex sessions in any repo can use the Claude skill corpus without risking the Claude installation.
