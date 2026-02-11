function Call-Mcp($endpoint, $payload) {
  Invoke-RestMethod -Method Post -Uri ("http://localhost:3002/mcp/" + $endpoint) -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 20)
}

function Parse-ToolText($resp) {
  if ($resp.content -and $resp.content.Count -gt 0 -and $resp.content[0].text) {
    return ($resp.content[0].text | ConvertFrom-Json)
  }
  return $resp
}

$testPath = 'game.ServerStorage.BatchDbg'
try { Call-Mcp 'delete_object' @{ instancePath = $testPath } | Out-Null } catch {}

Parse-ToolText (Call-Mcp 'create_object' @{ className='Script'; parent='game.ServerStorage'; name='BatchDbg' }) | Out-Null

$seed = "local value = 1`nprint('seed', value)"
Parse-ToolText (Call-Mcp 'set_script_source' @{ instancePath=$testPath; source=$seed }) | Out-Null

$snap = Parse-ToolText (Call-Mcp 'get_script_snapshot' @{ instancePath=$testPath })

$ops = @(
  @{ op='insert'; afterLine=2; newContent='value = value + 4' },
  @{ op='replace'; startLine=1; endLine=1; newContent='local value = 2' }
)

$batch = Parse-ToolText (Call-Mcp 'batch_script_edits' @{ instancePath=$testPath; operations=$ops; expectedHash=$snap.sourceHash; rollbackOnFailure=$true })
$after = Parse-ToolText (Call-Mcp 'get_script_source' @{ instancePath=$testPath })

[ordered]@{
  batch = $batch
  source = $after.source
  numbered = $after.numberedSource
} | ConvertTo-Json -Depth 10

Parse-ToolText (Call-Mcp 'delete_object' @{ instancePath=$testPath }) | Out-Null
