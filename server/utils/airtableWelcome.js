const CANDIDATES_TABLE_ID = 'tblAtJ5JRvlyT2s6i';

async function upsertAirtableNewSignup({ email, firstName, lastName, phone, plan, tokenBalance }) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!token || !baseId || !email) return;

  const normalizedEmail = String(email).toLowerCase();
  const baseUrl = `https://api.airtable.com/v0/${baseId}/${CANDIDATES_TABLE_ID}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    const filter = encodeURIComponent(`LOWER({email})='${normalizedEmail.replace(/'/g, "\\'")}'`);
    const lookup = await fetch(`${baseUrl}?maxRecords=1&filterByFormula=${filter}`, { headers });
    if (lookup.ok) {
      const data = await lookup.json();
      const existing = data?.records?.[0];
      if (existing?.id) {
        await fetch(`${baseUrl}/${existing.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields: { status: 'welcome_email' } }),
        });
        return;
      }
    }

    await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          email: normalizedEmail,
          first_name: firstName || '',
          last_name: lastName || '',
          phone: phone || '',
          plan: plan || 'free',
          tokens_balance: typeof tokenBalance === 'number' ? tokenBalance : 30,
          status: 'welcome_email',
        },
      }),
    });
  } catch (err) {
    console.warn('[upsertAirtableNewSignup] Failed:', err.message);
  }
}

module.exports = { upsertAirtableNewSignup };
