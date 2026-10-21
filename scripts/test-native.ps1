param([string]$PgBin = 'C:\Program Files\PostgreSQL\16\bin')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$testRoot = Join-Path $projectRoot '.local-test'
$dataPath = Join-Path $testRoot 'pgdata'
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
function Invoke-Pg([string]$Program, [string[]]$Arguments) {
  & (Join-Path $PgBin $Program) @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)" }
}
if (!(Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) {
  Invoke-Pg 'initdb.exe' @('-D',$dataPath,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C')
}
# Loopback-only disposable cluster. Never reads linked project or cloud credentials.
$started = $false
try {
  Invoke-Pg 'pg_ctl.exe' @('-D',$dataPath,'-l',(Join-Path $testRoot 'postgres.log'),'-o','-p 55439 -h 127.0.0.1','-w','start')
  $started = $true
  foreach ($pass in 1..2) {
    $dbName = 'docenti_' + [guid]::NewGuid().ToString('N')
    Invoke-Pg 'createdb.exe' @('-h','127.0.0.1','-p','55439','-U','postgres',$dbName)
    $pgArgs = @('-X','-h','127.0.0.1','-p','55439','-U','postgres','-d',$dbName,'-v','ON_ERROR_STOP=1')
    Invoke-Pg 'psql.exe' ($pgArgs + @('-f','scripts/native-bootstrap.sql'))
    Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | ForEach-Object {
      Invoke-Pg 'psql.exe' ($pgArgs + @('-f',$_.FullName))
    }
    Invoke-Pg 'psql.exe' ($pgArgs + @('-f','supabase/seed.sql'))
    Invoke-Pg 'psql.exe' ($pgArgs + @('-f','scripts/integration.sql'))
    & (Join-Path $PSScriptRoot 'test-concurrency.ps1') -DbName $dbName -PgBin $PgBin
    Write-Output "PASS $pass : clean migration, seed, integration and concurrent writers"
  }
} finally {
  if ($started) { & (Join-Path $PgBin 'pg_ctl.exe') -D $dataPath -m fast -w stop }
}
