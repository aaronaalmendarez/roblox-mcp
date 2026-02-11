function Call-Mcp($endpoint, $payload) {
  Invoke-RestMethod -Method Post -Uri ("http://localhost:3002/mcp/" + $endpoint) -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 20)
}

function Parse-ToolText($resp) {
  if ($resp.content -and $resp.content.Count -gt 0 -and $resp.content[0].text) {
    return ($resp.content[0].text | ConvertFrom-Json)
  }
  return $resp
}

$p = Start-Process -FilePath node -ArgumentList 'dist/index.js' -WorkingDirectory $repoRoot -PassThru
Start-Sleep -Seconds 3

$results = [ordered]@{}
try {
  $health = Invoke-RestMethod -Method Get -Uri 'http://localhost:3002/health' -TimeoutSec 5
  $status = Invoke-RestMethod -Method Get -Uri 'http://localhost:3002/status' -TimeoutSec 5
  $results.health_ok = $health.status
  $results.pluginConnected = $health.pluginConnected
  $results.mcpServerActive = $health.mcpServerActive
  $results.bridge_stats_present = ($null -ne $status.bridge)

  $testPath = 'game.ServerStorage.MCPToolSelfTest'
  try {
    Call-Mcp 'delete_object' @{ instancePath = $testPath } | Out-Null
  } catch {}

  $create = Parse-ToolText (Call-Mcp 'create_object' @{ className='Script'; parent='game.ServerStorage'; name='MCPToolSelfTest' })
  $results.create_success = $create.success

  $src1 = "local value = 1`nprint('selftest', value)"
  $set1 = Parse-ToolText (Call-Mcp 'set_script_source' @{ instancePath=$testPath; source=$src1 })
  $results.set_script_source = $set1.success

  $snap1 = Parse-ToolText (Call-Mcp 'get_script_snapshot' @{ instancePath=$testPath })
  $hash1 = $snap1.sourceHash
  $results.snapshot_hash_len = if($hash1){$hash1.Length}else{0}

  $ops = @(
    @{ op='insert'; afterLine=2; newContent='value = value + 4' },
    @{ op='replace'; startLine=1; endLine=1; newContent='local value = 2' }
  )
  $batch = Parse-ToolText (Call-Mcp 'batch_script_edits' @{ instancePath=$testPath; operations=$ops; expectedHash=$hash1; rollbackOnFailure=$true })
  $results.batch_success = $batch.success

  $srcAfter = Parse-ToolText (Call-Mcp 'get_script_source' @{ instancePath=$testPath })
  $results.batch_contains_insert = ($srcAfter.source -like '*value = value + 4*')
  $results.batch_contains_replace = ($srcAfter.source -like 'local value = 2*')

  $badFailed = $false
  try {
    Call-Mcp 'set_script_source_checked' @{ instancePath=$testPath; source="print('bad')"; expectedHash='deadbeef' } | Out-Null
  } catch {
    $badFailed = $true
  }
  $results.checked_bad_hash_rejected = $badFailed

  $snap2 = Parse-ToolText (Call-Mcp 'get_script_snapshot' @{ instancePath=$testPath })
  $good = Parse-ToolText (Call-Mcp 'set_script_source_checked' @{ instancePath=$testPath; source="print('checked ok')"; expectedHash=$snap2.sourceHash })
  $results.checked_good_hash_success = $good.success

  $final = Parse-ToolText (Call-Mcp 'get_script_source' @{ instancePath=$testPath })
  $results.final_source_ok = ($final.source -eq "print('checked ok')")

  $delete = Parse-ToolText (Call-Mcp 'delete_object' @{ instancePath=$testPath })
  $results.delete_success = $delete.success
}
finally {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}

$results | ConvertTo-Json -Depth 10
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
