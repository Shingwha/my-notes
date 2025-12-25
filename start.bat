@echo off
title My Notes Local Server

cls
echo.
echo ======================================
echo   My Notes - Local Server
echo ======================================
echo.
echo Checking environment...
echo.

:: Check Python
where python >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python detected
    goto :run_python
)

:: Check Python3
where python3 >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Python3 detected
    goto :run_python3
)

:: Check Node.js
where node >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Node.js detected
    goto :run_node
)

:: Not found
cls
echo.
echo ======================================
echo   [ERROR] No runtime found
echo ======================================
echo.
echo Please install one of:
echo.
echo   1. Python
echo      https://www.python.org/downloads/
echo      (Check "Add Python to PATH")
echo.
echo   2. Node.js
echo      https://nodejs.org/
echo.
pause
exit /b

:run_python
echo.
echo ======================================
echo   Starting server...
echo ======================================
echo.
echo URL: http://localhost:8080
echo Press Ctrl+C to stop
echo.
echo ======================================
echo.
python -m http.server 8080
goto :end

:run_python3
echo.
echo ======================================
echo   Starting server...
echo ======================================
echo.
echo URL: http://localhost:8080
echo Press Ctrl+C to stop
echo.
echo ======================================
echo.
python3 -m http.server 8080
goto :end

:run_node
echo.
echo ======================================
echo   Starting server...
echo ======================================
echo.
echo URL: http://localhost:8080
echo Press Ctrl+C to stop
echo.
echo ======================================
echo.
npx http-server -p 8080 -o
goto :end

:end
echo.
echo Server stopped
pause
