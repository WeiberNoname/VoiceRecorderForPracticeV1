$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "SoundPulse Studio.lnk"
$TargetPath = "C:\Users\space\.gemini\antigravity-ide\scratch\voice-recorder-app\dist-win\SoundPulseStudio-win32-x64\SoundPulseStudio.exe"
$WorkingDir = "C:\Users\space\.gemini\antigravity-ide\scratch\voice-recorder-app\dist-win\SoundPulseStudio-win32-x64"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $WorkingDir
$Shortcut.Description = "SoundPulse Studio Pro - Voice & Audio Recorder for Windows"
$Shortcut.Save()

Write-Host "Desktop shortcut created successfully at $ShortcutPath"
