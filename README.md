# Scambot

Simple Node.js + React + SQLite app that logs text, files, and filesystem trees, with user registration and admin approval.

## Features

- **POST `/api/rawtext`** — stores a text string and timestamp (no authentication)
- **POST `/api/binfile`** — stores an uploaded file (no authentication)
- **POST `/api/fs`** — stores filesystem tree JSON from `fs.cmd` (no authentication)
- Expandable filesystem tree UI with folder/file and type-specific icons
- User registration with username rules (5–16 chars, letters/numbers only, must start with a letter)
- Admin account: `admin` / `33233333121` (created automatically)
- New accounts stay **pending** until an administrator approves them
- Admin user management (approve / reject / delete)
- Live pages auto-refresh every second

## Setup

```bash
npm run install:all
```

## Development

Runs API on port **3001** and Vite on **5173** (API proxied):

```bash
npm run dev
```

Open http://localhost:5173

## Production-style

```bash
npm run build
npm start
```

Then open http://localhost:3001 (or your Railway URL, e.g. https://rawreceive.up.railway.app)

## Client scripts

- `text.cmd` → POST command output to `/api/rawtext`
- `file.cmd` / `dir.cmd` → POST files to `/api/binfile`
- `fs.cmd` → scan non-`C:` drives and POST JSON tree to `/api/fs`

## API examples

```bash
curl -X POST http://localhost:3001/api/rawtext -H "Content-Type: application/json" -d "{\"text\":\"hello\"}"
curl -X POST http://localhost:3001/api/binfile -F "file=@./example.bin"
curl -X POST http://localhost:3001/api/fs -H "Content-Type: application/json" --data-binary @tree.json
```
