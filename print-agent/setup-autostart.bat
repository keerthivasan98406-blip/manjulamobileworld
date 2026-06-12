@echo off
title Manjula Print Agent - Auto Start Setup

echo.
echo =============================================
echo   Setting up Print Agent to Auto-Start
echo =============================================
echo.

:: Get the full path to start-agent.bat
set AGENT_PATH=%~dp0start-agent.bat

:: Path to Windows startup folder
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

:: Create a VBScript to launch agent minimized (no black window)
set VBS_FILE=%STARTUP_FOLDER%\ManjulaPrintAgent.vbs
echo Set WShell = CreateObject("WScript.Shell") > "%VBS_FILE%"
echo WShell.Run Chr(34) ^& "%AGENT_PATH%" ^& Chr(34), 7, False >> "%VBS_FILE%"

echo.
echo ✅ Done! Print Agent will now start automatically.
echo.
echo Location: %VBS_FILE%
echo.
echo The agent starts silently in background (no window shown).
echo.
pause
