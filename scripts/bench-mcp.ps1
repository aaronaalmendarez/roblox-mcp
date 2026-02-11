function Call-Mcp($endpoint, $payload) {
  return Invoke-RestMethod -Method Post -Uri ("http://localhost:3002/mcp/" + $endpoint) -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 30)
}

function Parse-ToolText($resp) {
  if ($resp.content -and $resp.content.Count -gt 0 -and $resp.content[0].text) {
    return ($resp.content[0].text | ConvertFrom-Json)
  }
  return $resp
}

$ErrorActionPreference = 'Stop'

$startedServer = $null
try {
  $health = Invoke-RestMethod -Uri 'http://localhost:3002/health' -Method Get -TimeoutSec 2
} catch {
  $startedServer = Start-Process -FilePath node -ArgumentList 'dist/index.js' -WorkingDirectory 'C:\Users\aaron\OneDrive\Desktop\rblxMCP' -PassThru
  Start-Sleep -Seconds 3
  $health = Invoke-RestMethod -Uri 'http://localhost:3002/health' -Method Get -TimeoutSec 3
}
if ($health.status -ne 'ok') { throw "MCP health is not OK." }

$ready = $false
for ($i = 0; $i -lt 20; $i++) {
  $h = Invoke-RestMethod -Uri 'http://localhost:3002/health' -Method Get -TimeoutSec 2
  if ($h.pluginConnected -and $h.mcpServerActive) {
    $ready = $true
    break
  }
  Start-Sleep -Milliseconds 500
}
if (-not $ready) {
  throw "Studio plugin is not connected. Open Studio and enable MCP plugin before benchmarking."
}

$testPath = 'game.ServerStorage.MCPBenchScript'
try { Call-Mcp 'delete_object' @{ instancePath = $testPath } | Out-Null } catch {}

$create = Parse-ToolText (Call-Mcp 'create_object' @{ className='Script'; parent='game.ServerStorage'; name='MCPBenchScript' })
if (-not $create.success) { throw "Failed to create benchmark script." }

$lines = @()
for ($i = 1; $i -le 400; $i++) {
  $lines += ("local v{0} = {0}" -f $i)
}
$lines += "print('bench ready')"
$seedSource = [string]::Join("`n", $lines)
(Parse-ToolText (Call-Mcp 'set_script_source' @{ instancePath=$testPath; source=$seedSource })) | Out-Null

# 1) Read benchmark
$readCount = 25
$readMs = (Measure-Command {
  for ($i = 0; $i -lt $readCount; $i++) {
    Call-Mcp 'get_script_source' @{ instancePath=$testPath } | Out-Null
  }
}).TotalMilliseconds

# 2) Single edit benchmark (10 separate edits)
$singleEditCount = 10
$singleEditMs = (Measure-Command {
  for ($i = 0; $i -lt $singleEditCount; $i++) {
    $line = 50 + $i
    Call-Mcp 'edit_script_lines' @{
      instancePath = $testPath
      startLine = $line
      endLine = $line
      newContent = ("local v{0} = {0} -- edited-single" -f $line)
    } | Out-Null
  }
}).TotalMilliseconds

# reset source
(Parse-ToolText (Call-Mcp 'set_script_source' @{ instancePath=$testPath; source=$seedSource })) | Out-Null

# 3) Batch edit benchmark (same 10 edits in one call)
$snapshot = Parse-ToolText (Call-Mcp 'get_script_snapshot' @{ instancePath=$testPath })
$ops = @()
for ($i = 0; $i -lt $singleEditCount; $i++) {
  $line = 50 + $i
  $ops += @{
    op = 'replace'
    startLine = $line
    endLine = $line
    newContent = ("local v{0} = {0} -- edited-batch" -f $line)
  }
}

$batchMs = (Measure-Command {
  Call-Mcp 'batch_script_edits' @{
    instancePath = $testPath
    expectedHash = $snapshot.sourceHash
    rollbackOnFailure = $true
    operations = $ops
  } | Out-Null
}).TotalMilliseconds

$after = Parse-ToolText (Call-Mcp 'get_script_source' @{ instancePath = $testPath })
$batchVerified = ($after.source -like '*edited-batch*')

# cleanup
(Parse-ToolText (Call-Mcp 'delete_object' @{ instancePath=$testPath })) | Out-Null

$result = [ordered]@{
  health = $health.status
  reads = @{
    count = $readCount
    total_ms = [math]::Round($readMs, 2)
    avg_ms = [math]::Round($readMs / $readCount, 2)
  }
  single_edits = @{
    count = $singleEditCount
    total_ms = [math]::Round($singleEditMs, 2)
    avg_ms = [math]::Round($singleEditMs / $singleEditCount, 2)
  }
  batch_edits = @{
    count = $singleEditCount
    total_ms = [math]::Round($batchMs, 2)
    avg_ms_per_edit = [math]::Round($batchMs / $singleEditCount, 2)
    verified = $batchVerified
  }
  speedup_vs_single_total = [math]::Round(($singleEditMs / $batchMs), 2)
}

$result | ConvertTo-Json -Depth 10

if ($startedServer) {
  Stop-Process -Id $startedServer.Id -Force -ErrorAction SilentlyContinue
}
