@echo off
title Fix Zenpert Printer Offset
echo.
echo Sending offset reset to Zenpert 4T520...
copy /b "%~dp0reset-printer-offset.prn" USB001
echo.
echo Done. Printer offset reset to 0.
echo Labels will now print from row 1 every time.
echo.
pause
