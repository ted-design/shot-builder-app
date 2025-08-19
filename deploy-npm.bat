@echo off
echo 🚀 UM-ShotBuilder Deployment (NPM Version)
echo ========================================

echo 📦 Building project with npm...
call npm run build

echo 🚀 Deploying to Firebase...
call firebase deploy --project um-shotbuilder

echo ✅ Deployment complete!
echo 🌐 Your app is live at: https://um-shotbuilder.firebaseapp.com
pause