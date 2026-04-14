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
echo  100%% Offline — DON'T PANIC
echo.

cd /d "%~dp0"

REM ═══════════════════════════════════════════════════════════
REM  Detect installation state
REM ═══════════════════════════════════════════════════════════
set "INSTALLED=0"
if exist "venv\Scripts\activate.bat" set "INSTALLED=1"

REM Check if venv exists but was created on another OS (USB portability)
if "!INSTALLED!"=="0" (
    if exist "venv\bin\activate" (
        echo [!!] Ambiente virtual de outro sistema detectado (Linux/Mac^)
        echo [..] Recriando venv para Windows (modelos e dados mantidos^)...
        rmdir /s /q "venv" 2>nul
        goto :install
    )
)

REM If already installed, go straight to launch (fast boot)
if "!INSTALLED!"=="1" goto :fast_boot

REM ═══════════════════════════════════════════════════════════
REM  First run / Menu
REM ═══════════════════════════════════════════════════════════
:menu
echo ================================================================
echo   O que deseja fazer?
echo ================================================================
echo.
echo   [1] Instalar Bunker AI (primeira vez)
echo   [2] Instalar em pendrive/USB (100%% offline com modelos)
echo   [3] Reinstalar (corrigir instalacao corrompida)
echo   [4] Sair
echo.
set /p "CHOICE=  Escolha [1-4]: "

if "!CHOICE!"=="1" goto :install
if "!CHOICE!"=="2" goto :install_usb
if "!CHOICE!"=="3" goto :reinstall
if "!CHOICE!"=="4" exit /b 0
echo  [!!] Opcao invalida.
goto :menu

REM ═══════════════════════════════════════════════════════════
REM  INSTALL — First time setup
REM ═══════════════════════════════════════════════════════════
:install
echo.
echo [..] Verificando Python...
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERRO] Python nao encontrado. Instale Python 3.10+: https://python.org
    pause
    exit /b 1
)
echo [OK] Python encontrado

echo [..] Criando ambiente virtual...
python -m venv venv
call venv\Scripts\activate.bat

echo [..] Instalando dependencias...
pip install -q --upgrade pip 2>nul

REM ── Grupo 1: deps CRITICAS (servidor nao sobe sem elas) ──
echo [..] Instalando nucleo do servidor...
pip install fastapi uvicorn httpx python-multipart aiosqlite psutil
python -c "import uvicorn, httpx, fastapi" 2>nul
if !errorlevel! neq 0 (
    echo [ERRO] Dependencias criticas falharam. Verifique sua conexao ou Python.
    pause
    exit /b 1
)
echo [OK] Nucleo do servidor instalado

REM ── Grupo 2: deps OPCIONAIS (voz, extras) ──
echo [..] Instalando recursos extras...
for %%P in (edge-tts pyttsx3 soundfile aiosqlite) do (
    pip install -q %%P 2>nul || echo [--] %%P: falhou (recurso opcional^)
)

REM ── Grupo 3: deps PESADAS (compilacao C++ — podem falhar) ──
echo [..] Instalando modelos locais (pode demorar)...
for %%P in (faster-whisper kokoro-onnx llama-cpp-python) do (
    pip install -q %%P 2>nul || echo [--] %%P: falhou (ok — use Ollama^)
)

echo [OK] Dependencias instaladas

call :create_dirs

REM ── Verify emergency model ──
if exist "models\qwen2.5-0.5b-instruct-q4_k_m.gguf" (
    echo [OK] Modelo de emergencia presente (469 MB)
) else (
    echo [!!] Modelo de emergencia nao encontrado em models/
    echo [..] Baixando modelo de emergencia (~469MB)...
    python -c "import urllib.request,os;os.makedirs('models',exist_ok=True);urllib.request.urlretrieve('https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf','models/qwen2.5-0.5b-instruct-q4_k_m.gguf');print('[OK] Modelo de emergencia pronto')"
)

echo.
echo ================================================================
echo   Deseja baixar modelos ADICIONAIS? (melhor qualidade offline)
echo ================================================================
echo.
echo   [S] Sim — escolher modelos extras (uncensored, vision, code...)
echo   [N] Nao — usar so o modelo de emergencia por agora
echo.
set /p "DL_CHOICE=  Escolha [S/N]: "
if /i "!DL_CHOICE!"=="s" (
    python tools\prepare_usb.py
)

echo.
echo ================================================================
echo   Instalacao concluida! Iniciando Bunker AI...
echo ================================================================
echo.
goto :launch

REM ═══════════════════════════════════════════════════════════
REM  INSTALL USB — Pendrive 100% offline (download models)
REM ═══════════════════════════════════════════════════════════
:install_usb
echo.
echo [..] Verificando Python...
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERRO] Python nao encontrado. Instale Python 3.10+
    pause
    exit /b 1
)
echo [OK] Python encontrado

echo [..] Criando ambiente virtual...
python -m venv venv
call venv\Scripts\activate.bat

echo [..] Instalando dependencias...
pip install -q --upgrade pip 2>nul
echo [..] Instalando nucleo do servidor...
pip install fastapi uvicorn httpx python-multipart aiosqlite psutil
echo [..] Instalando recursos extras...
for %%P in (edge-tts pyttsx3 soundfile aiosqlite) do (
    pip install -q %%P 2>nul || echo [--] %%P: falhou (recurso opcional^)
)
echo [..] Instalando modelos locais (pode demorar)...
for %%P in (faster-whisper kokoro-onnx llama-cpp-python) do (
    pip install -q %%P 2>nul || echo [--] %%P: falhou (ok — use Ollama^)
)
echo [OK] Dependencias instaladas

call :create_dirs

python tools\prepare_usb.py

echo.
echo ================================================================
echo   Instalacao USB concluida! O pendrive esta pronto.
echo   Copie a pasta inteira para qualquer PC com Python.
echo ================================================================
echo.
goto :launch

REM ═══════════════════════════════════════════════════════════
REM  REINSTALL — Limpa e reinstala
REM ═══════════════════════════════════════════════════════════
:reinstall
echo.
echo [!!] Isso vai reinstalar o ambiente Python (seus dados serao mantidos).
echo     Pasta 'data/' e modelos NAO serao apagados.
set /p "CONFIRM=  Confirma? [s/n]: "
if /i not "!CONFIRM!"=="s" goto :menu

echo [..] Removendo ambiente virtual antigo...
if exist "venv" rmdir /s /q "venv" 2>nul
echo [OK] Ambiente removido

goto :install

REM ═══════════════════════════════════════════════════════════
REM  FAST BOOT — Already installed, skip menu
REM ═══════════════════════════════════════════════════════════
:fast_boot
call venv\Scripts\activate.bat
echo [OK] Ambiente virtual ativado
call :create_dirs
goto :launch

REM ═══════════════════════════════════════════════════════════
REM  LAUNCH — Start the server
REM ═══════════════════════════════════════════════════════════
:launch
REM ── Garante que venv esta ativo ──
if exist "venv\Scripts\activate.bat" call venv\Scripts\activate.bat

REM ── Verifica deps criticas ──
python -c "import uvicorn, httpx, fastapi" 2>nul
if !errorlevel! neq 0 (
    echo [!!] Dependencias do servidor incompletas. Instalando...
    pip install fastapi uvicorn httpx python-multipart aiosqlite psutil
    python -c "import uvicorn, httpx, fastapi" 2>nul
    if !errorlevel! neq 0 (
        echo [ERRO] Dependencias criticas falharam. Escolha 'Reinstalar' no menu.
        pause
        exit /b 1
    )
)

REM ── Ollama check ──
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

if "!OLLAMA_OK!"=="1" (
    echo [OK] Ollama rodando
) else (
    echo [--] Ollama nao encontrado (ok se usando modelos GGUF locais)
)

REM ── Find available port ──
set PORT=8888
python -c "import socket; s=socket.socket(); s.bind(('',8888)); s.close()" 2>nul
if !errorlevel! neq 0 (
    echo [!!] Porta 8888 ocupada, tentando 8889...
    set PORT=8889
    python -c "import socket; s=socket.socket(); s.bind(('',8889)); s.close()" 2>nul
    if !errorlevel! neq 0 (
        echo [!!] Porta 8889 tambem ocupada, tentando 9999...
        set PORT=9999
    )
)

echo.
echo ================================================================
echo   Bunker AI rodando em: http://localhost:!PORT!
echo   Ctrl+C para parar
echo ================================================================
echo.

start "" "http://localhost:!PORT!"
python -m uvicorn server:app --host 0.0.0.0 --port !PORT!

echo.
echo [!!] Servidor parou.
pause
exit /b 0

REM ═══════════════════════════════════════════════════════════
REM  Helper: create data dirs
REM ═══════════════════════════════════════════════════════════
:create_dirs
if not exist "data\db" mkdir "data\db" 2>nul
if not exist "data\guides" mkdir "data\guides" 2>nul
if not exist "data\protocols" mkdir "data\protocols" 2>nul
if not exist "data\books" mkdir "data\books" 2>nul
if not exist "data\games" mkdir "data\games" 2>nul
if not exist "data\zim" mkdir "data\zim" 2>nul
if not exist "static\maps" mkdir "static\maps" 2>nul
if not exist "kokoro_models" mkdir "kokoro_models" 2>nul
if not exist "generated_apps" mkdir "generated_apps" 2>nul
if not exist "tts_cache" mkdir "tts_cache" 2>nul
if not exist "models" mkdir "models" 2>nul
if not exist "voice_models" mkdir "voice_models" 2>nul
exit /b 0
