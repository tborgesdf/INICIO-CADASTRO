param(
  [string]$BaseUrl = $(if ($env:BASE_URL) { $env:BASE_URL } else { 'https://inicio-cadastro.vercel.app' }),
  [string]$AdminToken = $(if ($env:ADMIN_TOKEN) { $env:ADMIN_TOKEN } else { '' })
)

$ErrorActionPreference = 'Stop'

function Out-Json($o) { $o | ConvertTo-Json -Depth 6 }

try {
  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $email = "e2e-$ts@example.com"
  $pwd = 'Test@12345!'

  # 1) Health
  $healthResp = Invoke-WebRequest -Uri "$BaseUrl/api/db-health" -TimeoutSec 45 -ErrorAction Stop
  $health = $healthResp.Content

  # 2) Register
  $regBody = @{ name='E2E QA'; email=$email; password=$pwd } | ConvertTo-Json
  $reg = Invoke-WebRequest -Uri "$BaseUrl/api/register" -Method POST -ContentType 'application/json' -Body $regBody -WebSession $session -TimeoutSec 60 -ErrorAction Stop

  # 3) Login
  $loginBody = @{ email=$email; password=$pwd } | ConvertTo-Json
  $login = Invoke-WebRequest -Uri "$BaseUrl/api/login" -Method POST -ContentType 'application/json' -Body $loginBody -WebSession $session -TimeoutSec 60 -ErrorAction Stop

  # 4) Save-user (envia x-admin-token se existir para diagnóstico detalhado em caso de erro)
  $saveBody = @{ 
    cpf='111.222.333-44'; phone='+55 61 99999-0001'; email=$email; visaType='renewal';
    location=@{ latitude=-15.79; longitude=-47.88 };
    socialMedia=@{ instagram='@e2e.qa'; linkedin='e2e-qa' };
    countries=@('Estados Unidos')
  } | ConvertTo-Json -Depth 4

  $headers = @{}
  if ($AdminToken) { $headers['x-admin-token'] = $AdminToken }

  try {
    $save = Invoke-WebRequest -Uri "$BaseUrl/api/save-user" -Method POST -ContentType 'application/json' -Body $saveBody -WebSession $session -Headers $headers -TimeoutSec 60 -ErrorAction Stop
    $saveStatus = $save.StatusCode; $saveBodyOut = $save.Content
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $saveStatus = $resp.StatusCode.value__
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $saveBodyOut = $reader.ReadToEnd()
    } else {
      $saveStatus = 0; $saveBodyOut = ($_ | Out-String)
    }
  }

  Out-Json ([PSCustomObject]@{
    ok = ($saveStatus -eq 200)
    base = $BaseUrl
    email = $email
    health = $health
    register = [PSCustomObject]@{ status = $reg.StatusCode; body = $reg.Content }
    login    = [PSCustomObject]@{ status = $login.StatusCode; body = $login.Content }
    save     = [PSCustomObject]@{ status = $saveStatus; body = $saveBodyOut }
  })
} catch {
  Out-Json ([PSCustomObject]@{ ok=$false; error=($_ | Out-String) })
  exit 1
}

