param(
  [string]$taskLine = "Weapon's lock lost.",
  [ValidatePattern('^[a-z0-9-]+$')][string]$taskStem = 'allison-weapon-lock-lost'
)
$ErrorActionPreference = 'Stop'
# Match the existing offline Allison fallback: Microsoft Zira Desktop.
$taskRoot = $PSScriptRoot
$taskSource = Join-Path $taskRoot "exports/$taskStem-source.wav"
$taskVoice = New-Object -ComObject SAPI.SpVoice
$taskVoice.Voice = $taskVoice.GetVoices() | Where-Object { $_.GetDescription() -like '*Zira*' } | Select-Object -First 1
$taskStream = New-Object -ComObject SAPI.SpFileStream
try {
  $taskStream.Format.Type = 22
  $taskStream.Open($taskSource, 3)
  $taskVoice.AudioOutputStream = $taskStream
  $taskVoice.Rate = 0
  $taskVoice.Volume = 100
  [void]$taskVoice.Speak($taskLine, 0)
} finally { $taskStream.Close() }
if ((Get-Item -LiteralPath $taskSource).Length -le 44) { throw 'No speech was rendered.' }
Write-Output 'Rendered the local Allison fallback source.'
$taskPitch = (Get-Content (Join-Path $taskRoot 'exports/allison-synthesis-comparison.json') -Raw | ConvertFrom-Json).pitchRatio
$taskFfmpeg = Join-Path $env:LOCALAPPDATA 'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe'
$taskOutput = Join-Path $taskRoot "assets/voices/$taskStem.mp3"
$taskFilter = "rubberband=pitch=${taskPitch}:tempo=1.1:formant=preserved,loudnorm=I=-16:TP=-2:LRA=11"
& $taskFfmpeg -hide_banner -v error -y -i $taskSource -af $taskFilter -ar 48000 -c:a libmp3lame -q:a 2 $taskOutput
if ($LASTEXITCODE -ne 0) { throw 'Speech encoding failed.' }
& $taskFfmpeg -hide_banner -v error -i $taskOutput -f null -
if ($LASTEXITCODE -ne 0) { throw 'Speech audio validation failed.' }
Write-Output 'Saved and validated the Allison fallback MP3.'
