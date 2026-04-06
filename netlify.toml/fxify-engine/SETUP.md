# FXIFY Content Engine — Setup Guide

## Project structure
```
fxify-engine/
├── public/
│   └── index.html          ← The app
├── netlify/
│   └── functions/
│       ├── generate.js     ← Claude API proxy
│       └── create-doc.js   ← Google Docs integration
├── netlify.toml            ← Netlify config
└── SETUP.md                ← This file
```

## Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "FXIFY Content Engine v1"
git remote add origin https://github.com/YOUR_USERNAME/fxify-engine.git
git push -u origin main
```

## Step 2 — Connect to Netlify
1. Go to app.netlify.com
2. Add new site → Import from Git → Select your repo
3. Build settings are automatic (netlify.toml handles it)

## Step 3 — Add environment variables in Netlify
Go to Site settings → Environment variables → Add:

### Claude (required)
ANTHROPIC_API_KEY = your key from console.anthropic.com

### Google Docs (required for Doc embedding)
GOOGLE_CLIENT_ID      = from Google Cloud Console
GOOGLE_CLIENT_SECRET  = from Google Cloud Console
GOOGLE_REFRESH_TOKEN  = see Google setup below
GOOGLE_DRIVE_FOLDER_ID = ID of your FXIFY content folder in Drive

## Step 4 — Google Cloud setup
1. Go to console.cloud.google.com
2. Create project: "FXIFY Content Engine"
3. Enable APIs:
   - Google Docs API
   - Google Drive API
4. Create OAuth 2.0 credentials (Desktop app type)
5. Download credentials JSON
6. Get refresh token:
   - Use OAuth Playground (oauth2.googleapis.com/playground)
   - Scope: https://www.googleapis.com/auth/drive + https://www.googleapis.com/auth/documents
   - Authorise with your fxify.com Google account
   - Exchange auth code for tokens
   - Copy the refresh_token value

## Step 5 — Google Drive folder ID
1. Open Google Drive
2. Create a folder: "FXIFY Blog Drafts"
3. Open the folder
4. Copy the ID from the URL:
   drive.google.com/drive/folders/THIS_PART_IS_THE_ID
5. Add as GOOGLE_DRIVE_FOLDER_ID env variable

## Step 6 — Deploy
Push any change to GitHub → Netlify auto-deploys.
Or trigger manually from Netlify dashboard.

## How it works after setup
1. Admin fills in brief → hits Create Draft
2. App calls /.netlify/functions/generate (Claude proxy)
3. Claude writes full article using FXIFY prompt template
4. App calls /.netlify/functions/create-doc
5. Function creates Google Doc in FXIFY Blog Drafts folder
6. Doc is shared with anyone at fxify.com automatically
7. Editor embeds the Doc — writer edits directly in Google Docs
8. Left sidebar and right panel still show SEO/GEO/AEO scores

## Anthropic API key
Get from: console.anthropic.com → API Keys
