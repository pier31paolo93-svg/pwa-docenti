$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
$dockerDir = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin'
if (Test-Path -LiteralPath $dockerDir) { $env:Path = "$dockerDir;$env:Path" }
$dockerExe = (Get-Command docker -ErrorAction Stop).Source
$container = 'supabase_db_pwa-docenti-local'
$testRoot = Join-Path (Get-Location) '.local-test'
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
function Invoke-Checked([string]$Exe,[string[]]$Arguments) {
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Exe failed: $LASTEXITCODE" }
}
Invoke-Checked 'node' @('scripts/generate-pgtap.mjs','--check')
Invoke-Checked $dockerExe @('inspect','--format','{{.Name}}',$container)
for ($pass = 1; $pass -le 2; $pass++) {
  # --local is mandatory; no project linking, cloud URL or cloud credentials.
  Invoke-Checked 'npx.cmd' @('--no-install','supabase','db','reset','--local')
  $version = & $dockerExe exec $container psql -X -U postgres -d postgres -At -c 'show server_version_num'
  if ($LASTEXITCODE -ne 0 -or [int]$version -lt 170000 -or [int]$version -ge 180000) { throw 'PostgreSQL 17 required' }
  Write-Output "PostgreSQL server_version_num=$version"
  Invoke-Checked 'npx.cmd' @('--no-install','supabase','test','db')
  Invoke-Checked 'npx.cmd' @('--no-install','supabase','db','lint','--local','--schema','public,private','--level','warning','--fail-on','warning')
  foreach ($file in @('integration.sql','concurrent-a.sql','concurrent-b.sql')) {
    Invoke-Checked $dockerExe @('cp',(Join-Path $PSScriptRoot $file),"${container}:/tmp/docenti-$file")
  }
  $common = @('exec',$container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1')
  Invoke-Checked $dockerExe ($common + @('-f','/tmp/docenti-integration.sql'))
  $aOut = Join-Path $testRoot 'supabase-concurrent-a.out'
  $aErr = Join-Path $testRoot 'supabase-concurrent-a.err'
  $bOut = Join-Path $testRoot 'supabase-concurrent-b.out'
  $bErr = Join-Path $testRoot 'supabase-concurrent-b.err'
  $procA = Start-Process -FilePath $dockerExe -ArgumentList ($common + @('-f','/tmp/docenti-concurrent-a.sql')) -WindowStyle Hidden -PassThru -RedirectStandardOutput $aOut -RedirectStandardError $aErr
  $null = $procA.Handle
  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ((Test-Path $aOut) -and (Get-Content $aOut -Raw) -match 'UPDATE_HELD') { break }
    if ($procA.HasExited) { throw 'Writer A failed before acquiring lock' }
    Start-Sleep -Milliseconds 100
  }
  if ([DateTime]::UtcNow -ge $deadline) { throw 'Writer A lock timeout' }
  $procB = Start-Process -FilePath $dockerExe -ArgumentList ($common + @('-f','/tmp/docenti-concurrent-b.sql')) -WindowStyle Hidden -PassThru -RedirectStandardOutput $bOut -RedirectStandardError $bErr
  $null = $procB.Handle
  $procA.WaitForExit(); $procB.WaitForExit()
  if ($procA.ExitCode -ne 0) { throw 'Writer A failed' }
  if ($procB.ExitCode -eq 0 -or (Get-Content $bErr -Raw) -notmatch '40001') { throw 'Expected 40001 for writer B' }
  $result = & $dockerExe @common -At -c "select count(*) from public.students s join public.workspaces w on w.id=s.workspace_id where w.owner_id='11111111-1111-4111-8111-111111111111' and s.external_code='TEST-1-1' and s.first_name='Concurrent A' and s.version=2"
  if ($LASTEXITCODE -ne 0 -or "$result".Trim() -ne '1') { throw 'Newer revision overwritten' }
  Write-Output "PASS Supabase PG17 cycle $pass : 81 pgTAP + 69 SQL + concurrent writers + lint"
}
