export interface Location {
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Job {
  _id: string;
  job_code?: string;
  code?: string;
  title: string;
  company: string;
  salary?: string;
  location?: Location[] | string;
  url?: string;
  apply_url?: string | null;
  applyUrl?: string | null;
  company_url?: string | null;
  jobType?: string;
  type?: string;
  datePosted?: string;
  postedAt?: string;
  preparedAt?: string;
  createdAt?: string;
  description?: string;
  shortDescription?: string;
  jobDescription?: string;
  summary?: string;
  tags?: string[];
  skills?: string[];
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

export function getAllJobSeekerData(init?: RequestInit & { signal?: AbortSignal }): Promise<JobSeekerData>;
export function getApplications(init?: RequestInit & { signal?: AbortSignal }): Promise<Application[]>;
export function updateJobSeeker(data: any, init?: RequestInit & { signal?: AbortSignal }): Promise<any>;
export function parseSignupResume(file: File): Promise<any>;
export function uploadCandidateResume(email: string, file: File): Promise<any>;
export function uploadCandidateCoverLetter(email: string, file: File): Promise<any>;
export function submitCustomRequest(payload: Record<string, any>): Promise<any>;
export function getCandidates(init?: RequestInit & { signal?: AbortSignal }): Promise<Candidate[]>;
export function getCandidateById(id: string, init?: RequestInit & { signal?: AbortSignal }): Promise<Candidate>;
export function getJobs(init?: RequestInit & { signal?: AbortSignal }): Promise<Job[]>;
export function getJobById(id: string, init?: RequestInit & { signal?: AbortSignal }): Promise<Job>;
export function getApplicationsById(id: string, init?: RequestInit & { signal?: AbortSignal }): Promise<Application>;
export function getContacts(init?: RequestInit & { signal?: AbortSignal }): Promise<Contact[]>;
export function getCandidateJobPairings(init?: RequestInit & { signal?: AbortSignal }): Promise<CandidateJobPairing[]>;
export function getContactJobPairings(init?: RequestInit & { signal?: AbortSignal }): Promise<ContactJobPairing[]>;
