Set WshShell = CreateObject("WScript.Shell")
strDir = WshShell.CurrentDirectory
WshShell.Run """" & strDir & "\dist-win\SoundPulseStudio-win32-x64\SoundPulseStudio.exe""", 0, False
