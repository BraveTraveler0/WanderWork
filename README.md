# Wanderwork

Wanderwork is a React, Vite, TypeScript, and Tailwind CSS job search dashboard with an optional Express/MongoDB backend for JobSeeker data, recruiter outreach, application tracking, and related workflows.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Express
- MongoDB/Mongoose

## Prerequisites

- Node.js 16 or newer
- npm
- MongoDB, if running the backend locally

## Frontend Setup

```bash
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:5173`.

Create a local `.env` from `.env.example` when you need to override the backend URL:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Backend Setup

```bash
cd server
npm install
npm run dev
```

The backend runs at `http://localhost:8000` by default.

Local backend environment files are intentionally ignored by Git. Use local `.env` files or your hosting provider's secret manager for credentials.

## Available Scripts

From the repository root:

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

From `server/`:

```bash
npm run dev
npm start
```

## Project Structure

```text
.
├── src/                 # Frontend source
├── server/              # Express API and MongoDB models
+-- Wanderwork/           # Canonical landing page app/assets
+-- Landing/              # Figma landing export/reference
├── .github/workflows/   # GitHub Actions
├── .env.example         # Frontend environment template
└── package.json
```

## Deployment Notes

- Keep `.env`, `development.env`, API keys, database URLs, and other secrets out of Git.
- Build the frontend with `npm run build`.
- Configure backend secrets in the deployment platform before starting the server.

## Documentation

- `VSCODE_CONNECTION_GUIDE.md`
- `server/AIRTABLE_SYNC_SETUP.md`
- `server/TALLY_DIRECT_SETUP.md`
