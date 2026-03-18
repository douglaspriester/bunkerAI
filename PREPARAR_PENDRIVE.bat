@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title Bunker AI — Preparador de Pendrive

echo.
echo  ====================================================
echo   BUNKER AI — Preparador de Pendrive (Windows)
echo   100%% Offline. Plug ^& Play.
echo  ====================================================
echo.

cd /d "%~dp0"

if not exist "server.py" (
    echo [ERRO] Execute de dentro da pasta do Bunker AI.
    pause
    exit /b 1
)

REM ---- List removable drives ----
echo Drives disponiveis:
echo.
set "DRIVE_COUNT=0"
for /f "tokens=1,2,*" %%a in ('wmic logicaldisk where "drivetype=2 or drivetype=3" get caption^,freespace^,volumename /format:csv 2^>nul ^| findstr /i ":"') do (
    set /a DRIVE_COUNT+=1
    set "DRIVE_!DRIVE_COUNT!=%%b"
    set "free=%%c"
    set "name=%%d"
    if "!free!" neq "" (
        set /a "free_gb=!free:~0,-9!" 2>nul
        echo   !DRIVE_COUNT!^) %%b\ !name! ^(!free_gb! GB livre^)
    ) else (
        echo   !DRIVE_COUNT!^) %%b\
    )
)
set /a "CUSTOM=DRIVE_COUNT+1"
echo   !CUSTOM!^) Digitar caminho manualmente...
echo.

set /p "choice=Escolha [1-!CUSTOM!]: "

if "!choice!" == "!CUSTOM!" (
    set /p "DEST_ROOT=Caminho completo: "
) else (
    set "DEST_ROOT=!DRIVE_%choice%!\"
)

if not exist "!DEST_ROOT!" (
    echo [ERRO] Caminho nao encontrado: !DEST_ROOT!
    pause
    exit /b 1
)

set "DEST=!DEST_ROOT!BunkerAI"

echo.
echo Destino: !DEST!
echo.
set /p "confirm=Continuar? [S/n]: "
if /i "!confirm!" == "n" (
    echo Cancelado.
    pause
    exit /b 0
)

echo.
echo ====================================================
echo   Preparando pendrive... ~10 minutos.
echo ====================================================
echo.

REM ---- Step 1: Structure ----
echo [1/6] Criando estrutura...
mkdir "!DEST!\app" 2>nul

REM ---- Step 2: Copy code ----
echo [2/6] Copiando codigo...
copy /y server.py "!DEST!\app\" >nul
copy /y requirements.txt "!DEST!\app\" >nul
copy /y start.bat "!DEST!\app\" >nul
copy /y start.sh "!DEST!\app\" >nul
copy /y LEIA-ME.txt "!DEST!\" >nul
xcopy /s /e /y /q static "!DEST!\app\static\" >nul
xcopy /s /e /y /q data "!DEST!\app\data\" >nul

REM Create root launchers
(
echo @echo off
echo cd /d "%%~dp0\app"
echo call start.bat
) > "!DEST!\INICIAR.bat"

echo   [OK] Codigo copiado

REM ---- Step 3: Models ----
echo [3/6] Copiando modelos...
mkdir "!DEST!\app\models" 2>nul

if exist "models\qwen2.5-1.5b-instruct-q4_k_m.gguf" (
    echo   Copiando Qwen 1.5B...
    copy /y "models\qwen2.5-1.5b-instruct-q4_k_m.gguf" "!DEST!\app\models\" >nul
) else (
    echo   [DL] Baixando Qwen 1.5B...
    curl -L -o "!DEST!\app\models\qwen2.5-1.5b-instruct-q4_k_m.gguf" "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf"
)

if exist "models\dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf" (
    echo   Copiando Dolphin 8B...
    copy /y "models\dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf" "!DEST!\app\models\" >nul
) else (
    echo   [DL] Baixando Dolphin 8B ^(~5GB, demora^)...
    curl -L -o "!DEST!\app\models\dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf" "https://huggingface.co/bartowski/dolphin-2.9.4-llama3.1-8b-GGUF/resolve/main/dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf"
)

if exist "models\gemma-3-4b-it-Q4_K_M.gguf" (
    echo   Copiando Gemma 3 4B...
    copy /y "models\gemma-3-4b-it-Q4_K_M.gguf" "!DEST!\app\models\" >nul
) else (
    echo   [DL] Baixando Gemma 3 4B ^(~2.5GB^)...
    curl -L -o "!DEST!\app\models\gemma-3-4b-it-Q4_K_M.gguf" "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf"
)

echo   [OK] Modelos prontos

REM ---- Step 4: llama-server ----
echo [4/6] Preparando llama-server...
mkdir "!DEST!\app\bin\win" 2>nul
if exist "bin\win\llama-server.exe" (
    copy /y "bin\win\llama-server.exe" "!DEST!\app\bin\win\" >nul
    echo   [OK] llama-server copiado
) else (
    echo   [DL] Baixando llama-server para Windows...
    curl -L -o "%TEMP%\llama-win.zip" "https://github.com/ggml-org/llama.cpp/releases/download/b5200/llama-b5200-bin-win-cpu-x64.zip"
    powershell -command "Expand-Archive -Force '%TEMP%\llama-win.zip' '%TEMP%\llama-win'"
    for /r "%TEMP%\llama-win" %%f in (llama-server.exe) do (
        copy /y "%%f" "!DEST!\app\bin\win\" >nul
    )
    del /q "%TEMP%\llama-win.zip" 2>nul
    rd /s /q "%TEMP%\llama-win" 2>nul
    echo   [OK] llama-server baixado
)

REM ---- Step 5: venv ----
echo [5/6] Criando ambiente Python...
if exist "!DEST!\app\venv\Scripts\activate.bat" (
    echo   [OK] venv ja existe
) else (
    python -m venv "!DEST!\app\venv" 2>nul
    if exist "!DEST!\app\venv\Scripts\activate.bat" (
        call "!DEST!\app\venv\Scripts\activate.bat"
        pip install -q -r "!DEST!\app\requirements.txt" 2>nul
        echo   [OK] venv criado
    ) else (
        echo   [!!] Python nao encontrado — venv sera criado na primeira execucao
    )
)

REM ---- Step 6: Verify ----
echo [6/6] Verificando...
set ERRORS=0
if not exist "!DEST!\INICIAR.bat" (echo   [X] INICIAR.bat & set /a ERRORS+=1) else (echo   [OK] INICIAR.bat)
if not exist "!DEST!\app\server.py" (echo   [X] server.py & set /a ERRORS+=1) else (echo   [OK] server.py)
if not exist "!DEST!\app\models\qwen2.5-1.5b-instruct-q4_k_m.gguf" (echo   [X] Qwen model & set /a ERRORS+=1) else (echo   [OK] Qwen 1.5B)
if not exist "!DEST!\app\models\dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf" (echo   [X] Dolphin model & set /a ERRORS+=1) else (echo   [OK] Dolphin 8B)

echo.
echo ====================================================
if !ERRORS! equ 0 (
    echo   PENDRIVE PRONTO! Plug ^& Play.
) else (
    echo   Pendrive preparado com !ERRORS! item(s^) faltando.
)
echo   Destino: !DEST!
echo ====================================================
echo.
pause
