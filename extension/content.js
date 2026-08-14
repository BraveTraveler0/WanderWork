'use strict';

const API = 'https://wanderwork-backend-server.onrender.com';

const FIELD_RULES = [
  { key: 'firstName', labels: [/\bfirst\s*(?:legal\s*)?name\b/i, /\bgiven\s*name\b/i], selectors: ['#first_name', '[name="firstName"]', '[name="first_name"]', '[autocomplete="given-name"]'] },
  { key: 'lastName', labels: [/\blast\s*(?:legal\s*)?name\b/i, /\bfamily\s*name\b/i, /\bsurname\b/i], selectors: ['#last_name', '[name="lastName"]', '[name="last_name"]', '[autocomplete="family-name"]'] },
  { key: 'fullName', labels: [/\bfull\s*name\b/i, /\blegal\s*name\b/i, /\bname\s+as\s+it\s+appears/i], selectors: ['[name="full_name"]', '[autocomplete="name"]'], value: p => `${p.firstName || ''} ${p.lastName || ''}`.trim() },
  { key: 'email', labels: [/\be-?mail(?:\s+address)?\b/i], selectors: ['#email', '[name="email"]', '[type="email"]', '[autocomplete="email"]'] },
  { key: 'phoneCountryCode', labels: [/\bphone\s+country\s+code\b/i, /\bcountry\s+calling\s+code\b/i], value: p => String(p.phone || '').match(/^\+(\d{1,3})/)?.[1] || '' },
  { key: 'phone', labels: [/\b(?:phone|mobile|telephone)(?:\s+number)?\b/i], exclude: [/country\s+code/i, /extension/i], selectors: ['#phone', '[name="phone"]', '[type="tel"]', '[autocomplete="tel"]'] },
  { key: 'city', labels: [/\bcity\b/i, /\bmunicipality\b/i], selectors: ['#city', '[name="city"]', '[autocomplete="address-level2"]'] },
  { key: 'state', labels: [/\bstate(?:\/province)?\b/i, /\bprovince\b/i, /\bregion\b/i], selectors: ['[name="state"]', '[autocomplete="address-level1"]'] },
  { key: 'postalCode', labels: [/\b(?:zip|postal)\s*code\b/i], selectors: ['[name="zip"]', '[name="postalCode"]', '[name="postal_code"]', '[autocomplete="postal-code"]'] },
  { key: 'location', labels: [/\bcurrent\s+location\b/i, /\bhome\s+location\b/i, /\blocation\s*\(.*city/i], exclude: [/preferred/i, /job/i] },
  { key: 'linkedin', labels: [/linkedin/i], selectors: ['[name="urls[LinkedIn]"]', '[name*="linkedin" i]', '[placeholder*="linkedin" i]'] },
  { key: 'github', labels: [/github/i], selectors: ['[name="urls[Github]"]', '[name*="github" i]', '[placeholder*="github" i]'] },
  { key: 'portfolio', labels: [/portfolio/i, /recent\s+work/i, /work\s+samples?/i], exclude: [/password/i], selectors: ['[name="urls[Website]"]', '[name*="portfolio" i]', '[placeholder*="portfolio" i]'] },
  { key: 'otherWebsite', labels: [/other\s+(?:website|url)/i, /personal\s+website/i, /additional\s+(?:website|url)/i], exclude: [/linkedin|github|portfolio/i] },
  { key: 'school', labels: [/\b(?:university|college|school|institution)\b/i], exclude: [/high\s+school/i, /company/i] },
  { key: 'major', labels: [/\bmajor\b/i, /field\s+of\s+study/i, /area\s+of\s+study/i, /concentration/i, /academic\s+discipline/i] },
  { key: 'degree', labels: [/\bdegree(?:\s+type)?\b/i, /level\s+of\s+education/i], exclude: [/major/i] },
  { key: 'currentCompany', labels: [/current\s+(?:company|employer)/i, /most\s+recent\s+employer/i] },
  { key: 'currentTitle', labels: [/current\s+(?:job\s+)?title/i, /most\s+recent\s+(?:job\s+)?title/i] },
  { key: 'whyCompany', labels: [/why\s+(?:do|would)\s+you\s+(?:want|like)/i, /why\s+(?:are\s+you\s+)?interested/i, /what\s+(?:interests|excites)\s+you/i, /why\s+(?:this|our)\s+(?:company|role|position|team)/i], value: (p, el) => fitLongAnswer(p.whyCompany || p.coverLetterBody, el) },
  { key: 'coverLetter', labels: [/cover\s+letter/i, /letter\s+of\s+interest/i, /message\s+to\s+(?:the\s+)?hiring/i, /note\s+to\s+(?:the\s+)?hiring/i], exclude: [/upload|attach/i], value: (p, el) => fitLongAnswer(p.coverLetter || p.coverLetterBody, el) },
  { key: 'summary', labels: [/professional\s+summary/i, /briefly\s+describe\s+yourself/i, /tell\s+us\s+about\s+yourself/i], value: (p, el) => fitLongAnswer(p.summary, el) },
];

function normalizeFieldText(value) {
  return String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function fieldDescriptor(el) {
  const parts = [
    el.getAttribute('aria-label'),
    el.getAttribute('placeholder'),
    el.getAttribute('name'),
    el.id,
    el.getAttribute('autocomplete'),
  ];
  if (el.labels) parts.push(...Array.from(el.labels).map(label => label.textContent));
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    parts.push(...labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent));
  }
  let parent = el.parentElement;
  for (let depth = 0; parent && depth < 4; depth++, parent = parent.parentElement) {
    if (parent.matches('fieldset')) parts.push(parent.querySelector(':scope > legend')?.textContent);
    const previous = parent.previousElementSibling;
    if (previous?.matches?.('legend, h1, h2, h3, h4')) parts.push(previous.textContent);
  }
  return normalizeFieldText(parts.filter(Boolean).join(' | '));
}

function fitLongAnswer(value, el) {
  const text = String(value || '').trim();
  if (!text) return '';
  const limit = Number(el?.maxLength);
  if (!Number.isFinite(limit) || limit <= 0 || text.length <= limit) return text;
  const clipped = text.slice(0, limit + 1);
  const boundary = clipped.lastIndexOf(' ');
  return clipped.slice(0, boundary > limit * 0.7 ? boundary : limit).trim();
}

function isFillableControl(el) {
  if (!el || el.disabled || el.readOnly) return false;
  if (el instanceof HTMLInputElement && ['hidden', 'file', 'submit', 'button', 'reset', 'checkbox', 'radio'].includes(el.type)) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function dispatchFieldEvents(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

function setNativeValue(el, value) {
  const prototypes = [window.HTMLInputElement, window.HTMLTextAreaElement, window.HTMLSelectElement];
  const prototype = prototypes.find(type => type && el instanceof type)?.prototype;
  const setter = prototype && Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(el, value); else el.value = value;
}

function optionMatchScore(option, value) {
  const target = normalizeFieldText(value).toLowerCase();
  const label = normalizeFieldText(option?.textContent || option?.label || option?.value).toLowerCase();
  if (!target || !label) return 0;
  if (label === target) return 4;
  if (label.startsWith(target) || target.startsWith(label)) return 3;
  if (label.includes(target) || target.includes(label)) return 2;
  const targetWords = target.split(' ').filter(word => word.length > 2);
  return targetWords.length && targetWords.every(word => label.includes(word)) ? 1 : 0;
}

async function fillField(el, value) {
  if (!isFillableControl(el) || value == null || String(value).trim() === '') return false;
  const text = String(value).trim();

  if (el instanceof HTMLSelectElement) {
    const best = Array.from(el.options)
      .map(option => ({ option, score: optionMatchScore(option, text) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best?.score) return false;
    setNativeValue(el, best.option.value);
    dispatchFieldEvents(el);
    return true;
  }

  if (el.isContentEditable) {
    el.focus();
    el.textContent = text;
    dispatchFieldEvents(el);
    return true;
  }

  el.focus();
  setNativeValue(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

  if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete')) {
    await new Promise(resolve => setTimeout(resolve, 120));
    const best = Array.from(document.querySelectorAll('[role="option"], [data-option-index], li'))
      .filter(option => window.getComputedStyle(option).display !== 'none')
      .map(option => ({ option, score: optionMatchScore(option, text) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best?.score >= 2) best.option.click();
  }

  dispatchFieldEvents(el);
  return true;
}

async function autofill(profile) {
  let filled = 0;
  const claimed = new Set();
  const controls = Array.from(document.querySelectorAll('input, textarea, select, [contenteditable="true"]')).filter(isFillableControl);
  const descriptors = new Map(controls.map(el => [el, fieldDescriptor(el)]));

  for (const rule of FIELD_RULES) {
    const valueFor = el => rule.value ? rule.value(profile, el) : profile[rule.key];
    let candidates = controls.filter(el => {
      if (claimed.has(el)) return false;
      const descriptor = descriptors.get(el) || '';
      if (!rule.labels.some(pattern => pattern.test(descriptor))) return false;
      return !(rule.exclude || []).some(pattern => pattern.test(descriptor));
    });

    if (!candidates.length && rule.selectors) {
      candidates = rule.selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)))
        .filter(el => !claimed.has(el) && isFillableControl(el));
    }

    for (const el of candidates) {
      const value = valueFor(el);
      if (await fillField(el, value)) {
        claimed.add(el);
        filled++;
      }
    }
  }
  return filled;
}

async function fetchAutofillProfile(baseProfile, jobInfo) {
  const extensionKey = await new Promise(resolve => chrome.storage.local.get(['extensionKey'], data => resolve(data.extensionKey)));
  if (!extensionKey) return baseProfile;
  const params = new URLSearchParams({
    key: extensionKey,
    company: jobInfo.company || '',
    jobTitle: jobInfo.title || '',
    jobUrl: jobInfo.url || '',
  });
  try {
    const response = await fetch(`${API}/extension/profile?${params}`);
    if (!response.ok) return baseProfile;
    return { ...baseProfile, ...(await response.json()) };
  } catch (_) {
    return baseProfile;
  }
}

// ── Widget ────────────────────────────────────────────────────────────────────

const GENERIC_ATS_NAMES = new Set([
  'ashby', 'greenhouse', 'jobvite', 'lever', 'smartrecruiters', 'workable', 'workday',
  'careers', 'job board', 'jobs',
]);
const COMPANY_SUFFIXES = new Set([
  'co', 'company', 'corp', 'corporation', 'global', 'group', 'holdings', 'inc',
  'incorporated', 'international', 'limited', 'llc', 'ltd', 'plc', 'services',
  'solutions', 'systems', 'technologies', 'technology',
]);

function cleanCompanyLabel(value) {
  let decoded = String(value || '');
  try { decoded = decodeURIComponent(decoded); } catch (_) { /* keep the original value */ }
  return decoded
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericAtsName(value) {
  return GENERIC_ATS_NAMES.has(cleanCompanyLabel(value).toLowerCase());
}

function normalizeCompanyForMatch(value) {
  return cleanCompanyLabel(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .filter(word => !['the', 'a', 'an'].includes(word) && !COMPANY_SUFFIXES.has(word))
    .join(' ');
}

function getStructuredJobPosting() {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const stack = [JSON.parse(script.textContent || '{}')];
      while (stack.length) {
        const item = stack.pop();
        if (Array.isArray(item)) {
          stack.push(...item);
          continue;
        }
        if (!item || typeof item !== 'object') continue;
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (types.some(type => String(type).toLowerCase() === 'jobposting')) return item;
        stack.push(...Object.values(item).filter(value => value && typeof value === 'object'));
      }
    } catch (_) { /* malformed third-party metadata */ }
  }
  return null;
}

function getCompanyFromUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const host = parsed.hostname.toLowerCase();
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    let slug = '';

    if (host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') slug = pathParts[0] || '';
    else if (host.endsWith('.greenhouse.io')) slug = host.slice(0, -'.greenhouse.io'.length).split('.').pop() || '';
    else if (host === 'jobs.lever.co') slug = pathParts[0] || '';
    else if (host === 'jobs.ashbyhq.com') slug = pathParts[0] || '';
    else if (host === 'jobs.smartrecruiters.com' || host === 'careers.smartrecruiters.com') slug = pathParts[0] || '';
    else if (host === 'apply.workable.com') slug = pathParts[0] || '';
    else if (host === 'jobs.jobvite.com') slug = pathParts[0] || '';
    else if (host.endsWith('.myworkdayjobs.com')) slug = host.split('.')[0] || '';

    const company = cleanCompanyLabel(slug);
    return isGenericAtsName(company) ? '' : company;
  } catch (_) {
    return '';
  }
}

function getJobInfo() {
  const url = location.href;
  const structuredJob = getStructuredJobPosting();
  const pageHeading = document.querySelector('h1, [data-qa="job-title"], [class*="job-title" i], [class*="jobTitle"]')?.textContent || '';
  const title = String(structuredJob?.title || pageHeading || document.title || '')
    .replace(/\s*(?:-|\u2013|\u2014|\|)\s*(Greenhouse|Lever|Ashby|Workday|SmartRecruiters|Workable|Jobvite).*$/i, '')
    .replace(/\s*(?:-|\u2013|\u2014|\|)\s*Jobs?\s*$/i, '')
    .trim();

  let company = cleanCompanyLabel(structuredJob?.hiringOrganization?.name) || getCompanyFromUrl(url);
  if (!company) {
    const metadataCompany = document.querySelector('meta[property="og:site_name"]')?.content
      || document.querySelector('meta[name="application-name"]')?.content
      || '';
    if (!isGenericAtsName(metadataCompany)) company = cleanCompanyLabel(metadataCompany);
  }

  return { title, company, url };
}

function injectWidget(profile) {
  const existingWidget = document.getElementById('ww-widget');
  if (existingWidget) existingWidget.remove();

  const { title: jobTitle, company, url: jobUrl } = getJobInfo();
  const LOGO_URL = chrome.runtime.getURL('logo.svg');
  const SPARKLES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:5px;flex-shrink:0"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`;

  // ── Root container ───────────────────────────────────────────────────────
  const widget = document.createElement('div');
  widget.id = 'ww-widget';
  widget.dataset.jobUrl = jobUrl;
  Object.assign(widget.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  // ── Minimize button (appears at top on hover) ────────────────────────────
  const minimizeBtn = document.createElement('button');
  minimizeBtn.type = 'button';
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
  logoBall.type = 'button';
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
  autofillBtn.type = 'button';
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
  autofillBtn.addEventListener('click', async () => {
    autofillBtn.disabled = true;
    autofillBtn.textContent = 'Filling application...';
    const currentProfile = await fetchAutofillProfile(profile, { title: jobTitle, company, url: jobUrl });
    const count = await autofill(currentProfile);
    autofillBtn.innerHTML = count > 0 ? `✓ Filled ${count} fields` : '⚠ No fields found';
    autofillBtn.style.background = count > 0 ? '#27ae60' : '#c0392b';
    setTimeout(() => {
      autofillBtn.innerHTML = '⚡ Wander/Work Autofill';
      autofillBtn.style.background = '#306770';
      autofillBtn.disabled = false;
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

  // ── User info row (avatar + name + token count) ──────────────────────────
  const userInfoRow = document.createElement('div');
  Object.assign(userInfoRow.style, {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '7px 9px', borderRadius: '8px', background: '#F4FAF9',
  });
  const userAvatar = document.createElement('div');
  Object.assign(userAvatar.style, {
    width: '26px', height: '26px', borderRadius: '50%', flexShrink: '0',
    background: '#306770', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '10px', fontWeight: '700',
    color: '#fff', overflow: 'hidden',
  });
  const userAvatarImg = document.createElement('img');
  Object.assign(userAvatarImg.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'none' });
  const userAvatarInitials = document.createElement('span');
  userAvatarInitials.textContent = '…';
  userAvatar.append(userAvatarImg, userAvatarInitials);

  const userName = document.createElement('span');
  Object.assign(userName.style, { fontSize: '11px', fontWeight: '600', color: '#333', flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  userName.textContent = 'Loading…';

  const tokenBadge = document.createElement('span');
  Object.assign(tokenBadge.style, {
    fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px',
    background: '#306770', color: '#fff', flexShrink: '0', whiteSpace: 'nowrap',
  });
  tokenBadge.textContent = '…';

  userInfoRow.append(userAvatar, userName, tokenBadge);

  async function refreshUserInfo() {
    try {
      const extKey = await new Promise(r => chrome.storage.local.get(['extensionKey'], d => r(d.extensionKey)));
      if (!extKey) return;
      const res = await fetch(`${API}/extension/profile?key=${encodeURIComponent(extKey)}`);
      if (!res.ok) return;
      const p = await res.json();
      const initials = ((p.firstName || '')[0] || '') + ((p.lastName || '')[0] || '');
      userAvatarInitials.textContent = initials.toUpperCase() || '?';
      if (p.avatar) {
        userAvatarImg.src = p.avatar;
        userAvatarImg.onload = () => { userAvatarImg.style.display = 'block'; userAvatarInitials.style.display = 'none'; };
      }
      userName.textContent = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'You';
      const t = Number(p.tokens ?? 0);
      tokenBadge.textContent = `${t} token${t === 1 ? '' : 's'}`;
      tokenBadge.style.background = t === 0 ? '#c0392b' : '#306770';
    } catch {}
  }

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

  function resetSendBtn() {
    sendBtn.textContent = 'Send to my email';
    sendBtn.disabled = false;
    statusMsg.style.display = 'none';
  }
  resumeCb.addEventListener('change', resetSendBtn);
  clCb.addEventListener('change', resetSendBtn);

  // ── Format toggle ──────────────────────────────────────────────────────
  let fileFormat = 'pdf';
  const formatRow = document.createElement('div');
  Object.assign(formatRow.style, { display: 'flex', gap: '6px' });

  ['PDF', 'DOCX'].forEach(fmt => {
    const pill = document.createElement('button');
    pill.type = 'button';
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
      resetSendBtn();
    });
    formatRow.appendChild(pill);
  });

  const statusMsg = document.createElement('p');
  Object.assign(statusMsg.style, { fontSize: '11px', margin: '0', display: 'none' });

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
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

  panel.append(panelTitle, jobInfo, userInfoRow, resumeRow, clRow, formatRow, statusMsg, sendBtn);

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
  recruiterBtn.type = 'button';
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
  docBtn.type = 'button';
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
    if (!open) refreshUserInfo();
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
        const res = await fetch(`${API}/extension/recruiters?key=${encodeURIComponent(extensionKey)}&company=${encodeURIComponent(company)}`);
        const data = await res.json().catch(() => ({ recruiters: [] }));
        const targetCompany = normalizeCompanyForMatch(company);
        const recruiters = (data.recruiters || [])
          .filter(recruiter => normalizeCompanyForMatch(recruiter.company) === targetCompany);
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
  let activeJobUrl = '';
  let refreshTimer = null;

  const refreshForActiveJob = () => {
    const currentUrl = location.href;
    const currentWidget = document.getElementById('ww-widget');
    if (currentUrl === activeJobUrl && currentWidget?.dataset.jobUrl === currentUrl) return;

    activeJobUrl = currentUrl;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => injectWidget(profile), 500);
  };

  refreshForActiveJob();
  window.addEventListener('popstate', refreshForActiveJob);
  setInterval(refreshForActiveJob, 1500);
});
