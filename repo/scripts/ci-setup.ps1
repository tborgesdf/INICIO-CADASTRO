<#!
Safe CI/CD bootstrap for Windows PowerShell

What it does (idempotent):
- Verifies required CLIs: git, gh (GitHub CLI)
- Sets GitHub Secrets for DB_* and optional VERCEL_DEPLOY_HOOK using your GITHUB_TOKEN
- Commits the CI/CD and API health files if pending and pushes to main

Usage (example):
  $env:GITHUB_TOKEN = "<your_github_pat>"  # scope: repo
  $repo = "<owner>/<repo>"                 # e.g. tborgesdf/INICIO-CADASTRO
  $dbHost = "50.116.112.154"
  $dbUser = "deltafox_visto"
  $dbPass = "Ale290800-####$2"
  $dbName = "deltafox_visto"
  ./repo/scripts/ci-setup.ps1 -Repo $repo -DB_HOST $dbHost -DB_USER $dbUser -DB_PASSWORD $dbPass -DB_NAME $dbName

Notes:
- Never hard-code credentials in files. Use env vars or CLI prompts.
- Vercel env vars devem ser criadas no painel da Vercel (já estão no seu projeto).
#>

param(
  [Parameter(Mandatory=$true)] [string] $Repo,
  [Parameter(Mandatory=$true)] [string] $DB_HOST,
  [Parameter(Mandatory=$true)] [string] $DB_USER,
  [Parameter(Mandatory=$true)] [string] $DB_PASSWORD,
  [Parameter(Mandatory=$true)] [string] $DB_NAME,
  [string] $VercelDeployHook
)

function Fail($msg) { Write-Error $msg; exit 1 }

# Safety: require GitHub token via env var
if (-not $env:GITHUB_TOKEN) { Fail "Set GITHUB_TOKEN environment variable (GitHub PAT with 'repo' scope)." }

# Check required CLIs
foreach($cmd in @('git','gh')){
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Fail "Missing '$cmd'. Install: winget install Git.Git; winget install GitHub.cli" }
}

Write-Host "Setting GitHub Secrets in $Repo ..."
gh auth status --show-token 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  $env:GH_TOKEN = $env:GITHUB_TOKEN
}

# Set secrets (create or update)
gh secret set DB_HOST -b "$DB_HOST" -R "$Repo" | Out-Host
gh secret set DB_USER -b "$DB_USER" -R "$Repo" | Out-Host
gh secret set DB_PASSWORD -b "$DB_PASSWORD" -R "$Repo" | Out-Host
gh secret set DB_NAME -b "$DB_NAME" -R "$Repo" | Out-Host
if ($VercelDeployHook) { gh secret set VERCEL_DEPLOY_HOOK -b "$VercelDeployHook" -R "$Repo" | Out-Host }

Write-Host "Committing CI/CD and API health files (if any changes)..."
git add repo/api/db-health.ts repo/vercel.json .github/workflows/ci-cd.yml repo/scripts/migrate.cjs repo/sql/migrations repo/sql/schema.sql repo/package.json repo/CI-CD.md 2>$null
git commit -m "chore(ci): add health, migrations, workflow" 2>$null
git push origin main

Write-Host "Done. GitHub Actions will run migrations; Vercel will auto-deploy."

