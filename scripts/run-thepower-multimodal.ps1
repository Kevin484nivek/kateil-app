param(
  [string]$SourceRoot = "C:\Users\kevin\Documents\ThePower",
  [string]$OutputRoot = "C:\Users\kevin\Documents\Playground\data\thepower\multimodal",
  [int]$MaxSources = 3,
  [int]$SkipSources = 0,
  [int]$ChunkSeconds = 20,
  [string]$WhisperModel = "small",
  [int]$FirstWindowSeconds = 30,
  [int]$FrameEverySecondsEarly = 3,
  [int]$FrameEverySecondsLate = 15
)

$ErrorActionPreference = "Stop"
$py = "C:\Users\kevin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

& $py "C:\Users\kevin\Documents\Playground\scripts\extract-thepower-multimodal.py" `
  --source-root $SourceRoot `
  --output-root $OutputRoot `
  --max-sources $MaxSources `
  --skip-sources $SkipSources `
  --chunk-seconds $ChunkSeconds `
  --whisper-model $WhisperModel `
  --first-window-seconds $FirstWindowSeconds `
  --frame-every-seconds-early $FrameEverySecondsEarly `
  --frame-every-seconds-late $FrameEverySecondsLate
