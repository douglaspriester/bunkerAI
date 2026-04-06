@echo off
setlocal enabledelayedexpansion
title BunkerAI — Boot
cd /d "%~dp0app"

echo.
echo  ╔══════════════════════════════╗
echo  ║      BunkerAI — Boot         ║
echo  ╚══════════════════════════════╝
echo.

:: Detectar RAM (em GB)
set RAM_GB=0
for /f "skip=1 tokens=2" %%m in ('wmic ComputerSystem get TotalPhysicalMemory 2^>nul') do (
    if not "%%m"=="" (
        set /a RAM_GB=%%m / 1073741824
        goto :got_ram
    )
)
:got_ram
echo [HW] RAM: !RAM_GB!GB

:: Detectar GPU NVIDIA
set GPU_TYPE=cpu
nvidia-smi >nul 2>&1
if !errorlevel!==0 (
    set GPU_TYPE=nvidia
    echo [HW] GPU: NVIDIA detectada
) else (
    echo [HW] GPU: nenhuma detectada, modo CPU
)

:: Escolher modelo com base no hardware
set MODEL=
if exist "models\dolphin-8b-q4.gguf" (
    if "!GPU_TYPE!"=="nvidia" (
        set MODEL=models\dolphin-8b-q4.gguf
        echo [LLM] Modelo: 8B uncensored
    ) else if !RAM_GB! GEQ 16 (
        set MODEL=models\dolphin-8b-q4.gguf
        echo [LLM] Modelo: 8B uncensored
    )
)
if "!MODEL!"=="" (
    if exist "models\dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf" (
        if "!GPU_TYPE!"=="nvidia" (
            set MODEL=models\dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf
            echo [LLM] Modelo: 8B Q4 uncensored
        ) else if !RAM_GB! GEQ 16 (
            set MODEL=models\dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf
            echo [LLM] Modelo: 8B Q4 uncensored
        )
    )
)
if "!MODEL!"=="" (
    if exist "models\dolphin-1b-q4.gguf" (
        set MODEL=models\dolphin-1b-q4.gguf
        echo [LLM] Modelo: 1B leve CPU
    ) else if exist "models\dolphin-2.9.4-llama3.1-1b-Q4_K_M.gguf" (
        set MODEL=models\dolphin-2.9.4-llama3.1-1b-Q4_K_M.gguf
        echo [LLM] Modelo: 1B Q4 leve CPU
    ) else (
        for %%f in (models\*.gguf) do (
            if "!MODEL!"=="" set MODEL=%%f
        )
    )
)
if "!MODEL!"=="" (
    echo [ERRO] Nenhum modelo GGUF encontrado em models\
    pause
    exit /b 1
)

:: Encerrar llama-server anterior
taskkill /f /im llama-server.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Iniciar llama-server
set LLAMA_BIN=bin\win\llama-server.exe
if exist "!LLAMA_BIN!" (
    set N_GPU_LAYERS=0
    if "!GPU_TYPE!"=="nvidia" set N_GPU_LAYERS=35
    start /b "" "!LLAMA_BIN!" --model "!MODEL!" --port 8070 --host 127.0.0.1 --ctx-size 4096 --n-gpu-layers !N_GPU_LAYERS! --log-disable
    echo [LLM] llama-server iniciado
    timeout /t 3 /nobreak >nul
) else (
    echo [AVISO] llama-server nao encontrado — continuando sem LLM local
)

:: Python: embarcado se disponivel, senao venv, senao sistema
set PYTHON=python
if exist "python\python.exe" (
    set PYTHON=python\python.exe
    echo [PY] Python embarcado
) else if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo [PY] venv ativado
)

:: Iniciar servidor BunkerAI
echo [WEB] Iniciando BunkerAI...
start /b "" !PYTHON! server.py
timeout /t 3 /nobreak >nul

:: Abrir navegador
echo [OK] Abrindo http://localhost:8888
start "" http://localhost:8888

echo.
echo  === BunkerAI rodando ===
echo  Para encerrar, feche esta janela
echo.
pause
