@echo off
cd /d "%~dp0"
echo Nur laeuft auf http://localhost:8765  (Fenster schliessen zum Beenden)
start "" http://localhost:8765
python -m http.server 8765 --bind 127.0.0.1
