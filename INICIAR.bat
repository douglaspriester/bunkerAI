@echo off
REM ═══ Bunker AI — Duplo-clique para iniciar (Windows) ═══
REM Este arquivo pode ficar na pasta raiz ou uma pasta acima do app.

cd /d "%~dp0"

if exist "server.py" (
    call start.bat
) else if exist "app\server.py" (
    cd app
    call start.bat
) else if exist "bunker\server.py" (
    cd bunker
    call start.bat
) else (
    echo ERRO: Nao encontrei o Bunker AI.
    echo Coloque este arquivo na mesma pasta ou uma pasta acima do server.py
    pause
)
