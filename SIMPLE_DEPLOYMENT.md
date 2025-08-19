# 🚀 Simple Deployment Instructions

## What You Need
- Your computer with internet connection
- Terminal/Command Prompt access
- The project files (already ready in `/app` folder)

## Step-by-Step Deployment

### Step 1: Open Terminal
- **Windows**: Press `Win + R`, type `cmd`, press Enter
- **Mac**: Press `Cmd + Space`, type "Terminal", press Enter
- **Linux**: Press `Ctrl + Alt + T`

### Step 2: Navigate to Project Folder
```bash
cd /app
```

### Step 3: Login to Firebase (ONE TIME ONLY)
```bash
firebase login
```
- This will open your web browser
- Sign in with your Google account (the same one used for Firebase project)
- Allow Firebase CLI access
- Return to terminal

### Step 4: Deploy Your App
```bash
./deploy.sh
```

**That's it!** Your app will be live at: https://um-shotbuilder.firebaseapp.com

---

## Alternative Manual Method

If the script doesn't work, run these commands one by one:

1. **Install Firebase CLI** (if not installed):
```bash
npm install -g firebase-tools
```

2. **Login to Firebase**:
```bash
firebase login
```

3. **Build the project**:
```bash
yarn build
```

4. **Deploy**:
```bash
firebase deploy --project um-shotbuilder
```

---

## ✅ Success Indicators
- Terminal shows "Deploy complete!"
- You see a URL: https://um-shotbuilder.firebaseapp.com
- Visit the URL to see your app running

## ❌ If Something Goes Wrong
- **"firebase: command not found"** → Run: `npm install -g firebase-tools`
- **"Not authorized"** → Run: `firebase login` again
- **Build fails** → Run: `yarn install` then `yarn build`

## 📞 Need Help?
All files are ready and configured. Just follow the 4 steps above!