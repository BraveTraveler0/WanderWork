# VSCode Connection Guide – JobSeeker API (UniversTeam/Aon)

This guide explains how to run the Aon backend locally and connect any Vite/React frontend (e.g., your Wander app) to the JobSeeker API.

## Backend (Aon/server)
- Repo: https://github.com/UniversTeam/Aon (branch: main)
- Service: Express + MongoDB
- Default port: **8000** (`PORT` env)
- Key routes registered in `server/server.js`: `/jobseeker`, `/users`, `/posts`, etc.
- CORS: allows `http://localhost:5173/` plus production domains (see `server/config/allowedOrigins.js`).

### Run locally
```bash
cd server
npm install
npm run dev
# server listens on http://localhost:8000
```
Ensure MongoDB is running and `DATABASE_URI` in your env points to it (e.g., `mongodb://localhost:27017`).

### JobSeeker endpoints (from `routes/JobSeeker/jobSeekerRoute.js`)
Base URL: `http://localhost:8000/jobseeker`
- `GET /` – all data (Applications, Candidates, Jobs, Contacts, CandidateJobPairing, ContactJobPairing)
- `GET /candidate` and `/candidate/:id`
- `GET /job` and `/job/:id`
- `GET /application` and `/application/:id`
- `GET /contact` and `/contact/:id`
- `GET /jobCandidatePairing` and `/jobCandidatePairing/:id`
- `GET /contactJobPairing` and `/contactJobPairing/:id`
- `PATCH /update` – bulk upsert payload `{ data: { Applications, Candidates, Jobs, Contacts, CandidateJobPairings, ContactJobPairings } }`

### Known issue on `/jobseeker/update`
`UpdateAllData` calls `bdUtils.bulkUpsert` (typo) for Jobs. This 500s the endpoint. Fix: change `bdUtils` to `dbUtils` and ensure `bulkUpsert` exists for `JobSeeker.Jobs`.

## Frontend configuration
Set your Vite env (e.g., `.env.local` for Wander) to point to the backend:
```
VITE_API_BASE_URL=http://localhost:8000
```
If you must hit Render, use `https://application-server-cwqu.onrender.com` (current hosted API) but prefer local for reliability.

## Example fetch helpers (Fetch API)
```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function fetchAllJobSeeker() {
  const res = await fetch(`${API_BASE}/jobseeker/`);
  if (!res.ok) throw new Error(`jobseeker fetch failed ${res.status}`);
  return res.json();
}

export async function fetchJobs() {
  const res = await fetch(`${API_BASE}/jobseeker/job`);
  if (!res.ok) throw new Error(`jobs fetch failed ${res.status}`);
  return res.json();
}
```

## Testing the API
- Browser: open `http://localhost:8000/jobseeker/`
- curl: `curl -v http://localhost:8000/jobseeker/job`
- Thunder Client/Postman: create requests with the base URL above.

## CORS notes
If you use a different frontend port, add it to `server/config/allowedOrigins.js` and restart the backend.

## Render setup (if needed)
See repo `RENDER_SETUP.md`: build `cd aonverse && npm ci && npm run build`; start `cd aonverse && npm start`; publish `aonverse/dist` for static deployments.
