// Shared fetch helper and types for the Capital Watch dashboard, Inanna, and the Outbox.
// This file is kept identical in the WanderWork repo (Wanderwork/src/pages) and the
// AonCreative repo (served at aoncreative.io/capitalwatch). Change both together.

// Set VITE_CAPITALWATCH_API_BASE_URL=http://localhost:8000 in .env for local development.
export const API_BASE =
  import.meta.env.VITE_CAPITALWATCH_API_BASE_URL || "https://wanderwork-backend-server.onrender.com";

// The session from the emailed sign-in link, kept in this browser.
const SESSION_KEY = "capitalwatch.session";
let memorySession = "";

export function getSession() {
  try { return localStorage.getItem(SESSION_KEY) || memorySession; } catch { return memorySession; }
}
export function setSession(token: string) {
  memorySession = token;
  try { localStorage.setItem(SESSION_KEY, token); } catch { /* storage blocked: kept for this tab */ }
}
export function clearSession() {
  memorySession = "";
  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked */ }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  const res = await fetch(`${API_BASE}/capitalwatch${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && session) {
    // Session expired or account removed: back to the sign-in screen.
    clearSession();
    window.dispatchEvent(new Event("capitalwatch:signed-out"));
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
  return res.json();
}

export const send = (path: string, method: string, body?: unknown) =>
  api(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export type Option = { id: string; label: string };
export type Options = {
  fundingCategories: Option[];
  demographics: Option[];
  entityTypes: Option[];
  stages: Option[];
  industries: Option[];
};

export type Member = {
  id: string;
  email: string;
  name: string;
  role: "member" | "admin";
  hasPassword: boolean;
  digestOptOut: boolean;
  limits: { questions: number; drafts: number; businesses: number };
  usage: { questions: number; drafts: number };
};

export type Business = {
  _id: string;
  name: string;
  website: string;
  description: string;
  founders: string;
  highlights: string;
  industries: string[];
  stage: string;
  entityType: string;
  foundedYear?: number | null;
  teamSize?: number | null;
  country: string;
  state: string;
  city: string;
  founderDemographics: string[];
  seeking: string[];
  ignoreCategories: string[];
  ignoreKeywords: string[];
  amountMin?: number | null;
  amountMax?: number | null;
  useOfFunds: string;
  memberIds: string[];
  pendingInvites: string[];
};

export type Grant = {
  _id: string;
  title: string;
  agency?: string;
  fundingType?: string;
  category?: string;
  amountUsd?: number;
  link?: string;
  summary?: string;
  requirements?: string;
  targetDemographics?: string[];
  dueDate?: string;
  rolling?: boolean;
  contactEmail?: string;
  fit?: boolean;
  unfitReason?: string;
  score?: number;
  reasons?: string[];
  needsInput?: string[];
};

export type Stats = {
  matches: number;
  byCategory: Record<string, number>;
  applied: number;
  saved: number;
  dismissed: number;
};

export type Draft = {
  outreachEmail?: string;
  applicationNarrative?: string;
  requirementsChecklist?: { requirement: string; status: "drafted" | "needs_input" | "not_applicable"; detail?: string }[];
  updatedAt?: string;
};

export type OutboundEmail = {
  _id: string;
  grant?: string;
  grantTitle?: string;
  to: string;
  subject: string;
  body: string;
  source: "approval" | "inanna" | "manual";
  status: "draft" | "sent" | "discarded";
  sentVia?: "server" | "own_email";
  sentAt?: string;
  sendError?: string;
  updatedAt: string;
};

export type InannaAction = {
  type: "open" | "approve" | "archive" | "reject" | "draft_email";
  grantId: string;
  grantTitle: string;
  link: string | null;
  label: string | null;
  to?: string;
  subject?: string;
  body?: string;
};

export type Briefing = {
  matchCount: number;
  urgentCount: number;
  outboxDrafts: number;
  dueSoon: { id: string; title: string; status: string; days: number; amountUsd: number | null; link: string }[];
  topMatches: { id: string; title: string; amountUsd: number | null; category: string; deadline: string; reasons?: string[]; link: string }[];
  needsInput: { id: string; title: string; missing: string[] }[];
};

export function formatUsd(amount?: number | null) {
  return amount ? `$${amount.toLocaleString()}` : "";
}

export const labelOf = (list: Option[] | undefined, id?: string) => list?.find((o) => o.id === id)?.label || id || "";
