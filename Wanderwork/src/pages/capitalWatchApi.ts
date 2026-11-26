// Shared fetch helper for the Capital Watch dashboard, Inanna, and the Outbox.
export const API_BASE =
  import.meta.env.VITE_CAPITALWATCH_API_BASE_URL || "http://localhost:8000";
const CAPITAL_WATCH_KEY = import.meta.env.VITE_CAPITAL_WATCH_KEY || "";

export async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/capitalwatch${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-capitalwatch-key": CAPITAL_WATCH_KEY,
      ...(options.headers || {}),
    },
  });
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
