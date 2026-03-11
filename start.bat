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
echo  100%% Local - DON'T PANIC
echo.

REM ---- Ir para pasta do script ----
cd /d "%~dp0"

REM ---- Check Python ----
where python >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERRO] Python nao encontrado.
    echo        Baixe em: https://python.org
    echo        Marque "Add to PATH" na instalacao.
    echo.
    pause
    exit /b 1
)
echo [OK] Python encontrado

REM ---- Check Ollama ----
echo [..] Verificando Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if !errorlevel! neq 0 (
    echo [..] Ollama nao detectado. Tentando iniciar...
    start "" /b ollama serve >nul 2>&1
    echo [..] Aguardando 5 segundos...
    timeout /t 5 /nobreak >nul
    curl -s http://localhost:11434/api/tags >nul 2>&1
    if !errorlevel! neq 0 (
        echo [!!] Ollama nao esta rodando.
        echo      Baixe em: https://ollama.ai
        echo      Depois rode: ollama serve
        echo.
        echo      Continuando sem Ollama...
        echo.
        goto skip_models
    )
)
echo [OK] Ollama rodando

REM ---- Pull Models ----
echo.
echo [..] Verificando modelos necessarios...
echo     (primeiro download pode demorar, mas so acontece uma vez^)
echo.

call :pull_model "gemma3:12b" "chat + visao"
call :pull_model "qwen2.5-coder:14b" "app builder"
call :pull_model "phi4" "modelo rapido"
call :pull_model "dolphin3" "cerebro sem filtros"

:skip_models

REM ---- Python venv ----
echo.
if not exist "venv" (
    echo [..] Criando ambiente virtual Python...
    python -m venv venv
    if !errorlevel! neq 0 (
        echo [ERRO] Falha ao criar venv. Verifique sua instalacao do Python.
        pause
        exit /b 1
    )
)

if not exist "venv\Scripts\activate.bat" (
    echo [ERRO] venv corrompido. Delete a pasta 'venv' e rode novamente.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo [..] Instalando dependencias Python...
pip install -q -r requirements.txt 2>nul
if !errorlevel! neq 0 (
    echo [!!] Aviso: Algumas dependencias podem nao ter instalado.
    echo      Verifique sua conexao com a internet no primeiro uso.
)

REM ---- Map hint ----
if not exist "static\maps" mkdir "static\maps" 2>nul

echo.
echo ================================================================
echo   Bunker AI rodando em: http://localhost:8888
echo   Aperte Ctrl+C para parar
echo ================================================================
echo.

REM ---- Launch ----
python -m uvicorn server:app --host 0.0.0.0 --port 8888 --reload

echo.
echo [!!] Servidor parou. Verifique os erros acima.
echo.
pause
exit /b 0

REM =====================================================
REM  Funcao para baixar modelo se nao existir
REM =====================================================
:pull_model
set "MODEL=%~1"
set "DESC=%~2"

REM Checa se modelo ja existe
for /f "delims=" %%A in ('curl -s http://localhost:11434/api/tags 2^>nul') do (
    echo %%A | findstr /i "%MODEL%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] %MODEL% ja instalado
        goto :eof
    )
)

echo [DL] Baixando %MODEL% (%DESC%^)...
ollama pull %MODEL%
if !errorlevel! equ 0 (
    echo [OK] %MODEL% pronto
) else (
    echo [!!] Falha ao baixar %MODEL% - baixe depois pelo app
)
goto :eof
