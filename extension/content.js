'use strict';

const API = 'https://wanderwork-backend-server.onrender.com';

const FIELDS = [
  { key: 'firstName', selectors: ['#first_name', '[name="firstName"]', '[name="first_name"]', '[autocomplete="given-name"]', '[placeholder*="First name" i]'] },
  { key: 'lastName',  selectors: ['#last_name',  '[name="lastName"]',  '[name="last_name"]',  '[autocomplete="family-name"]', '[placeholder*="Last name" i]'] },
  { key: 'fullName',  selectors: ['[name="name"]', '[name="full_name"]', '[autocomplete="name"]', '[placeholder*="Full name" i]'], getValue: (p) => `${p.firstName} ${p.lastName}`.trim() },
  { key: 'email',     selectors: ['#email', '[name="email"]', '[type="email"]', '[autocomplete="email"]'] },
  { key: 'phone',     selectors: ['#phone', '[name="phone"]', '[type="tel"]', '[autocomplete="tel"]', '[placeholder*="phone" i]'] },
  { key: 'city',      selectors: ['#city', '[name="city"]', '[autocomplete="address-level2"]', '[placeholder*="city" i]', '[name*="location" i]', '[placeholder*="location" i]', '[id*="location" i]'] },
  { key: 'state',     selectors: ['[name="state"]', '[autocomplete="address-level1"]', '[name*="state" i]'] },
  { key: 'postalCode',selectors: ['[name="zip"]', '[name="postalCode"]', '[name="postal_code"]', '[autocomplete="postal-code"]', '[placeholder*="zip" i]'] },
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

  let company = '';
  const ghMatch  = url.match(/boards\.greenhouse\.io\/([^/]+)/i) || url.match(/\.greenhouse\.io\/jobs\//i);
  const levMatch = url.match(/jobs\.lever\.co\/([^/]+)/i);
  const ashMatch = url.match(/jobs\.ashbyhq\.com\/([^/]+)/i);
  const srMatch  = url.match(/jobs\.smartrecruiters\.com\/([^/]+)/i);
  if (ghMatch?.[1])  company = ghMatch[1].replace(/-/g, ' ');
  else if (levMatch?.[1]) company = levMatch[1].replace(/-/g, ' ');
  else if (ashMatch?.[1]) company = ashMatch[1].replace(/-/g, ' ');
  else if (srMatch?.[1])  company = srMatch[1].replace(/-/g, ' ');

  if (!company) {
    company = document.querySelector('meta[property="og:site_name"]')?.content || '';
  }

  return { title, company: company.replace(/\b\w/g, c => c.toUpperCase()), url };
}

// ── Widget ────────────────────────────────────────────────────────────────────

function injectWidget(profile) {
  if (document.getElementById('ww-widget')) return;

  const { title: jobTitle, company, url: jobUrl } = getJobInfo();
  const LOGO_URL = chrome.runtime.getURL('logo.svg');
  const SPARKLES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:5px;flex-shrink:0"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`;

  // ── Root container ───────────────────────────────────────────────────────
  const widget = document.createElement('div');
  widget.id = 'ww-widget';
  Object.assign(widget.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  // ── Minimize button (appears at top on hover) ────────────────────────────
  const minimizeBtn = document.createElement('button');
  minimizeBtn.title = 'Minimize';
  minimizeBtn.textContent = '−';
  Object.assign(minimizeBtn.style, {
    background: 'rgba(48,103,112,0.15)', color: '#306770', border: 'none',
    borderRadius: '50%', width: '22px', height: '22px', fontSize: '16px', fontWeight: '400',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: '0', transition: 'opacity 0.2s',
    pointerEvents: 'none', lineHeight: '1',
  });

  // ── Logo ball (minimized state) ──────────────────────────────────────────
  const logoBall = document.createElement('button');
  logoBall.title = 'Wander/Work — click to expand';
  const logoImg = document.createElement('img');
  logoImg.src = LOGO_URL;
  Object.assign(logoImg.style, { width: '26px', height: '26px', filter: 'brightness(0) invert(1)', display: 'block' });
  logoBall.appendChild(logoImg);
  Object.assign(logoBall.style, {
    width: '48px', height: '48px', borderRadius: '50%',
    background: '#306770', border: 'none', cursor: 'pointer',
    display: 'none', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(48,103,112,0.4)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    padding: '0',
  });
  logoBall.addEventListener('mouseenter', () => {
    logoBall.style.transform = 'scale(1.08)';
    logoBall.style.boxShadow = '0 6px 20px rgba(48,103,112,0.5)';
  });
  logoBall.addEventListener('mouseleave', () => {
    logoBall.style.transform = 'scale(1)';
    logoBall.style.boxShadow = '0 4px 16px rgba(48,103,112,0.4)';
  });

  // ── Autofill button ──────────────────────────────────────────────────────
  const autofillBtn = document.createElement('button');
  autofillBtn.id = 'ww-autofill-btn';
  autofillBtn.innerHTML = '⚡ Wander/Work Autofill';
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
    autofillBtn.innerHTML = count > 0 ? `✓ Filled ${count} fields` : '⚠ No fields found';
    autofillBtn.style.background = count > 0 ? '#27ae60' : '#c0392b';
    setTimeout(() => {
      autofillBtn.innerHTML = '⚡ Wander/Work Autofill';
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
  const titleHasCompany = company && jobTitle.toLowerCase().includes(company.toLowerCase());
  jobInfo.textContent = jobTitle ? `${jobTitle}${company && !titleHasCompany ? ' at ' + company : ''}` : 'This job';
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

  // ── Doc toggle button ────────────────────────────────────────────────────
  const docBtn = document.createElement('button');
  docBtn.innerHTML = `${SPARKLES_SVG}Get Resume / Cover Letter`;
  Object.assign(docBtn.style, {
    background: '#fff', color: '#306770', border: '1.5px solid #306770',
    borderRadius: '24px', padding: '8px 16px', fontSize: '12px', fontWeight: '700',
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
    transition: 'background 0.15s, color 0.15s, transform 0.1s', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center',
  });
  docBtn.addEventListener('mouseenter', () => { docBtn.style.background = '#306770'; docBtn.style.color = '#fff'; docBtn.style.transform = 'scale(1.03)'; });
  docBtn.addEventListener('mouseleave', () => { docBtn.style.background = '#fff'; docBtn.style.color = '#306770'; docBtn.style.transform = 'scale(1)'; });
  docBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = panel.style.display === 'flex';
    panel.style.display = open ? 'none' : 'flex';
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== docBtn) panel.style.display = 'none';
  });

  // ── Minimize / expand logic ──────────────────────────────────────────────
  const expandedEls = [panel, autofillBtn, docBtn];

  function setMinimized(val) {
    if (val) {
      expandedEls.forEach(el => { el.style.display = 'none'; });
      minimizeBtn.style.opacity = '0';
      minimizeBtn.style.pointerEvents = 'none';
      logoBall.style.display = 'flex';
    } else {
      logoBall.style.display = 'none';
      // restore display values (panel stays hidden until toggled)
      autofillBtn.style.display = '';
      docBtn.style.display = 'flex';
    }
  }

  widget.addEventListener('mouseenter', () => {
    if (logoBall.style.display !== 'flex') {
      minimizeBtn.style.opacity = '1';
      minimizeBtn.style.pointerEvents = 'auto';
    }
  });
  widget.addEventListener('mouseleave', () => {
    minimizeBtn.style.opacity = '0';
    minimizeBtn.style.pointerEvents = 'none';
  });

  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMinimized(true);
  });

  logoBall.addEventListener('click', () => setMinimized(false));

  // DOM order: minimizeBtn at top, then panel, autofill, doc, logoBall at bottom
  widget.append(minimizeBtn, panel, autofillBtn, docBtn, logoBall);
  document.body.appendChild(widget);
}

// Inject whenever the user is connected, regardless of form presence
chrome.storage.local.get(['profile'], ({ profile }) => {
  if (!profile) return;
  injectWidget(profile);
});
