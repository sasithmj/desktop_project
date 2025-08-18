@echo off
echo Starting SQL Server Services...
echo.

echo Checking SQL Server Express service...
sc query MSSQL$SQLEXPRESS | find "RUNNING"
if %errorlevel% neq 0 (
    echo SQL Server Express is not running. Starting it...
    net start MSSQL$SQLEXPRESS
    if %errorlevel% equ 0 (
        echo SQL Server Express started successfully.
    ) else (
        echo Failed to start SQL Server Express.
    )
) else (
    echo SQL Server Express is already running.
)

echo.
echo Checking SQL Server Browser service...
sc query SQLBrowser | find "RUNNING"
if %errorlevel% neq 0 (
    echo SQL Server Browser is not running. Starting it...
    net start SQLBrowser
    if %errorlevel% equ 0 (
        echo SQL Server Browser started successfully.
    ) else (
        echo Failed to start SQL Server Browser.
    )
) else (
    echo SQL Server Browser is already running.
)

echo.
echo Checking TCP/IP protocol...
echo You may need to enable TCP/IP protocol in SQL Server Configuration Manager.
echo 1. Open SQL Server Configuration Manager
echo 2. Go to SQL Server Network Configuration > Protocols for SQLEXPRESS
echo 3. Enable TCP/IP if it's disabled
echo 4. Restart SQL Server service

echo.
echo Testing connection to MSI\SQLEXPRESS...
sqlcmd -S "MSI\SQLEXPRESS" -E -Q "SELECT 1 as test"
if %errorlevel% equ 0 (
    echo Connection successful!
) else (
    echo Connection failed. Please check:
    echo 1. SQL Server is installed and running
    echo 2. Instance name is correct (SQLEXPRESS)
    echo 3. TCP/IP protocol is enabled
    echo 4. Windows Firewall allows connections on port 1433
)

pause 