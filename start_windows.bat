@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 run.py
  if not errorlevel 1 exit /b 0
)
where python >nul 2>nul
if not errorlevel 1 (
  python run.py
  if not errorlevel 1 exit /b 0
)
echo.
echo Install Python 3.10 or newer, or run python run.py in Anaconda Prompt.
echo This game does not need pip install, Node.js, or NiceGUI.
pause
