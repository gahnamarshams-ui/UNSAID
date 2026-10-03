# UNSAID — Query Resolution & Workspace Platform

UNSAID is a real-time, workspace-scoped problem reporting and query resolution platform built with React, Vite, Tailwind CSS, and Firebase.

This codebase is cross-platform and runs identically on **macOS**, **Windows (Command Prompt / PowerShell)**, and **Linux**.

---

## Prerequisites

- **Node.js**: v18.0.0+ or v20.0.0+ (LTS recommended)
- **npm**: v9.0.0+
- **Git**

---

## Quick Setup (macOS / Linux)

```bash
# 1. Clone repository
git clone <repository-url>
cd UNSAID

# 2. Install dependencies (generates platform-native node_modules)
npm install

# 3. Create your local environment file
cp .env.example .env
# Edit .env and insert your Firebase project credentials

# 4. Start local development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Quick Setup (Windows — PowerShell or Command Prompt)

```powershell
# 1. Clone repository
git clone <repository-url>
cd UNSAID

# 2. Install dependencies (generates platform-native node_modules)
npm install

# 3. Create your local environment file
# In PowerShell:
Copy-Item .env.example .env
# Or in Command Prompt (cmd):
# copy .env.example .env

# Edit .env and insert your Firebase project credentials

# 4. Start local development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Authentication** (Email/Password and Google Provider).
3. Enable **Cloud Firestore** in your desired region (e.g. `asia-south1`).
4. Enable **Cloud Storage** for problem attachment uploads.
5. In Project Settings > General > Your apps, copy the Web SDK config values into your `.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Optional: Shareable URL base for invite links across devices
VITE_APP_BASE_URL=
```

---

## Deploying Security Rules

To deploy updated Firestore and Storage security rules:

```bash
# Login to Firebase CLI
npx firebase login

# Deploy rules
npx firebase deploy --only firestore:rules,storage
```

---

## Available Scripts (Cross-Platform)

All scripts run via npm without OS-dependent shell commands:

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Starts Vite HMR development server |
| `npm run build` | `vite build` | Compiles optimized production bundle |
| `npm run lint` | `oxlint` | High-performance codebase linting |
| `npm run preview` | `vite preview` | Locally previews production build |

---

## Backend Environment (Future / Part 5)

If Python backend services are initialized:

**Windows**:
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

**macOS / Linux**:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Cross-Platform Hygiene Notes

- **Never commit `node_modules/`**: Always let `npm install` generate dependencies locally.
- **Never commit `.env` or service account keys**: Keep secrets in `.env` (gitignored).
- **Line endings**: Normalization is managed automatically via `.gitattributes`.
- **Case-sensitivity**: All file imports strictly match disk casing for Linux/Windows compatibility.
