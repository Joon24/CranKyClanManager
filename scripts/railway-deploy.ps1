# Railway 배포 스크립트
# 사전: railway login 완료 필요

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvFile = Join-Path $Root "bot\.env"

Write-Host "=== CranKy Bot Railway Deploy ===" -ForegroundColor Cyan

Push-Location $Root

function Set-RailwayVar($Name, $Value) {
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($tmp, $Value)
    Get-Content $tmp -Raw | railway variables --set-from-stdin $Name | Out-Null
    Write-Host "  set $Name"
  } finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

try {
  railway whoami 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Railway 로그인 필요: railway login" -ForegroundColor Yellow
    exit 1
  }

  if (-not (Test-Path ".railway")) {
    Write-Host "Railway 프로젝트 생성/연결..."
    railway init --name cranky-clan-bot
  }

  railway service link cranky-clan-bot 2>$null

  Write-Host "환경 변수 등록..."
  $lines = Get-Content $EnvFile | Where-Object { $_ -match '^\s*[^#=]+\=' }
  foreach ($line in $lines) {
    if ($line -match '^\s*([^#=]+?)\s*=\s*(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim()
      if ($name -in @('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'APP_BASE_URL', 'BOT_API_PORT')) {
        continue
      }
      if ($name -and $value) {
        Set-RailwayVar $name $value
      }
    }
  }

  Set-RailwayVar "NODE_ENV" "production"
  Set-RailwayVar "APP_BASE_URL" "https://cranky-clan-web.vercel.app"

  Write-Host "배포 중..."
  railway up --detach

  Start-Sleep -Seconds 5
  railway domain 2>$null | Out-Null

  $domainOutput = railway domain 2>&1 | Out-String
  $botUrl = ($domainOutput | Select-String -Pattern 'https://[a-zA-Z0-9.-]+\.up\.railway\.app' -AllMatches).Matches |
    Select-Object -Last 1 -ExpandProperty Value

  if (-not $botUrl) {
    Write-Host "Railway URL 자동 확인 실패. 대시보드에서 Public URL 확인 후 Vercel BOT_API_URL 수동 설정." -ForegroundColor Yellow
    exit 0
  }

  $botUrl = $botUrl.TrimEnd('/')
  Write-Host "봇 URL: $botUrl" -ForegroundColor Green

  Push-Location (Join-Path $Root "web")
  vercel env rm BOT_API_URL production --yes 2>$null | Out-Null
  Set-Content -Path ([System.IO.Path]::GetTempFileName()) -Value $botUrl -NoNewline | Out-Null
  $tmp = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($tmp, $botUrl)
  Get-Content $tmp -Raw | vercel env add BOT_API_URL production --yes --force 2>$null | Out-Null
  Remove-Item $tmp -Force
  Pop-Location

  Write-Host "Vercel 재배포..."
  vercel --prod --yes | Out-Null
  Write-Host "완료! BOT_API_URL = $botUrl" -ForegroundColor Green
}
finally {
  Pop-Location
}
