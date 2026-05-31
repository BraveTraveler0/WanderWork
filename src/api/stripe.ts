const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'https://wanderwork-backend-server.onrender.com';

export type Plan = 'pro' | 'premium';

function getAuthHeader(): Record<string, string> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('wanderworkToken') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function createCheckoutSession(plan: Plan, email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/stripe/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ plan, email }),
  });
  if (!res.ok) {
    let msg = `Checkout failed (${res.status})`;
    try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  const { url } = await res.json();
  return url;
}

export async function createTokenCheckoutSession(tokens: number, email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/stripe/create-token-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ tokens, email }),
  });
  if (!res.ok) {
    let msg = `Token checkout failed (${res.status})`;
    try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  const { url } = await res.json();
  return url;
}

export async function redeemPromoCode(code: string, email: string, tokens: number): Promise<{ tokenBalance: number; added: number }> {
  const res = await fetch(`${BASE_URL}/stripe/redeem-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ code, email, tokens }),
  });
  let j: any = {};
  try { j = await res.json(); } catch {}
  if (!res.ok) throw new Error(j?.message || `Code redemption failed (${res.status})`);
  return j;
}

export async function openCustomerPortal(email: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/stripe/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    let msg = 'Could not open billing portal';
    try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
    throw new Error(msg);
  }
  const { url } = await res.json();
  window.location.href = url;
}
