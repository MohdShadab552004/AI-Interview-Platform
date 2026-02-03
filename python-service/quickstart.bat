@echo off
REM IAIS Quick Start Script for Windows
REM This script helps you get started with the IAIS system

echo ========================================================================
echo IAIS - Intelligent AI-Powered Interview System
echo Quick Start Script
echo ========================================================================
echo.

REM Check Python installation
echo [1/4] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.9 or higher from https://www.python.org/
    pause
    exit /b 1
)
python --version
echo.

REM Check if in correct directory
if not exist "requirements.txt" (
    echo ERROR: requirements.txt not found
    echo Please run this script from the python-service directory
    pause
    exit /b 1
)

REM Install dependencies
echo [2/4] Installing dependencies...
echo This may take a few minutes...
echo.
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

REM Check for Gemini API key
echo [3/4] Checking Gemini API key...
if "%GEMINI_API_KEY%"=="" (
    echo WARNING: GEMINI_API_KEY environment variable not set
    echo.
    echo To set it temporarily for this session:
    echo   set GEMINI_API_KEY=your-api-key-here
    echo.
    echo To set it permanently:
    echo   setx GEMINI_API_KEY "your-api-key-here"
    echo.
    echo Get your API key from: https://makersuite.google.com/app/apikey
    echo.
    set /p continue="Continue without API key? (y/n): "
    if /i not "%continue%"=="y" (
        pause
        exit /b 1
    )
) else (
    echo Gemini API key is set
)
echo.

REM Run installation test
echo [4/4] Running installation test...
echo.
python test_installation.py
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Some tests failed. Please review the output above.
    echo.
)

echo.
echo ========================================================================
echo Setup Complete!
echo ========================================================================
echo.
echo You can now run the IAIS system:
echo.
echo   1. Test individual modules:
echo      python grcda_module.py       - Test gaze tracking
echo      python safas_module.py       - Test stress detection
echo      python mmfdf_module.py       - Test fusion engine
echo      python ccaqe_module.py       - Test adaptive questioning
echo.
echo   2. Run complete system:
echo      python iais_main.py
echo.
echo For more information, see README.md
echo ========================================================================
echo.

pause
