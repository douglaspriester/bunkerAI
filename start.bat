@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title Bunker AI

echo.
echo  ____              _               _    ___
echo ^| __ ) _   _ _ __ ^| ^| _____ _ __  ^/ ^|  ^|_ _^|
echo ^|  _ \^| ^| ^| ^| '_ \^| ^|/ / _ \ '__^| ^|  ^|   ^| ^|
echo ^| ^|_) ^| ^|_^| ^| ^| ^| ^|   ^<  __/ ^|    ^|  ^|   ^| ^|
echo ^|____/ \__,_^|_^| ^|_^|_^|\_\___^|_^|    ^|  ^|  ^|___^|
echo.
echo  100%% Offline - DON'T PANIC
echo.

cd /d "%~dp0"

REM ---- Python check ----
set "PY="
if exist "venv\Scripts\python.exe" (set "PY=venv\Scripts\python.exe") else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (set "PY=python") else (
        echo [ERRO] Python nao encontrado. Instale Python 3.10+
        pause
        exit /b 1
    )
)
echo [OK] Python encontrado

REM ---- Venv: use existing or create once ----
if not exist "venv\Scripts\activate.bat" (
    echo [..] Criando ambiente virtual (unica vez^)...
    python -m venv venv
    call venv\Scripts\activate.bat
    echo [..] Instalando dependencias (unica vez^)...
    pip install -q -r requirements.txt 2>nul
    echo [OK] Ambiente configurado
) else (
    call venv\Scripts\activate.bat
    echo [OK] Ambiente virtual ativado
)

REM ---- Data dirs ----
if not exist "data\db" mkdir "data\db" 2>nul
if not exist "static\maps" mkdir "static\maps" 2>nul
if not exist "kokoro_models" mkdir "kokoro_models" 2>nul
if not exist "generated_apps" mkdir "generated_apps" 2>nul
if not exist "tts_cache" mkdir "tts_cache" 2>nul

REM ---- Ollama ----
echo [..] Verificando Ollama...
set OLLAMA_OK=0
curl -s --max-time 2 http://localhost:11434/api/tags >nul 2>&1
if !errorlevel! equ 0 (
    set OLLAMA_OK=1
) else (
    where ollama >nul 2>&1
    if !errorlevel! equ 0 (
        echo [..] Iniciando Ollama...
        start "" /b ollama serve >nul 2>&1
        timeout /t 5 /nobreak >nul
        curl -s --max-time 2 http://localhost:11434/api/tags >nul 2>&1
        if !errorlevel! equ 0 set OLLAMA_OK=1
    )
)

if !OLLAMA_OK! equ 1 (
    echo [OK] Ollama rodando
) else (
    echo [!!] Ollama nao encontrado. Chat IA indisponivel.
    echo      Instale: https://ollama.ai
)

REM ---- Launch ----
echo.
echo ================================================================
echo   Bunker AI rodando em: http://localhost:8888
echo   Ctrl+C para parar
echo ================================================================
echo.

start "" "http://localhost:8888"
python -m uvicorn server:app --host 0.0.0.0 --port 8888

echo.
echo [!!] Servidor parou.
pause
exit /b 0
