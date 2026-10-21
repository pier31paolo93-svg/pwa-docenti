param([Parameter(Mandatory=$true)][string]$DbName,[Parameter(Mandatory=$true)][string]$PgBin)
$ErrorActionPreference = 'Stop'
if ($DbName -notmatch '^docenti_[a-f0-9]{32}$') { throw 'Disposable database name required' }
$testRoot = Join-Path (Split-Path $PSScriptRoot -Parent) '.local-test'
$aOut = Join-Path $testRoot 'concurrent-a.out'
$aErr = Join-Path $testRoot 'concurrent-a.err'
$bOut = Join-Path $testRoot 'concurrent-b.out'
$bErr = Join-Path $testRoot 'concurrent-b.err'
$common = @('-X','-h','127.0.0.1','-p','55439','-U','postgres','-d',$DbName,'-v','ON_ERROR_STOP=1')
$procA = Start-Process -FilePath (Join-Path $PgBin 'psql.exe') -ArgumentList ($common + @('-f','scripts/concurrent-a.sql')) -WindowStyle Hidden -PassThru -RedirectStandardOutput $aOut -RedirectStandardError $aErr
$null = $procA.Handle
$deadline = [DateTime]::UtcNow.AddSeconds(20)
while ([DateTime]::UtcNow -lt $deadline) {
  if ((Test-Path $aOut) -and (Get-Content $aOut -Raw) -match 'UPDATE_HELD') { break }
  if ($procA.HasExited) { throw 'Concurrent writer A ended before acquiring lock' }
  Start-Sleep -Milliseconds 100
}
if ([DateTime]::UtcNow -ge $deadline) { throw 'Writer A lock timeout' }
$procB = Start-Process -FilePath (Join-Path $PgBin 'psql.exe') -ArgumentList ($common + @('-f','scripts/concurrent-b.sql')) -WindowStyle Hidden -PassThru -RedirectStandardOutput $bOut -RedirectStandardError $bErr
$null = $procB.Handle
$procA.WaitForExit(); $procB.WaitForExit()
if ($procA.ExitCode -ne 0) { throw 'Concurrent writer A failed' }
if ($procB.ExitCode -eq 0 -or (Get-Content $bErr -Raw) -notmatch '40001') { throw 'Expected SQLSTATE 40001 for concurrent writer B' }
$value = & (Join-Path $PgBin 'psql.exe') @common -At -c "select count(*) from public.students s join public.workspaces w on w.id=s.workspace_id where w.owner_id='11111111-1111-4111-8111-111111111111' and s.external_code='TEST-1-1' and s.first_name='Concurrent A' and s.version=2"
if ($LASTEXITCODE -ne 0 -or "$value".Trim() -ne '1') { throw 'Concurrent write overwrote a newer revision' }
Write-Output 'PASS concurrency: writer A committed, writer B rejected with 40001, winner preserved'
