<#!
Automated resolve-merge + deploy + health-check for Vercel

Requirements:
- git, gh (GitHub CLI), Node/npm installed
- gh auth login already done

Usage example:
  ./scripts/auto-merge-deploy.ps1 `
    -Repo "tborgesdf/INICIO-CADASTRO" `
    -Branch "fix-vercel-config" `
    -DeployHook "https://api.vercel.com/v1/integrations/deploy/xxxx/xxxx" `
    -HealthUrl "https://inicio-cadastro.vercel.app/api/db-health"

Notes:
- Keeps devDependency "@vercel/node" and removes root vercel.json if present
- Regenerates package-lock.json and commits the result
- Creates PR if missing and merges with --merge (fast-forward disabled)
- Triggers Vercel deploy hook and polls the health endpoint until OK
#>

param(
  [Parameter(Mandatory=$true)] [string] $Repo,
  [string] $Branch = 'fix-vercel-config',
  [Parameter(Mandatory=$true)] [string] $DeployHook,
  [Parameter(Mandatory=$true)] [string] $HealthUrl,
  [int] $HealthTimeoutSeconds = 240,
  [int] $HealthIntervalSeconds = 10
)

$ErrorActionPreference = 'Stop'

function Ensure-Cli($name, $install) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing '$name'. Install: $install"
  }
}

Ensure-Cli git 'winget install Git.Git'
Ensure-Cli gh  'winget install GitHub.cli'
Ensure-Cli npm 'https://nodejs.org/en/download/'

try {
  gh auth status 1>$null 2>$null
} catch {
  throw 'Run: gh auth login (and authenticate with a PAT)'
}

gh repo set-default $Repo | Out-Host

# 1) Checkout working branch and merge main
git fetch origin | Out-Host
try {
  git rev-parse --verify $Branch 1>$null 2>$null
  git checkout $Branch | Out-Host
} catch {
  git checkout -b $Branch origin/main | Out-Host
}

# Merge origin/main; keep going if conflicts to resolve below
git merge origin/main -m "merge origin/main into $Branch" --no-edit 2>$null | Out-Host

# 2) Ensure @vercel/node and remove vercel.json if present
if (Test-Path vercel.json) {
  git rm -f vercel.json | Out-Host
}

if (Test-Path package.json) {
  $pkgText = Get-Content package.json -Raw
  $pkg = $pkgText | ConvertFrom-Json
  if (-not $pkg.devDependencies) { $pkg | Add-Member -NotePropertyName devDependencies -NotePropertyValue @{} }
  if (-not $pkg.devDependencies.'@vercel/node') { $pkg.devDependencies.'@vercel/node' = '^3.0.0' }
  ($pkg | ConvertTo-Json -Depth 100) | Set-Content package.json -NoNewline
}

# If a merge is in progress, prefer our version for these files
if (Test-Path .git\MERGE_HEAD) {
  git checkout --ours package.json 2>$null
  git checkout --ours package-lock.json 2>$null
}

# 3) Install to refresh lockfile and stage changes
npm install | Out-Host
git add package.json 2>$null
if (Test-Path package-lock.json) { git add package-lock.json 2>$null }

$changes = git status --porcelain
if ($changes) {
  git commit -m "fix(ci): keep @vercel/node types, remove vercel.json, refresh lock" | Out-Host
}

# 4) Push and create/merge PR
git push -u origin $Branch | Out-Host

try {
  gh pr view $Branch 1>$null 2>$null
} catch {
  gh pr create --fill --base main --head $Branch | Out-Host
}

# Try auto-merge; if branch protection blocks, it will remain open
gh pr merge $Branch --merge --auto | Out-Host

# 5) Trigger Vercel deploy and poll health
Write-Host "Triggering Vercel deploy via hook..."
try {
  Invoke-WebRequest -UseBasicParsing -Method POST -Uri $DeployHook | Out-Null
} catch { Write-Warning "Deploy hook call failed: $($_.Exception.Message)" }

Write-Host "Waiting for health at $HealthUrl ..."
$deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $HealthUrl -TimeoutSec 20
    if ($resp.StatusCode -eq 200 -and $resp.Content -match '"ok"\s*:\s*true') {
      Write-Host "Health OK:" $resp.Content
      exit 0
    }
  } catch { }
  Start-Sleep -Seconds $HealthIntervalSeconds
}

throw "Health check did not return ok:true within $HealthTimeoutSeconds seconds."

