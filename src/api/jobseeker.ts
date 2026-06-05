import { API_BASE_URL } from './config'

export interface Location {
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Job {
  _id: string;
  job_code: string;
  title: string;
  company: string;
  salary?: string;
  location: Location[];
  url: string;
  jobType: string;
  datePosted: string;
  shortDescription: string;
  tags: string[];
}

export interface Candidate {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage?: string;
  phone: string;
  location: any[];
  targetRoles: string[];
  seniority: string[];
  skills: string[];
  urls: any[];
  resume: any;
  resumeLink?: string;
  coverLetter?: any;
  coverLetterLink?: string;
  status: string;
  paidUntil: string;
  graceDays?: number;
  tokenBalance?: number;
  tokensUsed?: number;
  creditsBalance?: number;
  creditsUsed?: number;
  plan?: 'free' | 'upgraded' | 'premium';
  recruiterContactsLeft?: number;
  recruiterContactsMax?: number;
  recruiterContactsUpdatedAt?: string;
  resume_text?: string;
  work_experience?: string;
  education?: string;
  skills_2?: string[];
}

export interface Application {
  _id: string;
  jobId: string;
  candidateId: string;
  preparedAt: string;
  status: string;
  jobTitle?: string;
  company?: string;
  resume: any;
  coverLetter: string;
}

export interface CandidateJobPairing {
  _id: string;
  jobId: string;
  candidateId: string;
  score: number;
  matchedSkills?: string[];
  reason?: string;
  pairedAt?: string;
  source?: string;
  algorithmVersion?: string;
}

export interface Contact {
  _id: string;
  company: string;
  name: string;
  title: string;
  email: string;
  source: string;
  lastVerified: string;
}

export interface ContactJobPairing {
  _id: string;
  contactId: string;
  jobId: string;
  confidence: number;
}

export interface JobSeekerData {
  Applications: Application[];
  Candidates: Candidate[];
  Jobs: Job[];
  Contacts: Contact[];
  CandidateJobPairing: CandidateJobPairing[];
  ContactJobPairing: ContactJobPairing[];
}

const BASE_URL = API_BASE_URL;

const TIMEOUT_MS = 10000;

function getAuthHeader(): Record<string, string> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('wanderworkToken') : null
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

async function fetchJson<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        Accept: 'application/json',
        ...getAuthHeader(),
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`Request failed ${res.status} ${res.statusText}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function getAllJobSeekerData(init?: RequestInit & { signal?: AbortSignal }): Promise<JobSeekerData> {
  return fetchJson<JobSeekerData>('/jobseeker/', init);
}

export function getApplications(init?: RequestInit & { signal?: AbortSignal }): Promise<Application[]> {
  return fetchJson<Application[]>('/jobseeker/application', init);
}

export function updateJobSeeker(data: any, init?: RequestInit & { signal?: AbortSignal }): Promise<any> {
  return fetchJson('/jobseeker/update', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
    ...init,
  });
}

export function getCandidates(init?: RequestInit & { signal?: AbortSignal }): Promise<Candidate[]> {
  return fetchJson<Candidate[]>('/jobseeker/candidate', init);
}

export function getCandidateById(id: string, init?: RequestInit & { signal?: AbortSignal }): Promise<Candidate> {
  return fetchJson<Candidate>(`/jobseeker/candidate/${encodeURIComponent(id)}`, init);
}

export function updateCandidateSkills(id: string, skills: string[] | string, init?: RequestInit & { signal?: AbortSignal }): Promise<any> {
  return fetchJson(`/jobseeker/candidate/${encodeURIComponent(id)}/skills`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skills }),
    ...init,
  });
}

export async function parseSignupResume(file: File): Promise<any> {
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
    try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function uploadCandidateResume(email: string, file: File): Promise<any> {
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
  if (!res.ok) {
    let msg = `Upload failed (${res.status})`;
    try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function uploadCandidateCoverLetter(email: string, file: File): Promise<any> {
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
  if (!res.ok) throw new Error(`Upload failed ${res.status} ${res.statusText}`);
  return res.json();
}

export async function submitCustomRequest(payload: Record<string, any>): Promise<any> {
  const res = await fetch(`${BASE_URL}/jobseeker/custom-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...getAuthHeader() },
    body: JSON.stringify(payload || {})
  });
  const text = await res.text();
  let data: any = {};
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

export function getJobs(init?: RequestInit & { signal?: AbortSignal }): Promise<Job[]> {
  return fetchJson<Job[]>('/jobseeker/job', init);
}

export function getJobById(id: string, init?: RequestInit & { signal?: AbortSignal }): Promise<Job> {
  return fetchJson<Job>(`/jobseeker/job/${encodeURIComponent(id)}`, init);
}

export function getApplicationsById(id: string, init?: RequestInit & { signal?: AbortSignal }): Promise<Application> {
  return fetchJson<Application>(`/jobseeker/application/${encodeURIComponent(id)}`, init);
}

export function getContacts(init?: RequestInit & { signal?: AbortSignal }): Promise<Contact[]> {
  return fetchJson<Contact[]>('/jobseeker/contact', init);
}

export function getContactById(id: string, init?: RequestInit & { signal?: AbortSignal }): Promise<Contact> {
  return fetchJson<Contact>(`/jobseeker/contact/${encodeURIComponent(id)}`, init);
}

export function getCandidateJobPairings(init?: RequestInit & { signal?: AbortSignal }): Promise<CandidateJobPairing[]> {
  return fetchJson<CandidateJobPairing[]>('/jobseeker/jobCandidatePairing', init);
}

export function getCandidateJobPairingById(id: string, init?: RequestInit & { signal?: AbortSignal }): Promise<CandidateJobPairing> {
  return fetchJson<CandidateJobPairing>(`/jobseeker/jobCandidatePairing/${encodeURIComponent(id)}`, init);
}

export function pairCandidateJobs(id: string, options: { limit?: number; minScore?: number } = {}, init?: RequestInit & { signal?: AbortSignal }): Promise<any> {
  return fetchJson(`/jobseeker/candidate/${encodeURIComponent(id)}/pair-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
    ...init,
  });
}

export function getContactJobPairings(init?: RequestInit & { signal?: AbortSignal }): Promise<ContactJobPairing[]> {
  return fetchJson<ContactJobPairing[]>('/jobseeker/contactJobPairing', init);
}

export function getContactJobPairingById(id: string, init?: RequestInit & { signal?: AbortSignal }): Promise<ContactJobPairing> {
  return fetchJson<ContactJobPairing>(`/jobseeker/contactJobPairing/${encodeURIComponent(id)}`, init);
}

export interface RecruiterRecord {
  _id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  specialty: string;
  emailTemplate?: string;
  score?: number;
}

export function getPairedRecruiters(
  candidateId: string,
  limit = 50,
  company?: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<{ specialties: string[]; recruiters: RecruiterRecord[] }> {
  const params = new URLSearchParams({ candidateId, limit: String(limit) })
  if (company) params.set('company', company)
  return fetchJson(`/recruiter/paired?${params}`, init);
}

export function sendRecruiterDraft(
  candidateId: string,
  recruiterId: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<{ contact: any; tokensRemaining: number; draftRecipientEmail?: string }> {
  return fetchJson('/recruiter/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId, recruiterId }),
    ...init,
  });
}

export const sendRecruiterEmail = sendRecruiterDraft;

export function getRecruiterContactHistory(
  candidateId: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<any[]> {
  return fetchJson(`/recruiter/contacts?candidateId=${candidateId}`, init);
}
