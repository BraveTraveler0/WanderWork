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

  // ── Format toggle ──────────────────────────────────────────────────────
  let fileFormat = 'pdf';
  const formatRow = document.createElement('div');
  Object.assign(formatRow.style, { display: 'flex', gap: '6px' });

  ['PDF', 'DOCX'].forEach(fmt => {
    const pill = document.createElement('button');
    pill.textContent = fmt;
    pill.dataset.fmt = fmt.toLowerCase();
    const active = fmt === 'PDF';
    Object.assign(pill.style, {
      flex: '1', padding: '5px 0', fontSize: '11px', fontWeight: '700',
      border: '1.5px solid #306770', borderRadius: '6px', cursor: 'pointer',
      background: active ? '#306770' : '#fff',
      color: active ? '#fff' : '#306770',
      transition: 'background 0.15s, color 0.15s',
    });
    pill.addEventListener('click', () => {
      fileFormat = pill.dataset.fmt;
      formatRow.querySelectorAll('button').forEach(b => {
        const sel = b.dataset.fmt === fileFormat;
        b.style.background = sel ? '#306770' : '#fff';
        b.style.color = sel ? '#fff' : '#306770';
      });
    });
    formatRow.appendChild(pill);
  });

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
        body: JSON.stringify({ jobTitle, company, jobUrl, resume: resumeCb.checked, coverLetter: clCb.checked, fileFormat }),
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

  panel.append(panelTitle, jobInfo, resumeRow, clRow, formatRow, statusMsg, sendBtn);

  // ── Recruiter panel ──────────────────────────────────────────────────────
  const USERS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:5px;flex-shrink:0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

  const recruiterPanel = document.createElement('div');
  Object.assign(recruiterPanel.style, {
    background: '#fff', borderRadius: '14px', padding: '14px 16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)', width: '260px',
    display: 'none', flexDirection: 'column', gap: '8px',
  });

  const recruiterPanelTitle = document.createElement('p');
  recruiterPanelTitle.textContent = 'Recruiters at ' + (company || 'this company');
  Object.assign(recruiterPanelTitle.style, { fontSize: '12px', fontWeight: '700', color: '#306770', margin: '0' });

  const recruiterList = document.createElement('div');
  Object.assign(recruiterList.style, { display: 'flex', flexDirection: 'column', gap: '6px' });

  const recruiterOpenLink = document.createElement('a');
  recruiterOpenLink.textContent = 'Open in Wander/Work →';
  recruiterOpenLink.href = `https://wanderwork.io?recruiterCompany=${encodeURIComponent(company || '')}`;
  recruiterOpenLink.target = '_blank';
  Object.assign(recruiterOpenLink.style, {
    fontSize: '11px', color: '#306770', textDecoration: 'none', fontWeight: '700',
    marginTop: '2px', display: 'block', textAlign: 'right',
  });

  recruiterPanel.append(recruiterPanelTitle, recruiterList, recruiterOpenLink);

  const recruiterBtn = document.createElement('button');
  recruiterBtn.innerHTML = `${USERS_SVG}Contact Recruiter`;
  Object.assign(recruiterBtn.style, {
    background: 'linear-gradient(135deg, #e8f4f6 0%, #d0eaee 100%)',
    color: '#306770', border: '1.5px solid rgba(48,103,112,0.35)',
    borderRadius: '24px', padding: '8px 16px', fontSize: '12px', fontWeight: '700',
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(48,103,112,0.12)',
    transition: 'all 0.15s', whiteSpace: 'nowrap',
    display: 'none', alignItems: 'center',
  });
  recruiterBtn.addEventListener('mouseenter', () => {
    recruiterBtn.style.background = '#306770';
    recruiterBtn.style.color = '#fff';
    recruiterBtn.style.border = '1.5px solid #306770';
    recruiterBtn.style.transform = 'scale(1.03)';
  });
  recruiterBtn.addEventListener('mouseleave', () => {
    recruiterBtn.style.background = 'linear-gradient(135deg, #e8f4f6 0%, #d0eaee 100%)';
    recruiterBtn.style.color = '#306770';
    recruiterBtn.style.border = '1.5px solid rgba(48,103,112,0.35)';
    recruiterBtn.style.transform = 'scale(1)';
  });
  recruiterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = recruiterPanel.style.display === 'flex';
    recruiterPanel.style.display = open ? 'none' : 'flex';
    panel.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!recruiterPanel.contains(e.target) && e.target !== recruiterBtn) recruiterPanel.style.display = 'none';
  });

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
  let hasRecruiters = false;

  function setMinimized(val) {
    if (val) {
      [panel, recruiterPanel, autofillBtn, docBtn, recruiterBtn].forEach(el => { el.style.display = 'none'; });
      minimizeBtn.style.opacity = '0';
      minimizeBtn.style.pointerEvents = 'none';
      logoBall.style.display = 'flex';
    } else {
      logoBall.style.display = 'none';
      autofillBtn.style.display = '';
      docBtn.style.display = 'flex';
      if (hasRecruiters) recruiterBtn.style.display = 'flex';
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

  minimizeBtn.addEventListener('click', (e) => { e.stopPropagation(); setMinimized(true); });
  logoBall.addEventListener('click', () => setMinimized(false));

  // DOM: minimizeBtn top → panels → autofill → doc → recruiter → logoBall bottom
  widget.append(minimizeBtn, panel, recruiterPanel, autofillBtn, docBtn, recruiterBtn, logoBall);
  document.body.appendChild(widget);

  // ── Async: fetch recruiters for this company ─────────────────────────────
  if (company) {
    chrome.storage.local.get(['extensionKey'], async ({ extensionKey }) => {
      if (!extensionKey) return;
      try {
        const res = await fetch(`${API}/extension/recruiters?company=${encodeURIComponent(company)}`, {
          headers: { 'x-extension-key': extensionKey },
        });
        const data = await res.json().catch(() => ({ recruiters: [] }));
        const recruiters = data.recruiters || [];
        if (!recruiters.length) return;

        hasRecruiters = true;

        const SPECIALTY_COLORS = {
          tech:       { bg: '#EEF4FF', text: '#3B6FD4' },
          creative:   { bg: '#FFF4EE', text: '#C45A1A' },
          product:    { bg: '#F0FAF4', text: '#2A7A50' },
          data:       { bg: '#F5F0FF', text: '#6B3AB0' },
          sales:      { bg: '#FFF8EE', text: '#B06A1A' },
          operations: { bg: '#F3F4F6', text: '#555555' },
          finance:    { bg: '#F0F8FF', text: '#1A6AB0' },
          healthcare: { bg: '#FFF0F5', text: '#B0386A' },
          legal:      { bg: '#F5F0FF', text: '#6B3AB0' },
          business:   { bg: '#F0FAF4', text: '#2A7A50' },
          general:    { bg: '#F3F4F6', text: '#555555' },
        };

        recruiters.forEach(r => {
          const card = document.createElement('div');
          Object.assign(card.style, {
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 10px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #f7fbfc 0%, #eef6f8 100%)',
            border: '1px solid rgba(48,103,112,0.12)',
          });

          // Avatar circle with initials
          const avatar = document.createElement('div');
          const initials = ((r.firstName?.[0] || '') + (r.lastName?.[0] || '') || r.name?.[0] || '?').toUpperCase();
          Object.assign(avatar.style, {
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: '0',
            background: 'linear-gradient(135deg, #306770, #255860)',
            color: '#fff', fontSize: '12px', fontWeight: '700',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          });
          avatar.textContent = initials;

          const info = document.createElement('div');
          Object.assign(info.style, { flex: '1', minWidth: '0' });

          const nameEl = document.createElement('p');
          nameEl.textContent = r.name || `${r.firstName || ''} ${r.lastName || ''}`.trim();
          Object.assign(nameEl.style, { fontSize: '12px', fontWeight: '700', color: '#1a1a1a', margin: '0', lineHeight: '1.3' });

          const meta = document.createElement('div');
          Object.assign(meta.style, { display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' });

          if (r.jobTitle) {
            const title = document.createElement('span');
            title.textContent = r.jobTitle;
            Object.assign(title.style, { fontSize: '10px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' });
            meta.appendChild(title);
          }

          if (r.specialty) {
            const colors = SPECIALTY_COLORS[r.specialty] || SPECIALTY_COLORS.general;
            const badge = document.createElement('span');
            badge.textContent = r.specialty.charAt(0).toUpperCase() + r.specialty.slice(1);
            Object.assign(badge.style, {
              fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '99px',
              background: colors.bg, color: colors.text, whiteSpace: 'nowrap', flexShrink: '0',
            });
            meta.appendChild(badge);
          }

          info.append(nameEl, meta);
          card.append(avatar, info);
          recruiterList.appendChild(card);
        });

        recruiterBtn.innerHTML = `${USERS_SVG}Contact Recruiter${recruiters.length > 1 ? 's (' + recruiters.length + ')' : ''}`;
        recruiterBtn.style.display = 'flex';
      } catch (_) { /* silently skip */ }
    });
  }
}

// Inject whenever the user is connected, regardless of form presence
chrome.storage.local.get(['profile'], ({ profile }) => {
  if (!profile) return;
  injectWidget(profile);
});
