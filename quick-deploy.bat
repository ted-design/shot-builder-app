@echo off
echo 🚀 UM-ShotBuilder Quick Deploy (Windows)
echo ====================================

echo 📦 Installing Firebase CLI...
call npm install -g firebase-tools

echo 📦 Building project...
call yarn build

echo 🔐 Please login to Firebase when browser opens...
call firebase login

echo 🚀 Deploying to Firebase...
call firebase deploy --project um-shotbuilder

echo ✅ Deployment complete!
echo 🌐 Your app is live at: https://um-shotbuilder.firebaseapp.com
pause