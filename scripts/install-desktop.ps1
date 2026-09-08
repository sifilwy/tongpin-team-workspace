$ErrorActionPreference = 'Stop'
$edgePaths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$edgePath = $edgePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edgePath) { throw 'Microsoft Edge is required.' }
$agendaProfile = Join-Path $env:LOCALAPPDATA 'TongpinDesktop'
$agendaShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) '同频-xzx日程.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($agendaShortcut)
$shortcut.TargetPath = $edgePath
$shortcut.Arguments = '--user-data-dir="' + $agendaProfile + '" --app=https://yanxue-sync.top/desktop --window-size=480,940 --no-first-run'
$shortcut.Description = 'xzx 的桌面日程，每 15 秒与同频工作台同步'
$shortcut.IconLocation = $edgePath + ',0'
$shortcut.WorkingDirectory = Split-Path $edgePath
$shortcut.Save()
Write-Output $agendaShortcut
