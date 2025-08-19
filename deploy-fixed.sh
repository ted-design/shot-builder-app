#!/bin/bash

echo "🚀 UM-ShotBuilder Deployment Script (Fixed)"
echo "=========================================="

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "📦 Installing Firebase CLI..."
    npm install -g firebase-tools
else
    echo "✅ Firebase CLI already installed"
fi

# Build the project using npm (instead of yarn)
echo "📦 Building project with npm..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - no dist folder found"
    exit 1
fi

echo "✅ Build successful - dist folder created"

# Deploy to Firebase (skip auth check since user is already logged in)
echo "🚀 Deploying to Firebase..."
firebase deploy --project um-shotbuilder

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Deployment complete!"
    echo "🌐 Your app is live at: https://um-shotbuilder.firebaseapp.com"
    echo ""
    echo "✅ Features available:"
    echo "   • PDF export for shots and inventory"
    echo "   • Kanban workflow management"
    echo "   • Role-based access control"
    echo "   • Professional UI"
    echo ""
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi