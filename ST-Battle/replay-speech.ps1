param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskLine = Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
$taskSynth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  if ($taskLine.speaker -eq 'captain') { $taskSynth.SelectVoice('Microsoft David Desktop') }
  else { $taskSynth.SelectVoice('Microsoft Zira Desktop') }
  $taskSynth.Rate = 0
  $taskSynth.Volume = 100
  $taskSynth.SetOutputToWaveFile($OutputFile)
  $taskSynth.Speak([string]$taskLine.text)
  $taskSynth.SetOutputToNull()
} finally { $taskSynth.Dispose() }
