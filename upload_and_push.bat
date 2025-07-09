@echo off
cd /d %~dp0
git add images
git commit -m "Auto update images" 
git push origin main
pause
