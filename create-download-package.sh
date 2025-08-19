#!/bin/bash

echo "📦 Creating UM-ShotBuilder download package..."

# Create a clean project directory
mkdir -p /tmp/um-shotbuilder-download
cd /tmp/um-shotbuilder-download

# Copy essential project files
cp -r /app/src ./
cp -r /app/functions ./
cp -r /app/dist ./
cp /app/package.json ./
cp /app/yarn.lock ./
cp /app/firebase.json ./
cp /app/.firebaserc ./
cp /app/vite.config.js ./
cp /app/tailwind.config.js ./
cp /app/postcss.config.js ./
cp /app/index.html ./
cp /app/firestore.rules ./
cp /app/storage.rules ./

# Copy deployment scripts and instructions
cp /app/deploy.sh ./
cp /app/quick-deploy.bat ./
cp /app/SIMPLE_DEPLOYMENT.md ./
cp /app/DEPLOYMENT_GUIDE.md ./
cp /app/DOWNLOAD_INSTRUCTIONS.md ./

# Create proper .gitignore for the clean package
cat > .gitignore << 'EOF'
# Node modules
node_modules/

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Environment files (local only)
.env.local
.env.*.local

# Firebase runtime
.firebase/
.firestore/
.storage/

# Editor
.DS_Store
.vscode/
.idea/

# Temporary
*.tmp
*.temp
EOF

# Create README for the download package
cat > README.md << 'EOF'
# 🚀 UM-ShotBuilder - Unbound Merino Shot Builder App

## ✅ What's Included
- Complete React application with PDF export functionality
- Firebase configuration (pre-configured with your credentials)
- Cloud Functions for user management
- Built production files ready for deployment
- Deployment scripts for easy setup

## 🚀 Quick Start
1. Install dependencies: `yarn install` or `npm install`
2. Login to Firebase: `firebase login`
3. Deploy: `./deploy.sh` or double-click `quick-deploy.bat`
4. Your app goes live at: https://um-shotbuilder.firebaseapp.com

## 📚 Documentation
- `SIMPLE_DEPLOYMENT.md` - Step-by-step deployment guide
- `DEPLOYMENT_GUIDE.md` - Detailed technical documentation

## 🎯 Features
- PDF export for shots and inventory
- Kanban-style workflow management
- Role-based access control
- Professional UI with Tailwind CSS
- Firebase integration (Auth, Firestore, Functions, Storage)

Built with React, Vite, Firebase, and love! 💙
EOF

echo "✅ Package created in /tmp/um-shotbuilder-download"
echo "📦 Creating archive..."

# Create tar.gz archive
cd /tmp
tar -czf um-shotbuilder-complete.tar.gz um-shotbuilder-download/

echo "🎉 Download package ready: /tmp/um-shotbuilder-complete.tar.gz"
ls -lh /tmp/um-shotbuilder-complete.tar.gz