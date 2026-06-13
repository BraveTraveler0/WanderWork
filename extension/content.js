'use strict';

const API = 'https://wanderwork-backend-server.onrender.com';

// Field selectors tried in order — first match wins
const FIELDS = [
  { key: 'firstName', selectors: ['#first_name', '[name="firstName"]', '[name="first_name"]', '[autocomplete="given-name"]', '[placeholder*="First name" i]'] },
  { key: 'lastName',  selectors: ['#last_name',  '[name="lastName"]',  '[name="last_name"]',  '[autocomplete="family-name"]', '[placeholder*="Last name" i]'] },
  { key: 'fullName',  selectors: ['[name="name"]', '[name="full_name"]', '[autocomplete="name"]', '[placeholder*="Full name" i]'], getValue: (p) => `${p.firstName} ${p.lastName}`.trim() },
  { key: 'email',     selectors: ['#email', '[name="email"]', '[type="email"]', '[autocomplete="email"]'] },
  { key: 'phone',     selectors: ['#phone', '[name="phone"]', '[type="tel"]', '[autocomplete="tel"]', '[placeholder*="phone" i]'] },
  { key: 'city',      selectors: ['#city', '[name="city"]', '[autocomplete="address-level2"]', '[placeholder*="city" i]'] },
  { key: 'state',     selectors: ['[name="state"]', '[autocomplete="address-level1"]'] },
  { key: 'postalCode',selectors: ['[name="zip"]', '[name="postalCode"]', '[name="postal_code"]', '[autocomplete="postal-code"]'] },
  { key: 'linkedin',  selectors: ['[name="urls[LinkedIn]"]', '[name="linkedin"]', '[placeholder*="linkedin" i]'] },
  { key: 'portfolio', selectors: ['[name="urls[Website]"]', '[name="portfolio"]', '[name="website"]', '[placeholder*="portfolio" i]', '[placeholder*="website" i]'] },
  { key: 'github',    selectors: ['[name="urls[Github]"]', '[name="github"]', '[placeholder*="github" i]'] },
];

function fillField(el, value) {
  if (!el || !value) return false;
  const nativeSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(el, value); else el.value = value;
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function autofill(profile) {
  let filled = 0;
  for (const field of FIELDS) {
    const value = field.getValue ? field.getValue(profile) : profile[field.key];
    if (!value) continue;
    for (const sel of field.selectors) {
      const el = document.querySelector(sel);
      if (el && fillField(el, value)) { filled++; break; }
    }
  }
  return filled;
}

function getJobInfo() {
  const url = location.href;
  const title = document.title
    .replace(/\s*[-–|]\s*(Greenhouse|Lever|Ashby|Workday|SmartRecruiters|Workable|Jobvite).*$/i, '')
    .replace(/\s*[-–|]\s*Jobs?\s*$/i, '')
    .trim();

  // Try to pull company from URL slug
  let company = '';
  const ghMatch  = url.match(/boards\.greenhouse\.io\/([^/]+)/i) || url.match(/\.greenhouse\.io\/jobs\//i);
  const levMatch = url.match(/jobs\.lever\.co\/([^/]+)/i);
  const ashMatch = url.match(/jobs\.ashbyhq\.com\/([^/]+)/i);
  const srMatch  = url.match(/jobs\.smartrecruiters\.com\/([^/]+)/i);
  if (ghMatch?.[1])  company = ghMatch[1].replace(/-/g, ' ');
  else if (levMatch?.[1]) company = levMatch[1].replace(/-/g, ' ');
  else if (ashMatch?.[1]) company = ashMatch[1].replace(/-/g, ' ');
  else if (srMatch?.[1])  company = srMatch[1].replace(/-/g, ' ');

  // Fallback: try OG meta tags
  if (!company) {
    company = document.querySelector('meta[property="og:site_name"]')?.content || '';
  }

  return { title, company: company.replace(/\b\w/g, c => c.toUpperCase()), url };
}

// ── Widget ────────────────────────────────────────────────────────────────────

function injectWidget(profile) {
  if (document.getElementById('ww-widget')) return;

  const { title: jobTitle, company, url: jobUrl } = getJobInfo();

  // Wrapper — fixed bottom-right
  const widget = document.createElement('div');
  widget.id = 'ww-widget';
  Object.assign(widget.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  // ── Autofill button ──────────────────────────────────────────────────────
  const autofillBtn = document.createElement('button');
  autofillBtn.id = 'ww-autofill-btn';
  autofillBtn.textContent = 'Wander/Work Autofill';
  Object.assign(autofillBtn.style, {
    background: '#306770', color: '#fff', border: 'none', borderRadius: '24px',
    padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(48,103,112,0.35)', transition: 'background 0.15s, transform 0.1s',
    letterSpacing: '-0.2px', whiteSpace: 'nowrap',
  });
  autofillBtn.addEventListener('mouseenter', () => { autofillBtn.style.background = '#255860'; autofillBtn.style.transform = 'scale(1.03)'; });
  autofillBtn.addEventListener('mouseleave', () => { autofillBtn.style.background = '#306770'; autofillBtn.style.transform = 'scale(1)'; });
  autofillBtn.addEventListener('click', () => {
    const count = autofill(profile);
    autofillBtn.textContent = count > 0 ? `✓ Filled ${count} fields` : '⚠ No fields found';
    autofillBtn.style.background = count > 0 ? '#27ae60' : '#c0392b';
    setTimeout(() => {
      autofillBtn.textContent = 'Wander/Work Autofill';
      autofillBtn.style.background = '#306770';
    }, 2500);
  });

  // ── Document panel ───────────────────────────────────────────────────────
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    background: '#fff', borderRadius: '14px', padding: '16px 18px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)', width: '260px',
    display: 'none', flexDirection: 'column', gap: '10px',
  });

  const panelTitle = document.createElement('p');
  panelTitle.textContent = 'Get Resume or Cover Letter';
  Object.assign(panelTitle.style, { fontSize: '13px', fontWeight: '700', color: '#306770', margin: '0' });

  const jobInfo = document.createElement('p');
  jobInfo.textContent = jobTitle ? `${jobTitle}${company ? ' at ' + company : ''}` : 'This job';
  Object.assign(jobInfo.style, { fontSize: '11px', color: '#888', margin: '0', lineHeight: '1.4' });

  const checkRow = (label, checked) => {
    const row = document.createElement('label');
    Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#333', cursor: 'pointer' });
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = checked;
    Object.assign(cb.style, { accentColor: '#306770', width: '14px', height: '14px' });
    row.appendChild(cb);
    row.appendChild(document.createTextNode(label));
    return { row, cb };
  };

  const { row: resumeRow, cb: resumeCb } = checkRow('Resume (1 token)', true);
  const { row: clRow, cb: clCb } = checkRow('Cover Letter (1 token)', false);

  const statusMsg = document.createElement('p');
  Object.assign(statusMsg.style, { fontSize: '11px', margin: '0', display: 'none' });

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send to my email';
  Object.assign(sendBtn.style, {
    background: '#306770', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '9px 0', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
    width: '100%', transition: 'background 0.15s',
  });
  sendBtn.addEventListener('mouseenter', () => { sendBtn.style.background = '#255860'; });
  sendBtn.addEventListener('mouseleave', () => { sendBtn.style.background = '#306770'; });

  sendBtn.addEventListener('click', async () => {
    if (!resumeCb.checked && !clCb.checked) {
      statusMsg.textContent = 'Select at least one document.';
      statusMsg.style.color = '#c0392b';
      statusMsg.style.display = 'block';
      return;
    }
    sendBtn.textContent = 'Sending…';
    sendBtn.disabled = true;
    statusMsg.style.display = 'none';

    const extKey = await new Promise(r => chrome.storage.local.get(['extensionKey'], d => r(d.extensionKey)));
    try {
      const res = await fetch(`${API}/extension/request-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-extension-key': extKey },
        body: JSON.stringify({ jobTitle, company, jobUrl, resume: resumeCb.checked, coverLetter: clCb.checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Request failed.');
      statusMsg.textContent = '✓ Check your email — arriving in ~2 min.';
      statusMsg.style.color = '#27ae60';
      statusMsg.style.display = 'block';
      sendBtn.textContent = 'Sent!';
    } catch (err) {
      statusMsg.textContent = err.message || 'Something went wrong.';
      statusMsg.style.color = '#c0392b';
      statusMsg.style.display = 'block';
      sendBtn.textContent = 'Send to my email';
      sendBtn.disabled = false;
    }
  });

  panel.append(panelTitle, jobInfo, resumeRow, clRow, statusMsg, sendBtn);

  // ── Toggle button ────────────────────────────────────────────────────────
  const docBtn = document.createElement('button');
  docBtn.textContent = 'Get Resume / Cover Letter';
  Object.assign(docBtn.style, {
    background: '#fff', color: '#306770', border: '1.5px solid #306770',
    borderRadius: '24px', padding: '8px 16px', fontSize: '12px', fontWeight: '700',
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    transition: 'background 0.15s, color 0.15s, transform 0.1s', whiteSpace: 'nowrap',
  });
  docBtn.addEventListener('mouseenter', () => { docBtn.style.background = '#306770'; docBtn.style.color = '#fff'; docBtn.style.transform = 'scale(1.03)'; });
  docBtn.addEventListener('mouseleave', () => { docBtn.style.background = '#fff'; docBtn.style.color = '#306770'; docBtn.style.transform = 'scale(1)'; });
  docBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = panel.style.display === 'flex';
    panel.style.display = open ? 'none' : 'flex';
  });

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== docBtn) panel.style.display = 'none';
  });

  widget.append(panel, docBtn, autofillBtn);
  document.body.appendChild(widget);
}

// Inject whenever the user is connected, regardless of form presence
chrome.storage.local.get(['profile'], ({ profile }) => {
  if (!profile) return;
  injectWidget(profile);
});
