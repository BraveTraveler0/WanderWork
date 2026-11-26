// Shared fetch helper for the Capital Watch dashboard, Inanna, and the Outbox.
// Set VITE_CAPITALWATCH_API_BASE_URL=http://localhost:8000 in .env for local development.
export const API_BASE =
  import.meta.env.VITE_CAPITALWATCH_API_BASE_URL || "https://wanderwork-backend-server.onrender.com";

// The access key is typed in by a teammate and kept in this browser only. It is never
// built into the site's code, where anyone could read it.
const KEY_STORAGE = "capitalwatch.key";
let memoryKey = "";

export function getKey() {
  try { return localStorage.getItem(KEY_STORAGE) || memoryKey; } catch { return memoryKey; }
}

export function setKey(key: string) {
  memoryKey = key;
  try { localStorage.setItem(KEY_STORAGE, key); } catch { /* storage blocked: kept for this tab */ }
}

export function clearKey() {
  memoryKey = "";
  try { localStorage.removeItem(KEY_STORAGE); } catch { /* storage blocked */ }
}

export async function api(path: string, options: RequestInit = {}, keyOverride?: string) {
  const res = await fetch(`${API_BASE}/capitalwatch${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-capitalwatch-key": keyOverride ?? getKey(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && keyOverride === undefined) {
    // Key missing, wrong, or changed on the server: ask for it again.
    clearKey();
    window.dispatchEvent(new Event("capitalwatch:locked"));
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
  return res.json();
}

export type OutboundEmail = {
  _id: string;
  grant?: string;
  grantTitle?: string;
  company?: string;
  to: string;
  subject: string;
  body: string;
  source: "approval" | "inanna" | "manual";
  status: "draft" | "sent" | "discarded";
  sentAt?: string;
  sendError?: string;
  updatedAt: string;
};

export type InannaAction = {
  type: "open" | "approve" | "archive" | "reject" | "draft_email";
  grantId: string;
  grantTitle: string;
  link: string | null;
  companyId?: string;
  label: string | null;
  to?: string;
  subject?: string;
  body?: string;
};

export type Briefing = {
  pendingCount: number;
  urgentCount: number;
  outboxDrafts: number;
  dueSoon: { id: string; title: string; status: string; days: number; amountUsd: number | null; link: string }[];
  topMatches: { id: string; title: string; amountUsd: number | null; fundingType: string; deadline: string; link: string }[];
  needsInput: { id: string; title: string; company: string | null; missing: string[] }[];
};

export function formatUsd(amount?: number | null) {
  return amount ? `$${amount.toLocaleString()}` : "";
}
