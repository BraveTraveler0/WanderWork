const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'https://application-server-cwqu.onrender.com';

export type Plan = 'pro' | 'premium';

export async function createCheckoutSession(plan: Plan, email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/stripe/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

export async function openCustomerPortal(email: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/stripe/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
