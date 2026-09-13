# Inicia backend, front-end e o túnel HTTPS FIXO (ngrok) do Nerva.
# Uso: clique com o direito -> "Executar com PowerShell", ou rode:
#   powershell -ExecutionPolicy Bypass -File .\iniciar-tudo.ps1

$root = $PSScriptRoot
$ngrok = "C:\Users\laris\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
$dominio = "ride-amends-purging.ngrok-free.dev"   # URL fixa do app

Write-Host "Iniciando backend (porta 4000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root\backend'; npm run dev"

Start-Sleep -Seconds 3
Write-Host "Iniciando front-end (porta 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root'; npm run dev"

Start-Sleep -Seconds 3
if (Test-Path $ngrok) {
  Write-Host "Iniciando túnel HTTPS fixo (ngrok)..." -ForegroundColor Cyan
  Start-Process powershell -ArgumentList "-NoExit","-Command","& '$ngrok' http 5173 --url=https://$dominio"
} else {
  Write-Host "ngrok não encontrado. Instale com: winget install --id Ngrok.Ngrok -e" -ForegroundColor Red
}

Write-Host ""
Write-Host "Pronto!" -ForegroundColor Green
Write-Host "  PC:      http://localhost:5173" -ForegroundColor Green
Write-Host "  Celular: https://$dominio" -ForegroundColor Green
