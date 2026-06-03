const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_LOCAL_APP_SERVER_URL ||
  'http://localhost:8000';

function getAuthHeader() {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('wanderworkToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function getAllJobSeekerData() {
  const res = await fetch(`${BASE_URL}/jobseeker/`, { headers: { ...getAuthHeader() } });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

export async function getApplications() {
  const res = await fetch(`${BASE_URL}/jobseeker/application`, { headers: { ...getAuthHeader() } });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
}

export async function updateJobSeeker(data) {
  const res = await fetch(`${BASE_URL}/jobseeker/update`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Failed to update: ${res.status}`);
  return res.json();
}

export async function parseSignupResume(file) {
  const form = new FormData();
  form.append('resume', file);
  const res = await fetch(`${BASE_URL}/auth/signup/parse-resume`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: form
  });
  if (!res.ok) {
    let msg = `Resume parse failed (${res.status})`;
    try {
      const json = await res.json();
      if (json?.message) msg = json.message;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function uploadCandidateResume(email, file) {
  const form = new FormData();
  form.append('email', email);
  form.append('resume', file);
  const res = await fetch(`${BASE_URL}/jobseeker/candidate/resume`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
    },
    body: form
  });
  if (!res.ok) throw new Error(`Upload failed ${res.status}`);
  return res.json();
}

export async function uploadCandidateCoverLetter(email, file) {
  const form = new FormData();
  form.append('email', email);
  form.append('coverLetter', file);
  const res = await fetch(`${BASE_URL}/jobseeker/candidate/cover-letter`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
    },
    body: form
  });
  if (!res.ok) throw new Error(`Upload failed ${res.status}`);
  return res.json();
}

export async function submitCustomRequest(payload) {
  const res = await fetch(`${BASE_URL}/jobseeker/custom-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(payload || {})
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const detail = data?.detail ? ` | ${JSON.stringify(data.detail)}` : (data?.message ? ` | ${data.message}` : '');
    throw new Error(`Request failed ${res.status} ${res.statusText}${detail}`);
  }
  return data;
}

export async function pairCandidateJobs(id, options = {}) {
  const res = await fetch(`${BASE_URL}/jobseeker/candidate/${encodeURIComponent(id)}/pair-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(options || {})
  });
  if (!res.ok) throw new Error(`Pairing failed ${res.status}`);
  return res.json();
}
