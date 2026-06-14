'use strict';

const API = 'https://wanderwork-backend-server.onrender.com';

const $ = (id) => document.getElementById(id);

const SUPPORTED_SITES = [
  { pattern: /greenhouse\.io/, name: 'Greenhouse' },
  { pattern: /lever\.co/, name: 'Lever' },
  { pattern: /ashbyhq\.com/, name: 'Ashby' },
  { pattern: /myworkdayjobs\.com/, name: 'Workday' },
  { pattern: /smartrecruiters\.com/, name: 'SmartRecruiters' },
  { pattern: /workable\.com/, name: 'Workable' },
  { pattern: /jobvite\.com/, name: 'Jobvite' },
];

function showConnected(profile) {
  $('state-disconnected').style.display = 'none';
  $('state-connected').style.display = 'flex';
  $('connected-name').textContent = `${profile.firstName} ${profile.lastName}`;

  // Check active tab for supported site
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    const site = SUPPORTED_SITES.find((s) => s.pattern.test(url));
    $('site-status').innerHTML = site
      ? `Active on <b>${site.name}</b>. Click the teal button on the page to autofill.`
      : 'Open a job application on a supported site to autofill.';
  });
}

function showDisconnected() {
  $('state-disconnected').style.display = 'flex';
  $('state-connected').style.display = 'none';
  $('error-msg').style.display = 'none';
  $('key-input').value = '';
}

async function connect(key) {
  const res = await fetch(`${API}/extension/profile?key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Could not connect. Check your key.');
  }
  return res.json();
}

// Init
chrome.storage.local.get(['extensionKey', 'profile'], ({ extensionKey, profile }) => {
  if (extensionKey && profile) {
    showConnected(profile);
  } else {
    showDisconnected();
  }
});

$('connect-btn').addEventListener('click', async () => {
  const key = $('key-input').value.trim();
  if (!key) return;

  $('connect-btn').textContent = 'Connecting...';
  $('connect-btn').disabled = true;
  $('error-msg').style.display = 'none';

  try {
    const profile = await connect(key);
    await chrome.storage.local.set({ extensionKey: key, profile });
    showConnected(profile);
  } catch (err) {
    $('error-msg').textContent = err.message;
    $('error-msg').style.display = 'block';
    $('connect-btn').textContent = 'Connect Account';
    $('connect-btn').disabled = false;
  }
});

$('disconnect-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove(['extensionKey', 'profile']);
  showDisconnected();
});
