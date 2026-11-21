@echo off
cd /d "%~dp0"
start "ST Battle Server" /min node server.cjs
start "" http://localhost:3188
