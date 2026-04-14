# Codex Claude Skill Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global, Codex-owned sync bridge that makes Claude skills available to Codex in every future project without modifying `C:\Users\admin\.claude`.

**Architecture:** A PowerShell sync script in `C:\Users\admin\.codex\scripts` scans Claude skill sources, discovers valid skill roots, creates bridge-managed junctions in `C:\Users\admin\.codex\skills`, and writes a manifest in `C:\Users\admin\.codex\manifests`. Existing Codex skills remain untouched, and only bridge-owned junctions are updated or removed.

**Tech Stack:** PowerShell 7+, NTFS junctions, JSON manifest, Codex global home under `C:\Users\admin\.codex`

---

### Task 1: Add a failing verification script for skill discovery and naming

**Files:**
- Create: `C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
- Test: `C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`

- [ ] **Step 1: Write the failing test**

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = 'C:\Users\admin\.codex\scripts\sync-claude-skills.ps1'
if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Missing sync script: $scriptPath"
}

. $scriptPath

$direct = Get-ClaudeDirectSkillRoots -ClaudeSkillsRoot 'C:\Users\admin\.claude\skills'
if (-not $direct) {
    throw 'Expected at least one direct Claude skill root.'
}

$plugin = Get-ClaudePluginSkillRoots -ClaudePluginCacheRoot 'C:\Users\admin\.claude\plugins\cache'
if (-not $plugin) {
    throw 'Expected at least one plugin-cache Claude skill root.'
}

$existing = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
$null = $existing.Add('brainstorming')
$null = $existing.Add('wiki-query')

$resolved = Resolve-BridgeSkillName -PreferredName 'brainstorming' -PluginName 'superpowers' -ExistingNames $existing -SourcePath 'C:\Users\admin\.claude\plugins\cache\superpowers\skills\brainstorming'
if ($resolved -eq 'brainstorming') {
    throw 'Expected collision-safe renaming for conflicting skill names.'
}

Write-Host 'PASS'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
Expected: FAIL with `Missing sync script`

- [ ] **Step 3: Write minimal implementation**

Create the sync script with the public functions used above:

```powershell
function Get-ClaudeDirectSkillRoots { throw 'not implemented' }
function Get-ClaudePluginSkillRoots { throw 'not implemented' }
function Resolve-BridgeSkillName { throw 'not implemented' }
```

- [ ] **Step 4: Run test to verify it still fails for missing behavior**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
Expected: FAIL with `not implemented`

- [ ] **Step 5: Commit**

```bash
git add .worktrees/quiz-survivors/docs/superpowers/specs/2026-04-14-codex-claude-skill-bridge-design.md .worktrees/quiz-survivors/docs/superpowers/plans/2026-04-14-codex-claude-skill-bridge.md
git commit -m "docs: add codex claude skill bridge spec and plan"
```

### Task 2: Implement discovery and collision-safe naming

**Files:**
- Modify: `C:\Users\admin\.codex\scripts\sync-claude-skills.ps1`
- Test: `C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`

- [ ] **Step 1: Write the failing test for discovery details**

Append to the test script:

```powershell
$pluginSkill = $plugin | Where-Object { $_.SourcePath -match '\\plugins\\cache\\' } | Select-Object -First 1
if (-not $pluginSkill.PluginName) {
    throw 'Expected plugin skill records to include PluginName.'
}

if (-not $pluginSkill.PreferredName) {
    throw 'Expected plugin skill records to include PreferredName.'
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
Expected: FAIL because returned records do not include `PluginName` or `PreferredName`

- [ ] **Step 3: Write minimal implementation**

Implement record-producing discovery functions:

```powershell
function New-SkillRecord {
    param(
        [string]$SourcePath,
        [string]$PreferredName,
        [string]$PluginName,
        [string]$SourceKind
    )

    [pscustomobject]@{
        SourcePath = $SourcePath
        PreferredName = $PreferredName
        PluginName = $PluginName
        SourceKind = $SourceKind
    }
}
```

Implementation requirements:
- direct skills return `SourceKind = 'claude-skills'`
- plugin cache skills return `SourceKind = 'claude-plugin-cache'`
- `Resolve-BridgeSkillName` uses preferred name first, then `claude-<plugin>-<skill>`, then hash suffix

- [ ] **Step 4: Run test to verify it passes**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add C:/Users/admin/.codex/scripts/test-claude-skill-bridge.ps1 C:/Users/admin/.codex/scripts/sync-claude-skills.ps1
git commit -m "feat: add claude skill discovery for codex bridge"
```

### Task 3: Implement manifest-backed junction sync

**Files:**
- Modify: `C:\Users\admin\.codex\scripts\sync-claude-skills.ps1`
- Create: `C:\Users\admin\.codex\manifests\claude-skill-bridge.json`
- Test: `C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`

- [ ] **Step 1: Write the failing test for bridge application**

Append to the test script:

```powershell
$result = Sync-ClaudeSkillsToCodex `
    -ClaudeSkillsRoot 'C:\Users\admin\.claude\skills' `
    -ClaudePluginCacheRoot 'C:\Users\admin\.claude\plugins\cache' `
    -CodexSkillsRoot 'C:\Users\admin\.codex\skills' `
    -ManifestPath 'C:\Users\admin\.codex\manifests\claude-skill-bridge.json'

if (-not $result.Created -and -not $result.Updated -and -not $result.Unchanged) {
    throw 'Expected sync result counters.'
}

if (-not (Test-Path -LiteralPath 'C:\Users\admin\.codex\manifests\claude-skill-bridge.json')) {
    throw 'Expected manifest to be written.'
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
Expected: FAIL because `Sync-ClaudeSkillsToCodex` does not exist

- [ ] **Step 3: Write minimal implementation**

Implement:

```powershell
function Sync-ClaudeSkillsToCodex {
    param(
        [string]$ClaudeSkillsRoot,
        [string]$ClaudePluginCacheRoot,
        [string]$CodexSkillsRoot,
        [string]$ManifestPath
    )

    # 1. discover source records
    # 2. read existing manifest when present
    # 3. create bridge-managed junctions only when target path is absent or bridge-owned
    # 4. remove stale bridge-managed junctions from prior manifest
    # 5. write manifest with source, target, and target name
    # 6. return counters
}
```

Bridge-owned naming rule:
- generated target paths are under `C:\Users\admin\.codex\skills`
- manifest contains `managedBy = 'claude-skill-bridge'`

- [ ] **Step 4: Run test to verify it passes**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
Expected: PASS and manifest exists

- [ ] **Step 5: Commit**

```bash
git add C:/Users/admin/.codex/scripts/sync-claude-skills.ps1 C:/Users/admin/.codex/manifests/claude-skill-bridge.json
git commit -m "feat: sync claude skills into codex bridge"
```

### Task 4: Add a user-facing refresh entry point and usage note

**Files:**
- Modify: `C:\Users\admin\.codex\AGENTS.md`
- Modify: `C:\Users\admin\.codex\scripts\sync-claude-skills.ps1`
- Test: `C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`

- [ ] **Step 1: Write the failing test for executable script behavior**

Append to the test script:

```powershell
$invoke = & powershell -ExecutionPolicy Bypass -File 'C:\Users\admin\.codex\scripts\sync-claude-skills.ps1'
if ($LASTEXITCODE -ne 0) {
    throw 'Expected direct script execution to succeed.'
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
Expected: FAIL because the script does not execute cleanly as an entry point

- [ ] **Step 3: Write minimal implementation**

Add script entry-point logic:

```powershell
if ($MyInvocation.InvocationName -ne '.') {
    $result = Sync-ClaudeSkillsToCodex `
        -ClaudeSkillsRoot 'C:\Users\admin\.claude\skills' `
        -ClaudePluginCacheRoot 'C:\Users\admin\.claude\plugins\cache' `
        -CodexSkillsRoot 'C:\Users\admin\.codex\skills' `
        -ManifestPath 'C:\Users\admin\.codex\manifests\claude-skill-bridge.json'

    $result | ConvertTo-Json -Depth 4
}
```

Add a short note to `C:\Users\admin\.codex\AGENTS.md` telling future sessions:

```markdown
Claude skill bridge: run `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\sync-claude-skills.ps1` to refresh Codex-visible skills mirrored from `C:\Users\admin\.claude`.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add C:/Users/admin/.codex/AGENTS.md C:/Users/admin/.codex/scripts/sync-claude-skills.ps1
git commit -m "docs: add codex claude bridge refresh guidance"
```

### Task 5: Final verification and inventory review

**Files:**
- Test: `C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
- Test: `C:\Users\admin\.codex\scripts\sync-claude-skills.ps1`

- [ ] **Step 1: Run bridge test suite**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\test-claude-skill-bridge.ps1`
Expected: PASS

- [ ] **Step 2: Run the sync script twice to verify idempotence**

Run: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\sync-claude-skills.ps1`
Expected: JSON summary with non-negative `Created`, `Updated`, `Removed`, and `Unchanged`

Run again: `powershell -ExecutionPolicy Bypass -File C:\Users\admin\.codex\scripts\sync-claude-skills.ps1`
Expected: mostly `Unchanged`

- [ ] **Step 3: Inspect generated bridge entries**

Run: `Get-ChildItem C:\Users\admin\.codex\skills | Where-Object { $_.Name -like 'claude-*' -or $_.LinkType -eq 'Junction' }`
Expected: includes bridge-created entries targeting `C:\Users\admin\.claude\skills` and `C:\Users\admin\.claude\plugins\cache`

- [ ] **Step 4: Verify Claude home was not modified**

Run: `Get-Item C:\Users\admin\.claude\skills, C:\Users\admin\.claude\plugins\cache | Select-Object FullName, LastWriteTime`
Expected: read-only inspection only; no bridge-generated files exist under those paths

- [ ] **Step 5: Commit**

```bash
git add C:/Users/admin/.codex/scripts/test-claude-skill-bridge.ps1 C:/Users/admin/.codex/scripts/sync-claude-skills.ps1 C:/Users/admin/.codex/manifests/claude-skill-bridge.json C:/Users/admin/.codex/AGENTS.md
git commit -m "feat: bridge claude skills into codex globally"
```
