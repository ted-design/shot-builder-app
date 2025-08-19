#!/bin/bash

echo "🚀 UM-ShotBuilder Deployment Script"
echo "=================================="

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "📦 Installing Firebase CLI..."
    npm install -g firebase-tools
else
    echo "✅ Firebase CLI already installed"
fi

# Build the project
echo "📦 Building project..."
yarn build

# Check if user is logged in
echo "🔐 Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please run: firebase login"
    exit 1
else
    echo "✅ Firebase authentication confirmed"
fi

# Deploy to Firebase
echo "🚀 Deploying to Firebase..."
firebase deploy --project um-shotbuilder

echo "✅ Deployment complete!"
echo "🌐 Your app is live at: https://um-shotbuilder.firebaseapp.com"