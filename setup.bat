@echo off
echo ============================================
echo   ITABET - Setup Inicial
echo ============================================
echo.

echo [1/5] Instalando dependencias do backend...
cd backend
npm install
if errorlevel 1 ( echo ERRO: npm install backend falhou && pause && exit /b 1 )

echo.
echo [2/5] Configurando variaveis de ambiente do backend...
if not exist .env (
  copy .env.example .env
  echo Arquivo .env criado a partir do .env.example
  echo IMPORTANTE: Edite o arquivo backend\.env com suas chaves!
) else (
  echo Arquivo .env ja existe.
)

echo.
echo [3/5] Gerando Prisma Client e migrando banco de dados...
npx prisma generate
npx prisma migrate dev --name init
npx tsx prisma/seed.ts

echo.
echo [4/5] Instalando dependencias do frontend...
cd ..\frontend
npm install
if errorlevel 1 ( echo ERRO: npm install frontend falhou && pause && exit /b 1 )

echo.
echo [5/5] Setup concluido!
cd ..

echo.
echo ============================================
echo   Para iniciar o projeto:
echo.
echo   Terminal 1 (backend):
echo     cd backend
echo     npm run dev
echo.
echo   Terminal 2 (frontend):
echo     cd frontend
echo     npm run dev
echo.
echo   Acesse: http://localhost:5173
echo.
echo   Login Admin: admin@itabet.com / Admin@123456
echo   Login Demo:  demo@itabet.com  / User@123456
echo ============================================
pause
