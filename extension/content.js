'use strict';

// Field selectors tried in order — first match wins
const FIELDS = [
  {
    key: 'firstName',
    selectors: ['#first_name', '[name="firstName"]', '[name="first_name"]', '[autocomplete="given-name"]', '[placeholder*="First name" i]'],
  },
  {
    key: 'lastName',
    selectors: ['#last_name', '[name="lastName"]', '[name="last_name"]', '[autocomplete="family-name"]', '[placeholder*="Last name" i]'],
  },
  {
    key: 'fullName',
    selectors: ['[name="name"]', '[name="full_name"]', '[autocomplete="name"]', '[placeholder*="Full name" i]'],
    getValue: (p) => `${p.firstName} ${p.lastName}`.trim(),
  },
  {
    key: 'email',
    selectors: ['#email', '[name="email"]', '[type="email"]', '[autocomplete="email"]'],
  },
  {
    key: 'phone',
    selectors: ['#phone', '[name="phone"]', '[type="tel"]', '[autocomplete="tel"]', '[placeholder*="phone" i]'],
  },
  {
    key: 'city',
    selectors: ['#city', '[name="city"]', '[autocomplete="address-level2"]', '[placeholder*="city" i]'],
  },
  {
    key: 'state',
    selectors: ['[name="state"]', '[autocomplete="address-level1"]'],
  },
  {
    key: 'postalCode',
    selectors: ['[name="zip"]', '[name="postalCode"]', '[name="postal_code"]', '[autocomplete="postal-code"]'],
  },
  {
    key: 'linkedin',
    selectors: ['[name="urls[LinkedIn]"]', '[name="linkedin"]', '[placeholder*="linkedin" i]'],
  },
  {
    key: 'portfolio',
    selectors: ['[name="urls[Website]"]', '[name="portfolio"]', '[name="website"]', '[placeholder*="portfolio" i]', '[placeholder*="website" i]'],
  },
  {
    key: 'github',
    selectors: ['[name="urls[Github]"]', '[name="github"]', '[placeholder*="github" i]'],
  },
];

function fillField(el, value) {
  if (!el || !value) return false;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
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

function injectButton(profile) {
  if (document.getElementById('ww-autofill-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'ww-autofill-btn';
  btn.textContent = '⚡ Autofill';
  btn.title = 'Fill this form with your Wander/Work profile';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '2147483647',
    background: '#306770',
    color: '#fff',
    border: 'none',
    borderRadius: '24px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(48,103,112,0.35)',
    transition: 'background 0.15s, transform 0.1s',
    letterSpacing: '-0.2px',
  });

  btn.addEventListener('mouseenter', () => { btn.style.background = '#255860'; btn.style.transform = 'scale(1.03)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#306770'; btn.style.transform = 'scale(1)'; });

  btn.addEventListener('click', () => {
    const count = autofill(profile);
    btn.textContent = count > 0 ? `✓ Filled ${count} fields` : '⚠ No fields found';
    btn.style.background = count > 0 ? '#27ae60' : '#c0392b';
    setTimeout(() => {
      btn.textContent = '⚡ Autofill';
      btn.style.background = '#306770';
    }, 2500);
  });

  document.body.appendChild(btn);
}

// Only inject if there's a form on the page and a connected profile
chrome.storage.local.get(['profile'], ({ profile }) => {
  if (!profile) return;
  const hasForm = document.querySelector('form input, form textarea');
  if (!hasForm) return;
  injectButton(profile);
});
