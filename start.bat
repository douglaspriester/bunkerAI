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

call :pull_model "dolphin3" "chat principal uncensored"
call :pull_model "dolphin-llama3.1:8b" "chat avancado uncensored"
call :pull_model "gemma3:12b" "visao + multimodal"
call :pull_model "qwen2.5-coder:7b" "app builder + codigo"

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

REM ---- Criar diretorios de dados ----
if not exist "data\guides\disaster-specific" mkdir "data\guides\disaster-specific" 2>nul
if not exist "data\protocols" mkdir "data\protocols" 2>nul
if not exist "data\books" mkdir "data\books" 2>nul
if not exist "data\games" mkdir "data\games" 2>nul
if not exist "data\avatar" mkdir "data\avatar" 2>nul
if not exist "data\zim" mkdir "data\zim" 2>nul
if not exist "data\db" mkdir "data\db" 2>nul
if not exist "tools" mkdir "tools" 2>nul
if not exist "static\lib" mkdir "static\lib" 2>nul
if not exist "static\maps" mkdir "static\maps" 2>nul
if not exist "kokoro_models" mkdir "kokoro_models" 2>nul

REM ---- Auto-setup (primeira execucao) ----
if not exist "data\.setup_complete" (
    echo.
    echo ================================================================
    echo   PRIMEIRO USO — Configurando conteudo offline...
    echo   Isso acontece apenas uma vez.
    echo ================================================================
    echo.
    python setup_downloads.py
    if !errorlevel! neq 0 (
        echo [!!] Setup incompleto. Alguns recursos podem nao estar disponiveis.
        echo      Rode start.bat novamente para tentar de novo.
    )
)

REM ---- Iniciar Kiwix (se ZIM existir) ----
set "KIWIX_EXE="
if exist "tools\kiwix-serve.exe" set "KIWIX_EXE=tools\kiwix-serve.exe"
if not defined KIWIX_EXE (
    where kiwix-serve >nul 2>&1
    if !errorlevel! equ 0 set "KIWIX_EXE=kiwix-serve"
)

if defined KIWIX_EXE (
    REM Check if any ZIM files exist
    set "HAS_ZIM="
    for %%f in (data\zim\*.zim) do set "HAS_ZIM=1"
    if defined HAS_ZIM (
        echo [..] Iniciando Kiwix (Wikipedia offline) na porta 8889...
        start "" /b !KIWIX_EXE! --port 8889 --library data\zim\*.zim >nul 2>&1
        echo [OK] Kiwix iniciado em http://localhost:8889
    ) else (
        echo [--] Nenhum arquivo ZIM encontrado. Wikipedia offline nao disponivel.
        echo      Coloque arquivos .zim em data\zim\ para ativar.
    )
) else (
    echo [--] kiwix-serve nao encontrado. Wikipedia offline nao disponivel.
)

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
